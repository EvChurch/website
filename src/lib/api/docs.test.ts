import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { apiDocumentation, apiSpecifications } from './docs'

describe('Swagger documentation', () => {
  it('serves a public docs page and local Swagger assets', async () => {
    const response = await apiDocumentation()
    const html = await response.text()
    expect(response.headers.get('Content-Type')).toContain('text/html')
    expect(response.headers.get('X-Robots-Tag')).toContain('noindex')
    expect(response.headers.get('Content-Security-Policy')).toContain("connect-src 'self'")
    expect(html).toContain('Ev Church API documentation')
    for (const path of ['swagger-ui.css', 'swagger-ui-bundle.js', 'swagger-ui-standalone-preset.js']) {
      expect(html).toContain(`/api/v1/docs/${path}`)
      const asset = await apiDocumentation([path])
      expect(asset.status).toBe(200)
      expect((await asset.text()).length).toBeGreaterThan(1000)
    }
  })
  it('loads the existing specification without persisting keys or external validation', async () => {
    const bundle = Object.assign(vi.fn(), { presets: { apis: {} } })
    const standalone = {}
    runInNewContext(await (await apiDocumentation(['swagger-initializer.js'])).text(), {window:{}, SwaggerUIBundle:bundle, SwaggerUIStandalonePreset:standalone})
    expect(bundle).toHaveBeenCalledWith(expect.objectContaining({urls:apiSpecifications, persistAuthorization:false, queryConfigEnabled:false, validatorUrl:null, presets:[bundle.presets.apis,standalone]}))
  })
  it.each([['package.json'],['swagger-ui-bundle.js.map'],['..','package.json'],['missing.js']])('only exposes the allowed asset paths: %s', async (...path) => {
    expect((await apiDocumentation(path)).status).toBe(404)
  })
})
