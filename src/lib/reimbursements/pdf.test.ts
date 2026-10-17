import { describe, expect, it, vi } from 'vitest'
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFString, degrees } from 'pdf-lib'
import sharp from 'sharp'
import { buildReportPdf, loadReportReceipts, type ReportReceipt } from './pdf'
import type { Report } from './model'
import { receiptLimits } from './receipts'

const hash = 'a'.repeat(64)
const report: Report = {
  id: '00000000-0000-4000-8000-000000000043', number: 43, claimantId: 1,
  claimantName: 'Aroha Ngata', claimantEmail: 'aroha@example.com', centreId: 1,
  centreName: 'Hospitality', status: 'awaiting-payment', version: 1, revision: 1,
  accountName: 'Aroha Ngata', accountNumber: '12-1234-1234567-000', rcApproverId: 2,
  createdAt: '2026-10-17T00:00:00Z', updatedAt: '2026-10-17T00:00:00Z', history: [],
  lines: [{ id: '00000000-0000-4000-8000-000000000044', date: '2026-10-16', categoryId: 1, description: 'Lunch', amountMinor: 11500, hasGst: true, receiptHash: hash }],
}
async function pdfReceipt(pages = 1): Promise<ReportReceipt> {
  const source = await PDFDocument.create()
  for (let i = 0; i < pages; i++) source.addPage([300, 400]).drawText(`Receipt page ${i + 1}`)
  return { hash, body: Buffer.from(await source.save()), mediaType: 'application/pdf' }
}

