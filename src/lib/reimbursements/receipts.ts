import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, type PDFObject } from 'pdf-lib'
import sharp from 'sharp'

export const receiptLimits = {
  fileBytes: 10 * 1024 * 1024,
  imagePixels: 40_000_000,
  filePages: 20,
  reportBytes: 15 * 1024 * 1024,
  reportPages: 50,
  finalBytes: 15 * 1024 * 1024,
  finalPages: 80,
  historyBytes: 256 * 1024,
  historyPages: 2,
} as const

export class ReceiptValidationError extends Error {}

export function assertReceiptBudget(bytes: number, pages: number) {
  if (bytes > receiptLimits.reportBytes) throw new ReceiptValidationError('Receipts together must be 15 MB or less. Compress the files or split the expenses into separate reports.')
  if (pages > receiptLimits.reportPages) throw new ReceiptValidationError('Receipts together must be 50 pages or fewer. Split the expenses into separate reports.')
}

export function assertFinalPdfBudget(bytes: number, pages: number, reserveHistory = false) {
  const maxBytes = receiptLimits.finalBytes - (reserveHistory ? receiptLimits.historyBytes : 0)
  const maxPages = receiptLimits.finalPages - (reserveHistory ? receiptLimits.historyPages : 0)
  if (bytes > maxBytes || pages > maxPages) throw new ReceiptValidationError(`The complete report PDF must be 15 MB or less and 80 pages or fewer for email.${reserveHistory ? ' Submission also reserves 256 KB and two pages for approval history.' : ''} Compress receipts or split the expenses into separate reports.`)
}

export async function validateReceipt(body: Buffer, mediaType: string): Promise<{ mediaType: string; pages: number }> {
  if (!body.length || body.length > receiptLimits.fileBytes) throw new ReceiptValidationError('Each receipt must be 10 MB or less. Compress the file and upload it again.')
  const detected = body.subarray(0, 5).toString() === '%PDF-' ? 'application/pdf'
    : body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff ? 'image/jpeg'
      : body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'image/png'
        : body.subarray(0, 4).toString() === 'RIFF' && body.subarray(8, 12).toString() === 'WEBP' ? 'image/webp' : null
  if (!detected || detected !== mediaType) throw new ReceiptValidationError('Upload a JPEG, PNG, WebP image or PDF receipt.')
  if (detected === 'application/pdf') {
    try {
      const source = await PDFDocument.load(body, { throwOnInvalidObject: true })
      if (source.isEncrypted) throw new Error('Encrypted PDF')
      const pages = source.getPageCount()
      if (!pages) throw new Error('Empty PDF')
      if (pages > receiptLimits.filePages) throw new ReceiptValidationError('Each PDF receipt must be 20 pages or fewer. Upload only the pages needed for this expense.')
      // Exercise the same page-copy operation used by the email attachment.
      stripPdfActions(source)
      const copy = await PDFDocument.create()
      for (const page of await copy.copyPages(source, source.getPageIndices())) copy.addPage(page)
      await copy.save()
      return { mediaType: detected, pages }
    } catch (error) {
      if (error instanceof ReceiptValidationError) throw error
      throw new ReceiptValidationError('This PDF could not be read or is password-protected. Export an unlocked PDF and upload it again.')
    }
  }
  try {
    const image = sharp(body, { limitInputPixels: receiptLimits.imagePixels, failOn: 'warning' })
    const metadata = await image.metadata()
    if ((metadata.pages ?? 1) > 1) throw new Error('Animated image')
    // Metadata alone does not detect truncated pixel data. Decode the full image.
    await image.rotate().resize({ width: 2400, height: 3200, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 88 }).toBuffer()
    return { mediaType: detected, pages: 1 }
  } catch {
    throw new ReceiptValidationError('This image could not be read, is animated, or exceeds 40 megapixels. Export a smaller JPEG or PNG and upload it again.')
  }
}

/** Remove interactivity, retaining page content, annotation appearances and geometry. */
export function stripPdfActions(document: PDFDocument) {
  const forbidden = new Set(['A', 'AA', 'OpenAction', 'PresSteps', 'JS', 'JavaScript', 'RichMediaContent', 'RichMediaSettings', 'Movie', 'Sound', '3DD', '3DA', 'FS', 'EF', 'AF', 'EmbeddedFiles', 'XFA'])
  const actionTypes = new Set(['GoTo', 'GoToR', 'GoToE', 'Launch', 'Thread', 'URI', 'Sound', 'Movie', 'Hide', 'Named', 'SubmitForm', 'ResetForm', 'ImportData', 'JavaScript', 'SetOCGState', 'Rendition', 'Trans', 'GoTo3DView'])
  const visited = new Set<PDFObject>()
  function visit(object: PDFObject) {
    if (visited.has(object)) return
    visited.add(object)
    if (object instanceof PDFDict) {
      const subtype = object.lookup(PDFName.of('S'))
      if (subtype instanceof PDFName && actionTypes.has(subtype.decodeText())) {
        for (const key of object.keys()) object.delete(key)
        return
      }
      for (const [key, value] of object.entries()) {
        // Type 3 fonts can have glyphs named A, AA, JS, etc. Their streams are
        // appearance data, not action dictionaries, and must remain intact.
        const resolved = document.context.lookup(value)
        if (forbidden.has(key.decodeText()) && !(resolved instanceof PDFRawStream && !object.has(PDFName.of('S')) && ['A', 'AA', 'JS'].includes(key.decodeText()))) object.delete(key)
        else visit(value)
      }
    } else if (object instanceof PDFArray) {
      for (let i = 0; i < object.size(); i++) visit(object.get(i))
    } else if (object instanceof PDFRawStream) visit(object.dict)
  }
  // Includes indirect annotation parents and nested direct dictionaries.
  visit(document.catalog)
  for (const [, object] of document.context.enumerateIndirectObjects()) visit(object)
  document.catalog.delete(PDFName.of('AcroForm'))
}
