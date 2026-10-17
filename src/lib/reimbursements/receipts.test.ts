import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'
import { assertFinalPdfBudget, assertReceiptBudget, receiptLimits, validateReceipt } from './receipts'

describe('receipt validation', () => {
  it.each(['png', 'jpeg', 'webp'] as const)('fully decodes supported %s images', async format => {
    const bytes = await sharp({ create: { width: 50, height: 50, channels: 3, background: 'white' } }).toFormat(format).toBuffer()
    await expect(validateReceipt(bytes, `image/${format}`)).resolves.toEqual({ mediaType: `image/${format}`, pages: 1 })
    await expect(validateReceipt(bytes.subarray(0, Math.floor(bytes.length / 2)), `image/${format}`)).rejects.toThrow('could not be read')
    await expect(validateReceipt(bytes, 'application/pdf')).rejects.toThrow('Upload a JPEG')
  })

  it('rejects excessive decoded pixels even for a small compressed image', async () => {
    const bytes = await sharp({ create: { width: 6400, height: 6400, channels: 3, background: 'white' } }).png().toBuffer()
    expect(bytes.length).toBeLessThan(receiptLimits.fileBytes)
    await expect(validateReceipt(bytes, 'image/png')).rejects.toThrow('40 megapixels')
  })

  it('rejects encrypted, broken, empty and excessive-page PDFs with actionable errors', async () => {
    const pdf = await PDFDocument.create()
    pdf.addPage()
    await expect(validateReceipt(Buffer.from(await pdf.save()), 'application/pdf')).resolves.toEqual({ mediaType: 'application/pdf', pages: 1 })
    pdf.context.trailerInfo.Encrypt = pdf.context.register(pdf.context.obj({ Filter: 'Standard', V: 1, R: 2 }))
    await expect(validateReceipt(Buffer.from(await pdf.save()), 'application/pdf')).rejects.toThrow('password-protected')
    await expect(validateReceipt(Buffer.from('%PDF-broken'), 'application/pdf')).rejects.toThrow('could not be read')
    const empty = await PDFDocument.create()
    await expect(validateReceipt(Buffer.from(await empty.save({ addDefaultPage: false })), 'application/pdf')).rejects.toThrow('could not be read')
    const long = await PDFDocument.create()
    for (let i = 0; i < 21; i++) long.addPage()
    await expect(validateReceipt(Buffer.from(await long.save()), 'application/pdf')).rejects.toThrow('20 pages')
  })

  it('enforces upload, aggregate and encoded-email source budgets at their boundaries', async () => {
    await expect(validateReceipt(Buffer.alloc(0), 'image/png')).rejects.toThrow('10 MB')
    await expect(validateReceipt(Buffer.alloc(receiptLimits.fileBytes + 1), 'image/png')).rejects.toThrow('10 MB')
    expect(() => assertReceiptBudget(receiptLimits.reportBytes, receiptLimits.reportPages)).not.toThrow()
    expect(() => assertReceiptBudget(receiptLimits.reportBytes + 1, 0)).toThrow('15 MB')
    expect(() => assertReceiptBudget(0, receiptLimits.reportPages + 1)).toThrow('50 pages')
    expect(() => assertFinalPdfBudget(receiptLimits.finalBytes, receiptLimits.finalPages)).not.toThrow()
    expect(() => assertFinalPdfBudget(receiptLimits.finalBytes + 1, 0)).toThrow('complete report PDF')
    expect(() => assertFinalPdfBudget(0, receiptLimits.finalPages + 1)).toThrow('80 pages')
    expect(() => assertFinalPdfBudget(receiptLimits.finalBytes - receiptLimits.historyBytes, receiptLimits.finalPages - receiptLimits.historyPages, true)).not.toThrow()
    expect(() => assertFinalPdfBudget(receiptLimits.finalBytes - receiptLimits.historyBytes + 1, 1, true)).toThrow('reserves 256 KB and two pages')
    expect(() => assertFinalPdfBudget(1, receiptLimits.finalPages - receiptLimits.historyPages + 1, true)).toThrow('reserves 256 KB and two pages')
  })
})
