'use client'
import { useEffect, useState } from 'react'
import { parseMoney, type Category, type Settings } from '@/lib/reimbursements/model'
import { reimbursementRequest } from '@/components/members/Reimbursements'
type SettingsData = { settings: Settings; categories: Category[] }
const inputClass = 'reimbursement-settings__input'
const buttonClass = 'reimbursement-settings__button'
const secondaryClass = 'reimbursement-settings__button reimbursement-settings__button--secondary'

export function ReimbursementSettings({ initialData }: { initialData: SettingsData }) {
  const [minimumAmount, setMinimumAmount] = useState((initialData.settings.minimumReportAmountMinor / 100).toFixed(2))
  const [settings, setSettings] = useState(initialData.settings)
  const [categories, setCategories] = useState<Array<Omit<Category, 'id'> & { id?: number }>>(initialData.categories)
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false)
  return <section className="reimbursement-settings"><h1>Reimbursement settings</h1>
    <label className="block">Minimum report amount (NZD)<input type="number" min="0" max="1000000" step="0.01" className={inputClass} value={minimumAmount} onChange={event => setMinimumAmount(event.target.value)} /></label>
    <p className="text-sm text-mid-grey">Reports must reach this total including GST before submission. Drafts can be saved below this amount.</p>
    <label className="block">Finance notification email<input type="email" className={inputClass} value={settings.financeEmail} onChange={event => setSettings({ ...settings, financeEmail: event.target.value })} /></label>
    <p className="text-sm text-mid-grey">Finance access is controlled by current Rock finance security-group membership. These fallback people handle claims where the purpose approver is the claimant.</p>
    <RockPersonPicker label="Senior pastor" name={settings.seniorName} onSelect={person => setSettings({ ...settings, seniorPersonId: person.id, seniorName: person.name, seniorEmail: person.email })} />
    <RockPersonPicker label="Alternate approver for the senior pastor" name={settings.alternateName} onSelect={person => setSettings({ ...settings, alternatePersonId: person.id, alternateName: person.name, alternateEmail: person.email })} />
    <h3 className="text-xl">Expense categories</h3><p className="text-sm text-mid-grey">Add categories or archive those that are no longer needed.</p>
    {categories.map((category, index) => <div key={category.id ?? `new-${index}`} className="reimbursement-settings__category"><label>Name<input className={inputClass} value={category.name} onChange={event => setCategories(items => items.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} /></label><label className="reimbursement-settings__archive"><input type="checkbox" checked={category.archived} onChange={event => setCategories(items => items.map((item, i) => i === index ? { ...item, archived: event.target.checked } : item))} />Archived</label></div>)}
    <div className="reimbursement-settings__actions"><button className={secondaryClass} onClick={() => setCategories([...categories, { name: '', archived: false }])}>Add category</button><button className={buttonClass} disabled={busy} onClick={async () => { setBusy(true); setMessage(''); try { const minimumReportAmountMinor = parseMoney(minimumAmount); if (minimumReportAmountMinor === null) throw new Error('Enter a valid minimum report amount with up to two decimal places.'); await reimbursementRequest('/settings', 'PUT', { settings: { ...settings, minimumReportAmountMinor }, categories }); const next = await reimbursementRequest<SettingsData>('/settings'); setSettings(next.settings); setMinimumAmount((next.settings.minimumReportAmountMinor / 100).toFixed(2)); setCategories(next.categories); setMessage('Settings saved.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save.') } finally { setBusy(false) } }}>Save settings</button></div>
    <p role="status">{message}</p>
  </section>
}
function RockPersonPicker({ label, name, onSelect }: { label: string; name: string; onSelect: (person: { id: number; name: string; email: string }) => void }) {
  const [query, setQuery] = useState(''); const [people, setPeople] = useState<Array<{ id: number; name: string; email: string }>>([])
  const [error, setError] = useState('')
  useEffect(() => {
    let current = true
    const timer = setTimeout(async () => { if (query.trim().length < 2) { setPeople([]); return }; try { const result = await reimbursementRequest<typeof people>(`/people?q=${encodeURIComponent(query)}`); if (current) { setPeople(result); setError('') } } catch { if (current) setError('Rock search is unavailable. Try again.') } }, 350)
    return () => { current = false; clearTimeout(timer) }
  }, [query])
  return <div><label>{label}<input className={inputClass} placeholder="Search Rock by name" value={query} onChange={event => setQuery(event.target.value)} /></label><p className="mt-2 text-sm">Current: {name || 'Not configured'}</p><p role="status" className="text-sm">{error}</p>{people.length > 0 && <ul className="mt-2 rounded-lg border border-warm-grey">{people.map(person => <li key={person.id}><button className="w-full p-3 text-left hover:bg-warm-white" onClick={() => { onSelect(person); setQuery(''); setPeople([]) }}>{person.name} <span className="text-sm text-mid-grey">{person.email}</span></button></li>)}</ul>}</div>
}
