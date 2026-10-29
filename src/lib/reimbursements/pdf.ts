import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument, rgb, type PDFPage } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import sharp from 'sharp'
import type { Pool } from 'pg'
import { actionLabels, rejectedExpenseSummary, gstMinor, money, reportNumber, statusLabels, type Category, type Report } from './model'
import { assertFinalPdfBudget, assertReceiptBudget, receiptLimits, stripPdfActions, validateReceipt } from './receipts'

export interface ReportReceipt { hash: string; body: Buffer; mediaType: string }

/** Call only after the caller has authorised access to the report. */
export async function loadReportReceipts(pool: Pick<Pool, 'query'>, report: Report): Promise<ReportReceipt[]> {
  const hashes = [...new Set(report.lines.flatMap(line => line.receiptHash ? [line.receiptHash] : []))]
  if (!hashes.length) return []
  // Check byte counts without first bringing unbounded receipt bodies into memory.
  const sizes = await pool.query<{ hash: string; bytes: number }>(
    'SELECT hash,octet_length(body) AS bytes FROM reimbursement_receipts WHERE hash=ANY($1::text[])', [hashes],
  )
  assertReceiptBudget(sizes.rows.reduce((sum, row) => sum + row.bytes, 0), 0)
  const result = await pool.query<{ hash: string; body: Buffer; media_type: string }>(
    'SELECT hash,body,media_type FROM reimbursement_receipts WHERE hash=ANY($1::text[])', [hashes],
  )
  return hashes.map(hash => {
    const row = result.rows.find(row => row.hash === hash)
    if (!row) throw new Error('A receipt for this expense report could not be loaded.')
    return { hash, body: row.body, mediaType: row.media_type }
  })
}

let fontBytes: Promise<Buffer> | undefined
let logoBytes: Promise<Buffer> | undefined

