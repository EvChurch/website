#!/usr/bin/env node
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const currentEnvPath = resolve(repoRoot, '.env.local')

function parseArgs(argv) {
  const options = {
    port: '3000',
    recreate: false,
    sourceEnv: null,
    databaseName: null,
    siteUrl: null,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--recreate') {
      options.recreate = true
    } else if (arg === '--port') {
      options.port = argv[++index]
    } else if (arg === '--source-env') {
      options.sourceEnv = argv[++index]
    } else if (arg === '--database') {
      options.databaseName = argv[++index]
    } else if (arg === '--site-url') {
      options.siteUrl = argv[++index]
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!/^\d+$/.test(options.port)) {
    throw new Error('--port must be a number')
  }
  if (options.siteUrl) {
    const url = new URL(options.siteUrl)
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('--site-url must be an HTTP or HTTPS URL')
    }
  }

  return options
}

function command(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
  })

  if (result.status !== 0) {
    const detail = options.capture ? result.stderr || result.stdout : ''
    throw new Error(
      `${commandName} ${args.join(' ')} failed${detail ? `\n${detail}` : ''}`,
    )
  }

  return result.stdout?.trim() ?? ''
}

async function exists(path) {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

function readEnvValue(contents, key) {
  const line = contents
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith(`${key}=`))

  return line ? line.slice(key.length + 1) : null
}

function setEnvValue(contents, key, value) {
  const line = `${key}=${value}`
  const pattern = new RegExp(`^${key}=.*$`, 'm')

  if (pattern.test(contents)) {
    return contents.replace(pattern, line)
  }

  return `${contents.replace(/\s*$/, '')}\n${line}\n`
}

function databaseFromUrl(databaseUrl) {
  const url = new URL(databaseUrl)
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''))

  if (!database) {
    throw new Error('DATABASE_URL must include a database name')
  }

  return database
}

function withDatabase(databaseUrl, databaseName) {
  const url = new URL(databaseUrl)
  url.pathname = `/${databaseName}`
  return url.toString()
}

function allowedDevOrigin(siteUrl) {
  return new URL(siteUrl).host
}

function worktreeSuffix() {
  const parts = repoRoot.split('/')
  const worktreeIndex = parts.lastIndexOf('worktrees')

  if (worktreeIndex >= 0 && parts[worktreeIndex + 1]) {
    return parts[worktreeIndex + 1]
  }

  const branch = command('git', ['branch', '--show-current'], { capture: true })
  return branch || basename(repoRoot)
}

function isCurrentCodexWorktree() {
  const parts = repoRoot.split('/')
  const codexIndex = parts.lastIndexOf('.codex')
  return codexIndex >= 0 && parts[codexIndex + 1] === 'worktrees'
}

function safeDatabaseName(name) {
  const normalized = name.toLowerCase().replace(/[^a-z0-9_]+/g, '_')
  const collapsed = normalized.replace(/_+/g, '_').replace(/^_+|_+$/g, '')
  const prefixed = /^[a-z_]/.test(collapsed) ? collapsed : `db_${collapsed}`

  return prefixed.slice(0, 63)
}

function findMainWorktreeEnv() {
  const output = command('git', ['worktree', 'list', '--porcelain'], {
    capture: true,
  })
  const worktrees = output
    .split(/\n\n+/)
    .map((entry) => Object.fromEntries(
      entry
        .split(/\n/)
        .filter(Boolean)
        .map((line) => {
          const separator = line.indexOf(' ')
          return separator === -1
            ? [line, '']
            : [line.slice(0, separator), line.slice(separator + 1)]
        }),
    ))

  const candidates = [
    ...worktrees.filter(
      (worktree) =>
        worktree.worktree !== repoRoot && worktree.branch === 'refs/heads/main',
    ),
    ...worktrees.filter((worktree) => worktree.worktree !== repoRoot),
  ]

  for (const candidate of candidates) {
    if (candidate.worktree) {
      return resolve(candidate.worktree, '.env.local')
    }
  }

  return null
}

