import { createHmac, timingSafeEqual } from 'node:crypto'
import { APIError } from 'payload'

function same(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}
export function reviewToken(id: number, secret: string) {
  return `${id}.${createHmac('sha256', secret).update(`sermon-article-review:${id}`).digest('hex')}`
}
export function reviewID(token: string, secret: string) {
  const id = Number(token.split('.')[0])
  if (!Number.isSafeInteger(id) || id < 1 || !same(token, reviewToken(id, secret)))
    throw new APIError('This review link is invalid.', 404)
  return id
}
export function authorizeArticleWorker(request: Request) {
  const secret = process.env.SERMON_ARTICLE_WORKER_TOKEN
  if (!secret || secret.length < 32 || !same(request.headers.get('authorization') || '', `Bearer ${secret}`))
    throw new APIError('Unauthorized.', 401)
}