export async function buildReportPdf(report: Report, categories: Category[], bank: boolean, receipts: ReportReceipt[] = [], budget: 'email' | 'submission' = 'email') {
  const uniqueReceipts = [...new Set(report.lines.flatMap(line => line.receiptHash ? [line.receiptHash] : []))].map((hash, index) => {
    const receipt = receipts.find(receipt => receipt.hash === hash)
    if (!receipt) throw new Error(`Receipt ${index + 1} could not be included in the PDF.`)
    return receipt
  })
  assertReceiptBudget(uniqueReceipts.reduce((sum, receipt) => sum + receipt.body.length, 0), 0)
  let receiptPages = 0
  for (const receipt of uniqueReceipts) {
    receiptPages += (await validateReceipt(receipt.body, receipt.mediaType)).pages
    assertReceiptBudget(0, receiptPages)
  }
  const document = await PDFDocument.create()
  document.registerFontkit(fontkit)
  fontBytes ??= readFile(path.join(process.cwd(), 'src/lib/reimbursements/assets/DejaVuSans.ttf'))
  logoBytes ??= readFile(path.join(process.cwd(), 'public/images/global/ev-church-logo.png'))
  const font = await document.embedFont(await fontBytes, { subset: true })
  const logo = await document.embedPng(await logoBytes)
  const ink = rgb(0.059, 0, 0.016), muted = rgb(0.43, 0.40, 0.41), red = rgb(0.886, 0.165, 0.188)
  const rule = rgb(0.88, 0.86, 0.84), warm = rgb(0.98, 0.97, 0.95)
  const left = 42, right = 553, width = right - left
  const clean = (value: string) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/gu, '')
  function text(page: PDFPage, value: string, x: number, y: number, size = 9, color = ink) {
    page.drawText(clean(value), { x, y, size, font, color })
  }
  function aligned(page: PDFPage, value: string, x: number, y: number, size = 9, color = ink) {
    text(page, value, x - font.widthOfTextAtSize(value, size), y, size, color)
  }
  const widths = new Map<string, number>()
  function measure(value: string, size: number) {
    const key = `${size}:${value}`
    let result = widths.get(key)
    if (result === undefined) { result = font.widthOfTextAtSize(value, size); widths.set(key, result) }
    return result
  }
  function wrap(value: string, maxWidth: number, size = 9) {
    const lines: string[] = []
    for (const paragraph of clean(value).split('\n')) {
      let line = '', lineWidth = 0
      for (const word of paragraph.split(/\s+/u)) {
        if (measure(word, size) > maxWidth) {
          if (line) { lines.push(line); line = ''; lineWidth = 0 }
          for (const character of word) {
            const charWidth = measure(character, size)
            if (lineWidth + charWidth > maxWidth) { lines.push(line); line = ''; lineWidth = 0 }
            line += character; lineWidth += charWidth
          }
          continue
        }
        const nextWidth = measure(word, size) + (line ? measure(' ', size) : 0)
        if (line && lineWidth + nextWidth > maxWidth) { lines.push(line); line = ''; lineWidth = 0 }
        if (line) { line += ' '; lineWidth += measure(' ', size) }
        line += word; lineWidth += measure(word, size)
      }
      lines.push(line)
    }
    return lines
  }
  function header(title: string, subtitle: string) {
    const page = document.addPage([595, 842])
    page.drawImage(logo, { x: left, y: 758, width: 42, height: 42 })
    aligned(page, reportNumber(report.number), right, 785, 11)
    aligned(page, subtitle, right, 766, 9, muted)
    text(page, title, left, 721, 24)
    page.drawLine({ start: { x: left, y: 700 }, end: { x: right, y: 700 }, thickness: 1, color: rule })
    return page
  }
  const title = report.status === 'paid' ? 'Remittance advice' : 'Expense report'
  let page = header(title, statusLabels[report.status]), y = 674
  function detail(label: string, value: string) {
    const lines = wrap(value, 365, 10)
    text(page, label, left, y, 9, muted)
    lines.forEach((line, i) => text(page, line, 175, y - i * 15, 10))
    y -= Math.max(1, lines.length) * 15 + 9
  }
  detail('Claimant', report.claimantName)
  detail('Purpose', report.centreName)
  detail('Campus', report.campusName || 'Not recorded')
  if (bank) {
    detail('Account holder', report.accountName)
    detail('Account number', report.accountNumber)
  }
  y -= 14
  const uniqueHashes = [...new Set(report.lines.flatMap(line => line.receiptHash ? [line.receiptHash] : []))]
  function tableHead() {
    page.drawRectangle({ x: left, y: y - 11, width, height: 28, color: warm })
    text(page, 'Date', left + 8, y, 9, muted)
    text(page, 'Expense', 115, y, 9, muted)
    aligned(page, 'Net', 411, y, 9, muted)
    aligned(page, 'GST', 471, y, 9, muted)
    aligned(page, 'Gross', right - 8, y, 9, muted)
    y -= 34
  }
  tableHead()
  function nextSummaryPage() { page = header(`${title} (continued)`, statusLabels[report.status]); y = 671; tableHead() }
  let total = 0, tax = 0
  for (const [index, line] of report.lines.entries()) {
    const amount = line.amountMinor ?? 0, gst = gstMinor(amount, line.hasGst)
    total += amount; tax += gst
    const category = line.categoryName || categories.find(category => category.id === line.categoryId)?.name || 'Unclassified'
    const content = [
      ...wrap(`${index + 1}. ${category}`, 214),
      ...wrap(`Expense reason: ${line.description}`, 214),
      ...(line.receiptHash ? [`Receipt ${uniqueHashes.indexOf(line.receiptHash) + 1}${line.hasGst ? '' : ' · No GST'}`] : [line.hasGst ? 'No receipt' : 'No receipt · No GST']),
    ]
    let offset = 0
    while (offset < content.length) {
      if (y < 110) nextSummaryPage()
      const count = Math.min(content.length - offset, Math.max(1, Math.floor((y - 78) / 14)))
      if (offset === 0) {
        text(page, line.date, left + 8, y, 8)
        aligned(page, money(amount - gst), 411, y, 9)
        aligned(page, money(gst), 471, y, 9)
        aligned(page, money(amount), right - 8, y, 9)
      }
      content.slice(offset, offset + count).forEach((value, i) => text(page, value, 115, y - i * 14, 9, offset + i === 0 ? ink : muted))
      y -= count * 14 + 16
      page.drawLine({ start: { x: left, y: y + 12 }, end: { x: right, y: y + 12 }, thickness: 0.5, color: rule })
      offset += count
    }
  }
  if (y < 170) nextSummaryPage()
  y -= 8
  text(page, 'Totals (NZD)', left + 8, y, 10)
  aligned(page, money(total - tax), 411, y, 10)
  aligned(page, money(tax), 471, y, 10)
  aligned(page, money(total), right - 8, y, 10)
  y -= 52
  text(page, 'Total reimbursement', left, y, 12)
  aligned(page, `${money(total)} NZD`, right, y, 21, red)
  if (report.history.length) {
    y -= 44
    const activityHead = () => {
      text(page, 'Activity', left, y, 13); y -= 28
      text(page, 'Date / time (NZ)', left + 8, y, 8, muted)
      text(page, 'Person', 194, y, 8, muted)
      text(page, 'Action', 345, y, 8, muted); y -= 23
    }
    if (y < 135) { page = header('Report activity', reportNumber(report.number)); y = 671 }
    activityHead()
    for (const item of report.history) {
      const date = new Date(item.at).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland', dateStyle: 'short', timeStyle: 'short' })
      const columns = [wrap(date, 132, 8), wrap(item.name, 135, 8), wrap(`${(actionLabels[item.action] ?? item.action) + (item.apiKey ? ` via API — ${item.apiKey.name}` : '')}${item.reason ? `: ${item.reason}` : ''}${rejectedExpenseSummary(item) ? ` — ${rejectedExpenseSummary(item)}` : ''}`, 200, 8)]
      let offset = 0
      const length = Math.max(...columns.map(column => column.length))
      while (offset < length) {
        if (y < 100) { page = header('Report activity (continued)', reportNumber(report.number)); y = 671; activityHead() }
        const count = Math.min(length - offset, Math.max(1, Math.floor((y - 74) / 13)))
        columns.forEach((column, c) => column.slice(offset, offset + count).forEach((value, i) => text(page, value, [left + 8, 194, 345][c], y - i * 13, 8)))
        y -= count * 13 + 14
        page.drawLine({ start: { x: left, y: y + 12 }, end: { x: right, y: y + 12 }, thickness: 0.5, color: rule })
        offset += count
      }
    }
  }
  // Only report pages receive our footer. Receipt pages retain their original presentation.
  const reportPages = document.getPages()
  for (const [i, p] of reportPages.entries()) {
    p.drawLine({ start: { x: left, y: 45 }, end: { x: right, y: 45 }, thickness: 0.5, color: rule })
    text(p, `Ev Church · ${reportNumber(report.number)}`, left, 29, 8, muted)
    aligned(p, `${i + 1} / ${reportPages.length}`, right, 29, 8, muted)
  }
  // Shared files appear once, in the same order as the summary's receipt references.
  for (const [index, hash] of uniqueHashes.entries()) {
    const receipt = receipts.find(receipt => receipt.hash === hash)
    if (!receipt) throw new Error(`Receipt ${index + 1} could not be included in the PDF.`)
    if (receipt.mediaType === 'application/pdf') {
      const source = await PDFDocument.load(receipt.body)
      stripPdfActions(source)
      const pages = await document.copyPages(source, source.getPageIndices())
      pages.forEach(page => document.addPage(page))
    } else {
      const imageBytes = await sharp(receipt.body, { limitInputPixels: receiptLimits.imagePixels, failOn: 'warning' }).rotate().resize({ width: 2400, height: 3200, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 88 }).toBuffer()
      const image = await document.embedJpg(imageBytes)
      const scale = Math.min(595 / image.width, 842 / image.height)
      const target = document.addPage([image.width * scale, image.height * scale])
      target.drawImage(image, { x: 0, y: 0, width: image.width * scale, height: image.height * scale })
    }
  }
  document.setTitle(`${reportNumber(report.number)} ${title.toLowerCase()}`)
  assertFinalPdfBudget(0, document.getPageCount(), budget === 'submission')
  const bytes = Buffer.from(await document.save())
  assertFinalPdfBudget(bytes.length, document.getPageCount(), budget === 'submission')
  return bytes
}
