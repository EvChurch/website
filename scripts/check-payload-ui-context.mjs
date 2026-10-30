import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire, registerHooks } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

// Ignore styles only. React, the installed providers and useNav execute unchanged.
registerHooks({
  load(url, context, nextLoad) {
    if (/\.(scss|css)$/.test(url)) {
      return { format: 'module', source: 'export default {}', shortCircuit: true }
    }
    return nextLoad(url, context)
  },
})

const require = createRequire(join(process.cwd(), 'package.json'))
const appUI = require.resolve('@payloadcms/ui')
const nextRequire = createRequire(require.resolve('@payloadcms/next/routes'))
const nextUI = nextRequire.resolve('@payloadcms/ui')
function uiRoot(entry) {
  let directory = dirname(entry)
  while (true) {
    try {
      const metadata = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
      if (metadata.name === '@payloadcms/ui') return directory
    } catch { /* Walk up from the published client entry. */ }
    const parent = dirname(directory)
    assert.notEqual(parent, directory, 'Installed UI package root must exist')
    directory = parent
  }
}
const appMetadata = JSON.parse(readFileSync(join(uiRoot(appUI), 'package.json'), 'utf8'))
const coreMetadata = JSON.parse(readFileSync(join(dirname(require.resolve('payload')), '../package.json'), 'utf8'))
assert.equal(appMetadata.peerDependencies.payload, coreMetadata.version, 'UI must support the installed Payload core')
const { NavContext } = await import(pathToFileURL(join(uiRoot(nextUI), 'dist/elements/Nav/context.js')))
const appNav = await import(pathToFileURL(join(uiRoot(appUI), 'dist/elements/Nav/context.js')))
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const setNavOpen = () => {}
function Consumer() {
  const nav = appNav.useNav()
  assert.equal(nav.setNavOpen, setNavOpen, 'Application consumer must receive the Next provider callback')
  return React.createElement('span', null, String(nav.navOpen))
}
const html = renderToStaticMarkup(React.createElement(NavContext.Provider,
  { value: { navOpen: false, setNavOpen } }, React.createElement(Consumer)))
assert.equal(html, '<span>false</span>', 'Application useNav must receive Next provider state')
assert.equal(appNav.NavContext, NavContext, 'Application and Next must share the installed Nav context')
console.log(`Payload ${coreMetadata.version}, UI ${appMetadata.version}: shared context and consumer state/callback verified`)
