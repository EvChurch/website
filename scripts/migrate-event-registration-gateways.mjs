import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'

// One-off migration authorised for the cancelled Simple Donation event gateway.
// Dry-run by default. Supply production credentials through the environment.
const APPLY = process.argv.includes('--apply')
const API = process.env.ROCK_API_URL?.replace(/\/$/, '')
assert.equal(API, 'https://rock.ev.church/api', 'Unexpected target Rock database')
assert.ok(process.env.ROCK_API_KEY, 'ROCK_API_KEY is required')
const SOURCE = 5
const TARGET = 6
const TEMPLATE_IDS = [9, 10, 12, 13, 14, 15, 16, 18, 22, 24, 27, 29, 30]

async function request(path, { params = {}, body } = {}) {
  const url = new URL(`${API}/${path}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  const response = await fetch(url, {
    method: body ? 'PATCH' : 'GET',
    headers: {
      'Authorization-Token': process.env.ROCK_API_KEY,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30_000),
  })
  // Do not log provider bodies, credentials, registrations or payment tokens.
  assert.ok(response.ok, `${path}: HTTP ${response.status}`)
  const text = await response.text()
  return text ? JSON.parse(text) : undefined
}

async function all(path, params = {}) {
  const records = []
  const seen = new Set()
  for (let skip = 0; ; skip += 100) {
    const page = await request(path, { params: { ...params, $top: '100', $skip: String(skip), $orderby: 'Id' } })
    assert.ok(Array.isArray(page), `Expected collection: ${path}`)
    for (const record of page) {
      assert.ok(!seen.has(record.Id), `Pagination did not advance: ${path}`)
      seen.add(record.Id)
      records.push(record)
    }
    if (page.length < 100) return records
  }
}

const source = await request(`FinancialGateways/${SOURCE}`)
const target = await request(`FinancialGateways/${TARGET}`)
const component = await request(`EntityTypes/${target.EntityTypeId}`)
assert.equal(source.Name, 'Simple Donation')
assert.equal(target.IsActive, true)
assert.equal(component.Name, 'EvChurch.Rock.BlinkPay.Gateway')
assert.equal((await all('FinancialScheduledTransactions', {
  $filter: `FinancialGatewayId eq ${SOURCE} and IsActive eq true`,
})).length, 0, 'Active Simple Donation schedules need separate review before retiring the gateway')

const templates = await all('RegistrationTemplates')
const instances = await all('RegistrationInstances')
assert.ok(templates.filter(t => t.FinancialGatewayId === SOURCE).every(t => TEMPLATE_IDS.includes(t.Id)),
  'Additional Simple Donation templates need review')
for (const id of TEMPLATE_IDS) {
  const template = templates.find(t => t.Id === id)
  assert.ok(template, `Missing template ${id}`)
  assert.ok([SOURCE, TARGET].includes(template.FinancialGatewayId), `Template ${id} gateway changed`)
  assert.equal(template.IsPaymentPlanAllowed, false, `Template ${id} requires unsupported scheduled payments`)
}

const blinkTemplates = new Set(templates.filter(t => t.FinancialGatewayId === TARGET).map(t => t.Id))
const affectedTemplates = new Set([...TEMPLATE_IDS, ...blinkTemplates])
const changes = []
// Route first: the native redirect gateway requires both IDs to select connection 6.
// Include ended instances so their outstanding balances remain payable. Include
// existing BlinkPay templates whose instances were missing their redirect route.
for (const instance of instances.filter(i => affectedTemplates.has(i.RegistrationTemplateId))) {
  assert.ok([null, TARGET].includes(instance.ExternalGatewayMerchantId), `Instance ${instance.Id}: foreign merchant`)
  assert.ok([null, TARGET].includes(instance.ExternalGatewayFundId), `Instance ${instance.Id}: foreign route`)
  if (instance.ExternalGatewayMerchantId !== TARGET || instance.ExternalGatewayFundId !== TARGET) {
    changes.push({
      path: `RegistrationInstances/${instance.Id}`,
      name: instance.Name,
      before: { ExternalGatewayMerchantId: instance.ExternalGatewayMerchantId, ExternalGatewayFundId: instance.ExternalGatewayFundId },
      after: { ExternalGatewayMerchantId: TARGET, ExternalGatewayFundId: TARGET },
    })
  }
}
for (const template of templates.filter(t => TEMPLATE_IDS.includes(t.Id) && t.FinancialGatewayId === SOURCE)) {
  changes.push({ path: `RegistrationTemplates/${template.Id}`, name: template.Name,
    before: { FinancialGatewayId: SOURCE }, after: { FinancialGatewayId: TARGET } })
}
// Retain the gateway and historical transactions, but prevent new selection of
// the cancelled provider once all event templates and routes have been migrated.
if (source.IsActive) changes.push({ path: `FinancialGateways/${SOURCE}`, name: source.Name,
  before: { IsActive: true }, after: { IsActive: false } })
console.log(JSON.stringify({ target: API, apply: APPLY, templateCount: TEMPLATE_IDS.length,
  instanceCount: instances.filter(i => affectedTemplates.has(i.RegistrationTemplateId)).length, changes }, null, 2))

if (APPLY && changes.length) {
  assert.ok(process.env.ROCK_GATEWAY_MIGRATION_JOURNAL, 'Supply a private journal path before applying')
  await writeFile(process.env.ROCK_GATEWAY_MIGRATION_JOURNAL,
    JSON.stringify({ target: API, createdAt: new Date().toISOString(), changes }, null, 2), { flag: 'wx', mode: 0o600 })
  for (const change of changes) {
    const current = await request(change.path)
    for (const [key, value] of Object.entries(change.before)) assert.equal(current[key], value, `${change.path}: ${key} changed since audit`)
    await request(change.path, { body: change.after })
    const saved = await request(change.path)
    for (const [key, value] of Object.entries(change.after)) assert.equal(saved[key], value, `${change.path}: ${key} not saved`)
    // Verify every other returned field, excluding audit timestamps and unloaded relations.
    for (const [key, value] of Object.entries(current)) {
      if (key in change.after || /^(Modified|CreatedBy|ModifiedBy)/.test(key) || (value !== null && typeof value === 'object')) continue
      assert.deepEqual(saved[key], value, `${change.path}: unrelated ${key} changed`)
    }
    console.log(`Verified ${change.path}`)
  }
}

if (APPLY) {
  const savedTemplates = await all('RegistrationTemplates')
  assert.equal(savedTemplates.filter(t => t.FinancialGatewayId === SOURCE).length, 0, 'Simple Donation templates remain')
  const gatewayTemplateIds = new Set(savedTemplates.filter(t => t.FinancialGatewayId === TARGET).map(t => t.Id))
  const savedInstances = await all('RegistrationInstances')
  assert.ok(savedInstances.filter(i => gatewayTemplateIds.has(i.RegistrationTemplateId))
    .every(i => i.ExternalGatewayMerchantId === TARGET && i.ExternalGatewayFundId === TARGET), 'Missing BlinkPay route')
  assert.equal((await request(`FinancialGateways/${SOURCE}`)).IsActive, false, 'Cancelled gateway is still active')
  console.log('Verified: Simple Donation retired with no templates; every BlinkPay instance has its connection and route.')
}