function databaseExists(databaseName) {
  const escapedDatabaseName = databaseName.replaceAll("'", "''")
  const output = command(
    'psql',
    [
      '-d',
      'postgres',
      '-Atqc',
      `select 1 from pg_database where datname = '${escapedDatabaseName}'`,
    ],
    { capture: true },
  )

  return output === '1'
}

function recreateDatabase(databaseName) {
  command('psql', [
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    `select pg_terminate_backend(pid) from pg_stat_activity where datname = '${databaseName.replaceAll("'", "''")}' and pid <> pg_backend_pid()`,
  ])
  command('dropdb', ['--if-exists', databaseName])
  command('createdb', [databaseName])
}

async function cloneDatabase(sourceUrl, targetUrl, targetDatabaseName) {
  const tempDir = await mkdtemp(join(tmpdir(), 'evchurch-worktree-db-'))
  const dumpPath = join(tempDir, 'source.dump')

  try {
    command('pg_dump', [
      '--format=custom',
      '--no-owner',
      '--no-privileges',
      '--file',
      dumpPath,
      sourceUrl,
    ])
    command('pg_restore', [
      '--no-owner',
      '--no-privileges',
      '--dbname',
      targetUrl,
      dumpPath,
    ])
  } catch (error) {
    command('dropdb', ['--if-exists', targetDatabaseName])
    throw error
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (!isCurrentCodexWorktree() && !options.databaseName) {
    throw new Error(
      'Refusing to auto-configure a database outside a Codex worktree. Pass --database to opt in explicitly.',
    )
  }

  const sourceEnvPath = options.sourceEnv
    ? resolve(options.sourceEnv)
    : findMainWorktreeEnv()

  if (!sourceEnvPath || !(await exists(sourceEnvPath))) {
    throw new Error('Could not find a source .env.local. Pass --source-env PATH.')
  }

  const sourceEnv = await readFile(sourceEnvPath, 'utf8')
  const currentEnv = await exists(currentEnvPath)
    ? await readFile(currentEnvPath, 'utf8')
    : null
  const sourceDatabaseUrl = readEnvValue(sourceEnv, 'DATABASE_URL')

  if (!sourceDatabaseUrl) {
    throw new Error(`${sourceEnvPath} does not define DATABASE_URL`)
  }

  const sourceDatabase = databaseFromUrl(sourceDatabaseUrl)
  const databaseName =
    options.databaseName ??
    safeDatabaseName(`${sourceDatabase}_wt_${worktreeSuffix()}`)
  const targetDatabaseUrl = withDatabase(sourceDatabaseUrl, databaseName)
  const targetExists = databaseExists(databaseName)

  if (targetExists && !options.recreate) {
    console.log(`Using existing worktree database ${databaseName}`)
  } else {
    if (targetExists) {
      console.log(`Replacing existing worktree database ${databaseName}`)
    } else {
      console.log(`Creating worktree database ${databaseName}`)
    }
    recreateDatabase(databaseName)
    console.log(`Cloning ${sourceDatabase} into ${databaseName}`)
    await cloneDatabase(sourceDatabaseUrl, targetDatabaseUrl, databaseName)
  }

  let targetEnv = sourceEnv
  targetEnv = setEnvValue(targetEnv, 'DATABASE_URL', targetDatabaseUrl)
  const siteUrl =
    options.siteUrl ??
    (currentEnv ? readEnvValue(currentEnv, 'NEXT_PUBLIC_SITE_URL') : null) ??
    `http://localhost:${options.port}`
  targetEnv = setEnvValue(targetEnv, 'NEXT_PUBLIC_SITE_URL', siteUrl)
  targetEnv = setEnvValue(targetEnv, 'APP_BASE_URL', siteUrl)
  targetEnv = setEnvValue(targetEnv, 'NEXT_ALLOWED_DEV_ORIGINS', allowedDevOrigin(siteUrl))

  await writeFile(currentEnvPath, targetEnv)

  console.log(`Wrote ${currentEnvPath}`)
  console.log(`DATABASE_URL targets ${databaseName}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
