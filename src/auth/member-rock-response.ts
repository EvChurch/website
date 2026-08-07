export async function readBoundedResponseBody(
  response: Response,
  maxBytes: number,
): Promise<Uint8Array<ArrayBuffer> | null> {
  const declaredLength = response.headers.get('content-length')
  if (
    declaredLength &&
    (!/^\d+$/u.test(declaredLength) || Number(declaredLength) > maxBytes)
  ) {
    await response.body?.cancel()
    return null
  }
  if (!response.body) return null

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }

  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}
