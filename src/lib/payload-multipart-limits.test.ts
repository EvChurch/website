import { describe, expect, it } from 'vitest'

interface MultipartResult { files?: Record<string, { size: number }> }
interface MultipartParser {
  processMultipartFormdata: (args: { request: Request; options: object }) => Promise<MultipartResult>
}
const multipart: MultipartParser = await import(new URL('./uploads/fetchAPI-multipart/index.js', import.meta.resolve('payload')).href)

function upload(...sizes: number[]) {
  const boundary = 'synthetic-pr350-boundary'
  const chunks: Uint8Array[] = []
  const encode = (value: string) => new TextEncoder().encode(value)
  sizes.forEach((size, index) => {
    chunks.push(encode(`--${boundary}\r\nContent-Disposition: form-data; name="file${index}"; filename="synthetic-${index}.wav"\r\nContent-Type: audio/wav\r\n\r\n`))
    for (let remaining = size; remaining > 0; remaining -= 64 * 1024) chunks.push(new Uint8Array(Math.min(remaining, 64 * 1024)))
    chunks.push(encode('\r\n'))
  })
  chunks.push(encode(`--${boundary}--\r\n`))
  let index = 0
  // A native pull stream supports immediate cancellation when the parser
  // reaches a limit; there is no asynchronous FormData producer to keep writing.
  const body = new ReadableStream<Uint8Array>({ pull(controller) {
    if (index < chunks.length) controller.enqueue(chunks[index++])
    else controller.close()
  } })
  const options = { method: 'POST', headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` }, body, duplex: 'half' }
  return new Request('http://127.0.0.1/synthetic-upload', options)
}

describe('Payload multipart defaults used by manual audio uploads', () => {
  it('accepts a small synthetic audio file without limit overrides', async () => {
    const result = await multipart.processMultipartFormdata({ request: upload(1024), options: {} })
    expect(result.files?.file0.size).toBe(1024)
  })

  it('rejects an individual file above the upstream 20 MiB default', async () => {
    await expect(multipart.processMultipartFormdata({ request: upload(21 * 1024 * 1024), options: {} })).rejects.toMatchObject({ status: 413 })
  })

  it('rejects total multipart bytes above 50 MiB even with each file below 20 MiB', async () => {
    await expect(multipart.processMultipartFormdata({ request: upload(...Array<number>(3).fill(17 * 1024 * 1024)), options: {} })).rejects.toMatchObject({ status: 413, message: 'Multipart request size limit has been reached' })
  })
})
