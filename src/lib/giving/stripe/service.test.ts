import { describe, expect, it } from 'vitest'
import { cardTransactionFeeMinor } from '../fees'
import { givingStartTimestamp, recurringInterval } from './service'
import { givingAnchorTimestamp, nextGivingAnchor } from './dates'
import { csvCell } from '../finance-export'

describe('card fees and recurring instructions',()=>{
  it('grosses up the entire charge, rounding up to cents without reducing the gift',()=>{
    expect(cardTransactionFeeMinor(10000,{fixedMinor:45,percentageBasisPoints:200})).toBe(250)
    expect(cardTransactionFeeMinor(10000,{fixedMinor:30,percentageBasisPoints:250})).toBe(288)
    expect(cardTransactionFeeMinor(10000,{fixedMinor:30,percentageBasisPoints:265})).toBe(304)
    expect(cardTransactionFeeMinor(10000,{fixedMinor:0,percentageBasisPoints:0})).toBe(0)
    expect(cardTransactionFeeMinor(1_000_000,{fixedMinor:30,percentageBasisPoints:265})).toBeGreaterThan(10_000)
    expect(()=>cardTransactionFeeMinor(100,{fixedMinor:0,percentageBasisPoints:10000})).toThrow()
    expect(()=>cardTransactionFeeMinor(99_999_999,{fixedMinor:30,percentageBasisPoints:265})).toThrow()
  })
  it('represents fortnightly as two weeks, not twice monthly',()=>{
    expect(recurringInterval('fortnightly')).toEqual({interval:'week',interval_count:2})
    expect(()=>recurringInterval('daily')).toThrow()
  })
  it('keeps Today immediate at any hour and future anchors on the same UTC and NZ calendar day',()=>{
    const now=new Date('2026-01-01T00:00:00Z')
    expect(givingStartTimestamp('2026-01-01',now)).toBe('now')
    expect(givingStartTimestamp('2026-01-02',now)).toBe(Date.parse('2026-01-02T02:00:00Z')/1000)
    expect(givingStartTimestamp('2026-07-02',now)).toBe(Date.parse('2026-07-02T03:00:00Z')/1000)
    expect(givingStartTimestamp('2026-09-27',now)).toBe(Date.parse('2026-09-27T02:00:00Z')/1000)
    expect(givingStartTimestamp('2026-09-28',now)).toBe(Date.parse('2026-09-28T02:00:00Z')/1000)
    expect(givingStartTimestamp('2026-01-01',new Date('2026-01-01T10:30:00Z'))).toBe('now')
    expect(()=>givingStartTimestamp('2025-12-31',now)).toThrow()
    expect(()=>givingStartTimestamp('2026-02-30',now)).toThrow()
  })
  it('retains the original day for monthly and annual anchors, including short months and leap years',()=>{
    const month=givingAnchorTimestamp('2027-01-31')
    expect(new Date(nextGivingAnchor(month,'monthly')*1000).toISOString().slice(0,10)).toBe('2027-02-28')
    expect(new Date(nextGivingAnchor(month,'monthly',2)*1000).toISOString().slice(0,10)).toBe('2027-03-31')
    const leap=givingAnchorTimestamp('2028-02-29')
    expect(new Date(nextGivingAnchor(leap,'annual')*1000).toISOString().slice(0,10)).toBe('2029-02-28')
    expect(new Date(nextGivingAnchor(leap,'annual',4)*1000).toISOString().slice(0,10)).toBe('2032-02-29')
    const first=givingAnchorTimestamp('2026-09-20')
    expect(new Intl.DateTimeFormat('en-CA',{timeZone:'Pacific/Auckland',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(nextGivingAnchor(first,'weekly')*1000))).toBe('2026-09-27')
  })
  it('neutralises CSV formulas and quotes donor-controlled cells',()=>{
    expect(csvCell('=HYPERLINK("evil")')).toBe('"\'=HYPERLINK(""evil"")"')
    expect(csvCell('Ada, "A"')).toBe('"Ada, ""A"""')
    expect(csvCell(10000)).toBe('"10000"')
  })
})