describe('expense report PDFs', () => {
  it('appends every page of a shared PDF receipt once', async () => {
    const input = { ...report, lines: [...report.lines, { ...report.lines[0], id: 'second-line' }] }
    const receipt = await pdfReceipt(2)
    const original = await PDFDocument.load(receipt.body)
    original.getPage(0).setRotation(degrees(90))
    receipt.body = Buffer.from(await original.save())
    const result = await PDFDocument.load(await buildReportPdf(input, [], true, [receipt]))
    expect(result.getPageCount()).toBe(3)
    expect(result.getPages().map(page => page.getSize())).toEqual([{ width: 595, height: 842 }, { width: 300, height: 400 }, { width: 300, height: 400 }])
    expect(result.getPage(1).getRotation().angle).toBe(90)
  })

  it.each(['png', 'jpeg', 'webp'] as const)('appends a %s photo on its own page', async format => {
    const body = await sharp({ create: { width: 160, height: 500, channels: 3, background: '#ffffff' } }).toFormat(format).toBuffer()
    const result = await PDFDocument.load(await buildReportPdf(report, [], false, [{ hash, body, mediaType: `image/${format}` }]))
    expect(result.getPageCount()).toBe(2)
    const page = result.getPage(1)
    expect(page.getWidth() / page.getHeight()).toBeCloseTo(160 / 500)
    expect(page.getHeight()).toBe(842)
  })

  it('paginates long descriptions and activity before the receipt appendix', async () => {
    const result = await PDFDocument.load(await buildReportPdf({ ...report,
      lines: Array.from({ length: 25 }, (_, i) => ({ ...report.lines[0], id: String(i), description: 'A long description with multiple lines. '.repeat(35) })),
      history: Array.from({ length: 30 }, () => ({ at: '2026-10-17T00:00:00Z', personId: 2, name: 'Hannah Wilson', action: 'reject', revision: 1, reason: 'Please check this expense. '.repeat(25) })),
    }, [], false, [await pdfReceipt()]))
    expect(result.getPageCount()).toBeGreaterThan(10)
  })

  it('fails visibly if an expected receipt is missing or unreadable', async () => {
    await expect(buildReportPdf(report, [], true, [])).rejects.toThrow('could not be included')
    await expect(buildReportPdf(report, [], true, [{ hash, body: Buffer.from('%PDF-invalid'), mediaType: 'application/pdf' }])).rejects.toThrow()
  })

  it('loads only hashes referenced by the authorised report, in expense order', async () => {
    const receipt = await pdfReceipt()
    const query = vi.fn().mockResolvedValueOnce({ rows: [{ hash, bytes: receipt.body.length }] }).mockResolvedValue({ rows: [{ hash, body: receipt.body, media_type: receipt.mediaType }] })
    const result = await loadReportReceipts({ query }, { ...report, lines: [...report.lines, report.lines[0]] })
    expect(query).toHaveBeenCalledWith(expect.stringContaining('hash=ANY'), [[hash]])
    expect(result).toEqual([receipt])
    query.mockResolvedValue({ rows: [] })
    await expect(loadReportReceipts({ query }, report)).rejects.toThrow('could not be loaded')
  })

  it('rejects oversized aggregate receipts before loading their bodies', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ hash, bytes: receiptLimits.reportBytes + 1 }] })
    await expect(loadReportReceipts({ query }, report)).rejects.toThrow('15 MB')
    expect(query).toHaveBeenCalledTimes(1)
    expect(query.mock.calls[0][0]).toContain('octet_length')
  })

  it('removes page, annotation, nested and parent actions without losing appearances or geometry', async () => {
    const source = await PDFDocument.create()
    const page = source.addPage([300, 400])
    page.setRotation(degrees(90))
    page.drawText('Receipt visible text')
    const action = () => source.context.obj({ S: 'JavaScript', JS: PDFString.of('app.alert("unsafe")') })
    const appearance = source.context.register(source.context.flateStream('0 0 1 rg 0 0 30 20 re f', { Type: 'XObject', Subtype: 'Form', BBox: [0, 0, 30, 20], Resources: {} }))
    const launch = source.context.obj({ S: 'Launch', F: PDFString.of('unsafe.exe') })
    const parent = source.context.register(source.context.obj({ AA: { E: action() }, UnusualEntry: launch }))
    const annotation = source.context.obj({ Type: 'Annot', Subtype: 'Widget', Rect: [10, 10, 40, 30], AP: { N: appearance }, Parent: parent, A: action(), AA: { E: action() }, RichMediaContent: { Assets: {} } })
    page.node.set(PDFName.of('Annots'), source.context.obj([source.context.register(annotation)]))
    page.node.set(PDFName.of('AA'), source.context.obj({ O: action() }))
    const input = Buffer.from(await source.save())
    const result = await PDFDocument.load(await buildReportPdf(report, [], true, [{ hash, body: input, mediaType: 'application/pdf' }]))
    const copied = result.getPage(1)
    expect(copied.getSize()).toEqual({ width: 300, height: 400 })
    expect(copied.getRotation().angle).toBe(90)
    expect(copied.node.has(PDFName.of('Contents'))).toBe(true)
    expect(copied.node.has(PDFName.of('AA'))).toBe(false)
    const copiedAnnotation = copied.node.lookup(PDFName.of('Annots'), PDFArray).lookup(0, PDFDict)
    expect(copiedAnnotation.has(PDFName.of('AP'))).toBe(true)
    for (const key of ['A', 'AA', 'RichMediaContent']) expect(copiedAnnotation.has(PDFName.of(key))).toBe(false)
    expect(copiedAnnotation.lookup(PDFName.of('Parent'), PDFDict).has(PDFName.of('AA'))).toBe(false)
    expect(copiedAnnotation.lookup(PDFName.of('Parent'), PDFDict).lookup(PDFName.of('UnusualEntry'), PDFDict).keys()).toHaveLength(0)
  })

  it('enforces aggregate pages while shared receipts count only once', async () => {
    const receipts = await Promise.all([pdfReceipt(20), pdfReceipt(20), pdfReceipt(11)])
    receipts.forEach((receipt, i) => { receipt.hash = String(i).repeat(64) })
    const input = { ...report, lines: receipts.map((receipt, i) => ({ ...report.lines[0], id: String(i), receiptHash: receipt.hash })) }
    await expect(buildReportPdf(input, [], true, receipts)).rejects.toThrow('50 pages')
    const shared = { ...report, lines: Array.from({ length: 10 }, (_, i) => ({ ...report.lines[0], id: String(i) })) }
    await expect(buildReportPdf(shared, [], true, [await pdfReceipt(20)])).resolves.toBeInstanceOf(Buffer)
  })

  it('rejects an oversized final document even when the original receipt fits', async () => {
    const spy = vi.spyOn(PDFDocument.prototype, 'save').mockResolvedValue(new Uint8Array(receiptLimits.finalBytes + 1))
    try { await expect(buildReportPdf({ ...report, lines: [] }, [], true)).rejects.toThrow('complete report PDF') }
    finally { spy.mockRestore() }
  })

  it('reserves final PDF headroom at submission for subsequent approval history', async () => {
    const spy = vi.spyOn(PDFDocument.prototype, 'save').mockResolvedValue(new Uint8Array(receiptLimits.finalBytes - receiptLimits.historyBytes + 1))
    try {
      await expect(buildReportPdf({ ...report, lines: [] }, [], true, [], 'submission')).rejects.toThrow('reserves 256 KB and two pages')
      await expect(buildReportPdf({ ...report, lines: [] }, [], true)).resolves.toBeInstanceOf(Buffer)
    } finally { spy.mockRestore() }
  })
})
