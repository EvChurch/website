import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod-v3'
import { isSameOriginRequest } from '@/lib/request-origin'
import { getPayloadClient } from '@/lib/payload'
import { canManageReimbursementSettings } from './admin-access'
import { hasPaymentSettings, type Actor } from './model'
import { rockFetch } from '@/lib/rock-api'
import { reimbursementActor, reimbursementPool } from './runtime'
import { actOnReport, configure, createReport, directory, hasOpened, markBatchPaid, memberOverview, paymentProfile, openReimbursements, overview, ReimbursementError, reportPermissions, saveDraft, saveProfile, uploadReceipt } from './store'
import { buildReportPdf, loadReportReceipts } from './pdf'

export const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store', Vary: 'Cookie', 'X-Content-Type-Options': 'nosniff' }
async function body(request: Request, limit: number) {
  const reader = request.body?.getReader()
  if (!reader) return Buffer.alloc(0)
  const chunks: Uint8Array[] = []; let length = 0
  try {
    while (true) {
      const item = await reader.read()
      if (item.done) break
      length += item.value.length
      if (length > limit) { await reader.cancel(); throw new ReimbursementError('The upload is too large.', 413) }
      chunks.push(item.value)
    }
  } finally { reader.releaseLock() }
  return Buffer.concat(chunks)
}
function json(data: unknown, status = 200) { return NextResponse.json(data, { status, headers: PRIVATE_HEADERS }) }

