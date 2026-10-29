import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const swaggerDirectory: string = require('swagger-ui-dist/absolute-path.js')()
export const apiSpecifications = [
  { name: 'API v1', url: '/api/v1/openapi.json' },
]
const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
}
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive"><title>Ev Church API documentation</title>
<link rel="stylesheet" href="/api/v1/docs/swagger-ui.css"></head>
<body><div id="swagger-ui"></div><noscript>Enable JavaScript to view Swagger UI. <a href="/api/v1/openapi.json">Download the OpenAPI specification</a>.</noscript>
<script src="/api/v1/docs/swagger-ui-bundle.js" defer></script>
<script src="/api/v1/docs/swagger-ui-standalone-preset.js" defer></script>
<script src="/api/v1/docs/swagger-initializer.js" defer></script></body></html>`
const initializer = `window.ui = SwaggerUIBundle(${JSON.stringify({
  urls: apiSpecifications,
  dom_id: '#swagger-ui',
  deepLinking: true,
  displayRequestDuration: true,
  showExtensions: true,
  persistAuthorization: false,
  queryConfigEnabled: false,
  validatorUrl: null,
  layout: 'StandaloneLayout',
}).replace(/}$/, ',presets:[SwaggerUIBundle.presets.apis,SwaggerUIStandalonePreset]}')});`

const assets = new Map([
  ['swagger-ui.css', 'text/css; charset=utf-8'],
  ['swagger-ui-bundle.js', 'text/javascript; charset=utf-8'],
  ['swagger-ui-standalone-preset.js', 'text/javascript; charset=utf-8'],
])
export async function apiDocumentation(path: string[] = []) {
  if (!path.length) return new Response(html, { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } })
  if (path.length === 1 && path[0] === 'swagger-initializer.js') return new Response(initializer, { headers: { ...headers, 'Content-Type': 'text/javascript; charset=utf-8' } })
  const contentType = path.length === 1 && assets.get(path[0])
  if (!contentType) return new Response('Not found', { status: 404, headers })
  const body = await readFile(join(swaggerDirectory, path[0]))
  return new Response(new Uint8Array(body), { headers: { ...headers, 'Content-Type': contentType, 'Cache-Control': 'public, max-age=0, must-revalidate' } })
}
