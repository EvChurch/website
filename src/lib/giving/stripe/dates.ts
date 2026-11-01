import type { GivingFrequency } from '../blinkpay/types'

export function nzGivingDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone:'Pacific/Auckland',year:'numeric',month:'2-digit',day:'2-digit' }).format(now)
}

/** Afternoon NZ anchors retain the same UTC calendar date, including across DST. */
export function givingAnchorTimestamp(date: string): number {
  const midnight=Date.parse(`${date}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date) || !Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0,10)!==date) throw new Error('Invalid giving date')
  const offset=new Intl.DateTimeFormat('en',{timeZone:'Pacific/Auckland',timeZoneName:'longOffset'}).formatToParts(new Date(midnight+3*3600_000)).find(part=>part.type==='timeZoneName')?.value
  if(offset!=='GMT+13:00' && offset!=='GMT+12:00')throw new Error('Unsupported giving timezone offset')
  return (midnight+(15-(offset==='GMT+13:00'?13:12))*3600_000)/1000
}

/** Advance from the original UTC calendar anchor, retaining its day in short months. */
export function nextGivingAnchor(anchor: number, frequency: GivingFrequency, cycles = 1): number {
  if(!Number.isSafeInteger(cycles) || cycles<1)throw new Error('Invalid giving interval')
  const original=new Date(anchor*1000)
  const next=new Date(original)
  if(frequency==='weekly' || frequency==='fortnightly')next.setUTCDate(next.getUTCDate()+cycles*(frequency==='weekly'?7:14))
  else if(frequency==='monthly' || frequency==='annual') {
    next.setUTCDate(1)
    next.setUTCMonth(next.getUTCMonth()+cycles*(frequency==='monthly'?1:12))
    const last=new Date(Date.UTC(next.getUTCFullYear(),next.getUTCMonth()+1,0)).getUTCDate()
    next.setUTCDate(Math.min(original.getUTCDate(),last))
  } else throw new Error('Invalid giving frequency')
  return next.getTime()/1000
}
