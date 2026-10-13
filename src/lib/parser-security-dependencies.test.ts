// @vitest-environment happy-dom

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

const payloadRequire = createRequire(import.meta.resolve('payload'))
const schemaRequire = createRequire(payloadRequire.resolve('json-schema-to-typescript'))
const videoRequire = createRequire(import.meta.resolve('video.js'))
const streamingRequire = createRequire(videoRequire.resolve('@videojs/http-streaming'))
const manifestRequire = createRequire(streamingRequire.resolve('mpd-parser'))

interface XMLDocument {
  createEntityReference: (name: string) => unknown
}
interface XMLDOM {
  DOMImplementation: new () => {
    createDocument: (namespace: string, name: string, doctype: null) => XMLDocument
    createDocumentType: (name: string, publicId: string, systemId: string) => unknown
  }
  XMLSerializer: new () => {
    serializeToString: (node: unknown, html?: boolean, filter?: undefined, options?: { requireWellFormed: boolean }) => string
  }
}

function assertXMLContracts(dom: XMLDOM) {
  const implementation = new dom.DOMImplementation()
  const document = implementation.createDocument('', 'root', null)
  const serializer = new dom.XMLSerializer()
  expect(serializer.serializeToString(document)).toBe('<root/>')
  expect(() => document.createEntityReference('bad><injected')).toThrow()
  const doctype = implementation.createDocumentType('bad><injected', '', '')
  expect(() => serializer.serializeToString(doctype, false, undefined, { requireWellFormed: true })).toThrow()
}

describe('resolved and shipped parser security', () => {
  it('counts empty YAML merge sources against the configured work limit', () => {
    const yaml: { load: (source: string, options?: { maxTotalMergeKeys: number }) => unknown } = schemaRequire('js-yaml')
    expect(yaml.load('campus: Auckland')).toEqual({ campus: 'Auckland' })
    expect(() => yaml.load('empty: &empty {}\nmerged:\n  <<: [*empty, *empty, *empty]\n', { maxTotalMergeKeys: 2 })).toThrow(/maxTotalMergeKeys/)
  })

  it('rejects XML name injection in the parser actually used by DASH manifests', () => {
    assertXMLContracts(manifestRequire('@xmldom/xmldom'))
  })

  it('also rejects injection in the XML parser embedded in the Video.js browser distribution', () => {
    const bundle = readFileSync(videoRequire.resolve('video.js/dist/video.js'), 'utf8')
    // The browser distribution embeds xmldom, independently of the native lock.
    // Expose that closure only inside this isolated VM to exercise its real code.
    const marker = '  return videojs;'
    expect(bundle.split(marker)).toHaveLength(2)
    const module: { exports: { securityDOM?: XMLDOM } } = { exports: {} }
    runInNewContext(bundle.replace(marker, '  videojs.securityDOM = dom;\n' + marker), {
      module, exports: module.exports, window, document, navigator,
      console, setTimeout, clearTimeout, setInterval, clearInterval,
    }, { timeout: 5000 })
    expect(module.exports.securityDOM).toBeDefined()
    assertXMLContracts(module.exports.securityDOM!)
  })
})
