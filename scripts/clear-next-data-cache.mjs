import { rmSync } from 'node:fs'
import { resolve } from 'node:path'

const dataCachePath = resolve(process.cwd(), '.next/cache/fetch-cache')

rmSync(dataCachePath, { recursive: true, force: true })
console.log('Cleared persisted Next.js data cache before prerendering')
