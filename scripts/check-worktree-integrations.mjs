#!/usr/bin/env node
import { access, readFile, stat } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const configPath = resolve(repoRoot, '.codex/config.toml')
const checks = []

async function exists(path) {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

function commandExists(command) {
  return spawnSync('bash', ['-lc', `command -v ${command}`], {
    encoding: 'utf8',
  }).status === 0
}

async function fileMode(path) {
  const info = await stat(path)
  return info.mode & 0o777
}

const config = await readFile(configPath, 'utf8')
const requiredConfigSnippets = [
  '[mcp_servers.ev_church_payload]',
  '[mcp_servers.ev_church_search_console]',
  '[mcp_servers.adloop]',
  'env_http_headers',
  'EV_CHURCH_PAYLOAD_MCP_AUTHORIZATION',
]

for (const snippet of requiredConfigSnippets) {
  checks.push({
    name: `.codex/config.toml contains ${snippet}`,
    ok: config.includes(snippet),
  })
}

for (const command of ['npx', 'adloop']) {
  checks.push({
    name: `${command} is available on PATH`,
    ok: commandExists(command),
  })
}

const adloopFiles = [
  `${process.env.HOME}/.adloop/config.yaml`,
  `${process.env.HOME}/.adloop/credentials.json`,
  `${process.env.HOME}/.adloop/token.json`,
]

for (const path of adloopFiles) {
  const present = await exists(path)
  checks.push({
    name: `${path} exists`,
    ok: present,
  })
  if (present) {
    const mode = await fileMode(path)
    checks.push({
      name: `${path} is not world-readable`,
      ok: (mode & 0o004) === 0,
    })
  }
}

let failed = 0
for (const check of checks) {
  if (!check.ok) failed += 1
  console.log(`${check.ok ? 'ok' : 'missing'} - ${check.name}`)
}

process.exitCode = failed > 0 ? 1 : 0