export async function handleReimbursementRequest(request: NextRequest, path: string[] = []) {
  try {
    if (request.method !== 'GET' && !isSameOriginRequest(request)) return json({ error: 'Invalid request origin.' }, 403)
    const settingsRequest = ['settings', 'people'].includes(path[0])
    let actor: Actor | null
    if (settingsRequest) {
      const payload = await getPayloadClient()
      const auth = await payload.auth({ headers: request.headers })
      const user = auth.user?.collection === 'users' ? auth.user : null
      if (!await canManageReimbursementSettings(payload, user)) return json({ error: 'Finance or administrator access required.' }, 403)
      actor = { personId: 0, name: user!.email, email: user!.email, admin: true, finance: false }
    } else actor = await reimbursementActor(request)
    if (!actor) return json({ error: 'Sign in with your own account to use reimbursements.' }, 401)
    const pool = await reimbursementPool()
    if (path[0] === 'menu' && request.method === 'GET') return json({ enabled: await hasOpened(pool, actor.personId) })
    if (path.length === 0) {
      if (request.method === 'GET') return json(await memberOverview(pool, actor))
    }
    if (path.length === 1 && path[0] === 'profile' && request.method === 'PUT') {
      await saveProfile(pool, actor, JSON.parse((await body(request, 4096)).toString()))
      return json({ ok: true })
    }
    if (path[0] === 'open' && request.method === 'POST') {
      await openReimbursements(pool, actor.personId); return json({ ok: true })
    }
    if (!settingsRequest && !hasPaymentSettings(await paymentProfile(pool, actor.personId))) {
      return json({ error: 'Set up your payment settings before using reimbursements.' }, 403)
    }
    if (path.length === 0 && request.method === 'POST') return json({ id: await createReport(pool, actor) })
    if (path[0] === 'people' && request.method === 'GET') {
      if (!actor.finance && !actor.admin) throw new ReimbursementError('Finance or administrator access required.', 403)
      const search = request.nextUrl.searchParams.get('q')?.trim() ?? ''
      if (search.length < 2 || search.length > 100) return json([])
      const escaped = search.replaceAll("'", "''")
      const people = await rockFetch<Array<{ Id: number; NickName: string; LastName: string; Email: string }>>({
        endpoint: 'People', params: { $filter: `substringof('${escaped}',NickName) or substringof('${escaped}',LastName)`, $select: 'Id,NickName,LastName,Email', $top: '15' },
      })
      return json(people.map(person => ({ id: person.Id, name: `${person.NickName} ${person.LastName}`, email: person.Email ?? '' })))
    }
    if (path[0] === 'receipt' && path.length === 1 && request.method === 'POST') {
      const raw = await body(request, 10 * 1024 * 1024 + 32768)
      const form = await new Response(new Uint8Array(raw), { headers: { 'Content-Type': request.headers.get('Content-Type') ?? '' } }).formData()
      const file = form.get('file')
      if (!(file instanceof File)) throw new ReimbursementError('Choose a receipt file.')
      return json({ hash: await uploadReceipt(pool, actor, Buffer.from(await file.arrayBuffer()), file.name, file.type) })
    }
    if (path[0] === 'receipt' && /^[a-f0-9]{64}$/.test(path[1] ?? '') && request.method === 'GET') {
      const hash = path[1]
      const own = await pool.query('SELECT 1 FROM reimbursement_receipt_owners WHERE hash=$1 AND person_id=$2', [hash, actor.personId])
      if (!own.rowCount) {
        const data = await overview(pool, actor)
        if (!data.reports.some(report => report.lines.some(line => line.receiptHash === hash))) throw new ReimbursementError('Receipt not found.', 404)
      }
      const receipt = (await pool.query<{ body: Buffer; media_type: string }>('SELECT body,media_type FROM reimbursement_receipts WHERE hash=$1', [hash])).rows[0]
      if (!receipt) throw new ReimbursementError('Receipt not found.', 404)
      return new NextResponse(new Uint8Array(receipt.body), { headers: {
        ...PRIVATE_HEADERS, 'Content-Type': receipt.media_type, 'Content-Disposition': `inline; filename="receipt.${receipt.media_type === 'application/pdf' ? 'pdf' : receipt.media_type.split('/')[1]}"`,
        'Content-Security-Policy': "sandbox; default-src 'none'", 'Referrer-Policy': 'no-referrer',
      } })
    }
    if (path[0] === 'pdf' && z.string().uuid().safeParse(path[1]).success && request.method === 'GET') {
      const data = await overview(pool, actor)
      const report = data.reports.find(report => report.id === path[1])
      if (!report) throw new ReimbursementError('Report not found.', 404)
      const context = await directory(pool)
      const access = reportPermissions(actor, report, context.centres, context.settings)
      const pdf = await buildReportPdf(report, data.categories, access.bank, await loadReportReceipts(pool, report))
      return new NextResponse(new Uint8Array(pdf), { headers: { ...PRIVATE_HEADERS, 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="EXP-${report.number}.pdf"` } })
    }
    if (path[0] === 'report' && z.string().uuid().safeParse(path[1]).success) {
      const input: unknown = JSON.parse((await body(request, 512 * 1024)).toString())
      if (request.method === 'PATCH') {
        const command = z.object({ version: z.number().int().positive(), draft: z.unknown() }).parse(input)
        return json({ version: await saveDraft(pool, actor, path[1], command.version, command.draft) })
      }
      if (request.method === 'POST') return json({ version: await actOnReport(pool, actor, path[1], input) })
    }
    if (path[0] === 'payments' && request.method === 'POST') {
      await markBatchPaid(pool, actor, JSON.parse((await body(request, 64 * 1024)).toString()))
      return json({ ok: true })
    }
    if (path[0] === 'settings' && request.method === 'GET') {
      const { settings, categories } = await directory(pool)
      return json({ settings, categories })
    }
    if (path[0] === 'settings' && request.method === 'PUT') {
      const input: unknown = JSON.parse((await body(request, 128 * 1024)).toString())
      if (!actor.finance && !actor.admin) throw new ReimbursementError('Finance or administrator access required.', 403)
      // Resolve configured people through Rock; never trust an entered email/person pair.
      const command = z.object({ settings: z.object({ seniorPersonId: z.number().int().positive().nullable(), alternatePersonId: z.number().int().positive().nullable() }).passthrough() }).passthrough().parse(input)
      for (const key of ['senior', 'alternate'] as const) {
        const personId = command.settings[`${key}PersonId`]
        if (personId) {
          const person = await rockFetch<{ Id: number; NickName: string; LastName: string; Email: string }>({ endpoint: `People/${personId}`, params: { $select: 'Id,NickName,LastName,Email' } })
          if (person.Id !== personId || !person.Email) throw new ReimbursementError('Choose a Rock person with an email address.')
          command.settings[`${key}Name`] = `${person.NickName} ${person.LastName}`
          command.settings[`${key}Email`] = person.Email
        } else { command.settings[`${key}Name`] = ''; command.settings[`${key}Email`] = '' }
      }
      await configure(pool, actor, command); return json({ ok: true })
    }
    return json({ error: 'Not found.' }, 404)
  } catch (error) {
    if (error instanceof ReimbursementError) return json({ error: error.message }, error.status)
    if (error instanceof z.ZodError || error instanceof SyntaxError || error instanceof TypeError) return json({ error: 'Some fields are invalid. Check the report and try again.' }, 400)
    console.error('Reimbursement request failed', error instanceof Error ? error.name : 'Unknown error')
    return json({ error: 'Reimbursements are temporarily unavailable. Your saved report is safe. Please try again.' }, 503)
  }
}
