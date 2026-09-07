import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

// This client only moves durable jobs between Payload and the scheduled Codex task.
// Drafting runs in Codex, without an AI-provider API key on the website.
const setup = path.join(os.homedir(), '.codex', 'sermon-setup')
const config = JSON.parse(await readFile(process.env.SERMON_ARTICLE_WORKER_CONFIG || path.join(setup, 'article-worker.json'), 'utf8'))
const base = new URL(config.origin)
if (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname)) throw new Error('Use HTTPS for the article worker.')
if (typeof config.token !== 'string' || config.token.length < 32) throw new Error('Article worker token is missing.')
const endpoint = new URL('/api/sermon-articles/worker', base)
async function call(body, binary = false) {
  const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(120_000), redirect: 'error' })
  if (!response.ok) throw new Error(`Article worker returned HTTP ${response.status}.`)
  return binary ? Buffer.from(await response.arrayBuffer()) : response.json()
}
const [action, jobPath, input] = process.argv.slice(2)
try {
  if (action === 'claim') {
    const result = await call({ action })
    if (!result.article) { console.log('No articles are waiting for drafting.'); process.exit(0) }
    const directory = path.join(setup, 'articles', String(result.article.id))
    await mkdir(directory, { recursive: true, mode: 0o700 })
    await writeFile(path.join(directory, 'job.json'), JSON.stringify(result, null, 2), { mode: 0o600 })
    console.log(`Claim saved to ${path.join(directory, 'job.json')}. Read its instructions and transcript, then save draft.json beside it. Submit with: node scripts/sermon-article-worker.mjs submit <job.json> <draft.json>`)
  } else if (['submit', 'scripture', 'audio'].includes(action)) {
    const { article } = JSON.parse(await readFile(jobPath, 'utf8'))
    const body = { action, id: article.id, leaseToken: article.leaseToken }
    if (action === 'submit') {
      const draft = JSON.parse(await readFile(input, 'utf8'))
      const result = await call({ ...body, blocks: draft.blocks, questions: draft.questions })
      console.log(`Article ${article.id}: ${result.status}. Payload will email the preacher automatically.`)
    } else if (action === 'scripture') console.log(JSON.stringify(await call({ ...body, reference: input }), null, 2))
    else {
      const destination = path.join(path.dirname(jobPath), 'sermon.mp3')
      await writeFile(destination, await call(body, true), { mode: 0o600 })
      console.log(`Audio saved to ${destination}`)
    }
  } else throw new Error('Use claim, submit <job.json> <draft.json>, scripture <job.json> <reference>, or audio <job.json>.')
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Article worker failed.')
  process.exitCode = 1
}
