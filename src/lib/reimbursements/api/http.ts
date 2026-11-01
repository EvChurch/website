import { executeOnce } from '@/lib/api/operations'
import { createHash } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod-v3'
import { reimbursementPool } from '../runtime'
import { actOnReportInTransaction, markBatchPaidInTransaction, ReimbursementError, transaction } from '../store'
import { buildReportPdf, loadReportReceipts } from '../pdf'
import { ApiError, audit, requireScope } from '@/lib/api/keys'
import { authenticate, lockKey, type Principal } from './principal'
import { findReport, listReports, reportData, authorizeReview } from './reports'
import { paymentsSchema, rejectSchema, reviewSchema, type ApiScope } from './contract'

export const API_HEADERS = { 'Cache-Control': 'private, no-store', Vary: 'Authorization', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' }
export function apiFailure(error: unknown) {
  const status = (error instanceof ReimbursementError || error instanceof ApiError) ? error.status : error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 503
  const code = error instanceof ApiError ? error.code : ({400:'invalid_request',401:'unauthorized',403:'forbidden',404:'not_found',409:'conflict',413:'too_large',415:'unsupported_media_type'} as Record<number,string>)[status] ?? 'unavailable'
  return NextResponse.json({ error: { code, message: (error instanceof ReimbursementError || error instanceof ApiError) ? error.message : status===400 ? 'Invalid request. Check the API specification.' : 'The API is temporarily unavailable.' } }, { status, headers: { ...API_HEADERS,...(status===401 ? { 'WWW-Authenticate': 'Bearer' } : {}),...(error instanceof ApiError && error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {}) } })
}
export async function readApiBody(request: Request) {
  if (request.headers.get('content-type')?.split(';')[0].trim()!=='application/json') throw new ReimbursementError('Use Content-Type: application/json.',415)
  const reader=request.body?.getReader(); if (!reader) throw new ReimbursementError('A JSON body is required.')
  const chunks: Uint8Array[]=[]; let size=0
  try { while (true) { const item=await reader.read(); if (item.done) break; size+=item.value.length; if (size>65536) { await reader.cancel(); throw new ReimbursementError('Maximum JSON body size is 64 KB.',413) }; chunks.push(item.value) } }
  finally { reader.releaseLock() }
  return JSON.parse(Buffer.concat(chunks).toString()) as unknown
}
function jsonResponse(request: Request, data: unknown) {
  const body=JSON.stringify(data), etag=`"${createHash('sha256').update(body).digest('hex')}"`
  const unchanged=request.method==='GET' && request.headers.get('if-none-match')?.split(',').map(value=>value.trim()).includes(etag)
  return new NextResponse(unchanged?null:body,{status:unchanged?304:200,headers:{...API_HEADERS,'Content-Type':'application/json',...(request.method==='GET'?{ETag:etag}:{})}})
}
export async function handleApiRequest(request: NextRequest,path: string[]) {
  let principal: Principal | undefined, action='reimbursements.request.unknown'
  let pool: Awaited<ReturnType<typeof reimbursementPool>> | undefined
  try {
    pool=await reimbursementPool(); principal=await authenticate(pool,request.headers.get('authorization'))
    const idSchema=z.string().uuid()
    if (path[0]==='reports' && path.length===1 && request.method==='GET') {
      action='reimbursements.reports.list'; requireScope(principal.key,'reimbursements:reports:read')
      const result=await listReports(pool,principal,request.nextUrl.searchParams)
      const response=jsonResponse(request,result)
      await audit(pool,principal.key.id,action,response.status)
      return response
    }
    if (path[0]==='reports' && idSchema.safeParse(path[1]).success) {
      const id=path[1]
      if (request.method==='GET' && (path.length===2 || path.length===3 && path[2]==='pdf' || path.length===4 && path[2]==='receipts' && idSchema.safeParse(path[3]).success)) {
        action=path.length===2?'reimbursements.reports.get':path[2]==='pdf'?'reimbursements.reports.pdf':'reimbursements.reports.receipt'
        requireScope(principal.key,path.length===2?'reimbursements:reports:read':'reimbursements:receipts:read')
        const {report,permissions,context}=await findReport(pool,principal,id)
        if (path.length===2) { const response=jsonResponse(request,reportData(report,principal,permissions)); await audit(pool,principal.key.id,action,response.status,{reportId:id}); return response }
        if (path[2]==='pdf') {
          const pdf=await buildReportPdf(report,context.categories,permissions.bank && principal.key.scopes.includes('reimbursements:bank:read'),await loadReportReceipts(pool,report))
          await audit(pool,principal.key.id,action,200,{reportId:id})
          return new NextResponse(new Uint8Array(pdf),{headers:{...API_HEADERS,'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="EXP-${report.number}.pdf"`}})
        }
        const line=report.lines.find(line=>line.id===path[3])
        if (!line?.receiptHash) throw new ApiError('not_found','Receipt not found.',404)
        const receipt=(await pool.query<{body:Buffer;media_type:string}>('SELECT body,media_type FROM reimbursement_receipts WHERE hash=$1',[line.receiptHash])).rows[0]
        if (!receipt) throw new ApiError('not_found','Receipt not found.',404)
        await audit(pool,principal.key.id,action,200,{reportId:id,expenseId:line.id})
        return new NextResponse(new Uint8Array(receipt.body),{headers:{...API_HEADERS,'Content-Type':receipt.media_type,'Content-Disposition':'attachment; filename="receipt.'+(receipt.media_type==='application/pdf'?'pdf':receipt.media_type.split('/')[1])+'"','Content-Security-Policy':"sandbox; default-src 'none'",'Referrer-Policy':'no-referrer'}})
      }
    }
    const review=path[0]==='reports' && idSchema.safeParse(path[1]).success && path.length===3 && ['approve','reject'].includes(path[2])
    const payment=path.join('/')==='payments/confirm'
    if (request.method==='POST' && (review || payment)) {
      action=payment?'reimbursements.payments.confirm':`reimbursements.reports.${path[2]}`
      const scope:ApiScope=payment?'reimbursements:payments:confirm':'reimbursements:reports:review'; requireScope(principal.key,scope)
      const operationId=z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/).parse(request.headers.get('idempotency-key'))
      const raw=await readApiBody(request)
      const command=payment?paymentsSchema.parse(raw):path[2]==='reject'?rejectSchema.parse(raw):reviewSchema.parse(raw)
      const requestHash=createHash('sha256').update(JSON.stringify(['v1/reimbursements',path,command])).digest('hex')
      const result=await transaction(pool,async db=>{
        const current=await lockKey(db,principal!,scope)
        if (payment) { if (!current.actor.finance) throw new ApiError('forbidden','Current finance membership is required.',403) }
        else await authorizeReview(db,current,path[1])
        const {response, replay}=await executeOnce(db,current.key.id,operationId,requestHash,async()=>{
        let response: unknown
        if (payment) { const input=paymentsSchema.parse(command); await markBatchPaidInTransaction(db,current.actor,input); response={reports:input.reports.map(report=>({id:report.id,version:report.version+1,status:'paid'}))} }
        else response={id:path[1],version:await actOnReportInTransaction(db,current.actor,path[1],{...command,action:path[2]})}
        return response
        })
        await audit(db,current.key.id,action,200,{replay,...(payment?{reportIds:paymentsSchema.parse(command).reports.map(report=>report.id)}:{reportId:path[1]})})
        return response
      })
      return jsonResponse(request,result)
    }
    throw new ApiError('not_found','Endpoint not found.',404)
  } catch(error) {
    const response=apiFailure(error)
    if (pool) { try { await audit(pool,principal?.key.id ?? (error instanceof ApiError ? error.keyId : null) ?? null,action,response.status) } catch { /* Do not expose infrastructure errors or request content. */ } }
    return response
  }
}
