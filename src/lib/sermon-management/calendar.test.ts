import { describe, expect, it } from 'vitest'
import { calendarDate, calendarRow, recordingDate, spreadsheetID } from './calendar'

describe('teaching calendar matching', () => {
  it('uses the filename date and rejects impossible dates', () => {
    expect(recordingDate('202609061710UC Service.mp3')).toBe('2026-09-06')
    expect(recordingDate('202602301710UC Service.mp3')).toBeUndefined()
    expect(recordingDate('Sunday Service.mp3')).toBeUndefined()
  })
  it('extracts dates from event annotations without matching event-only rows', () => {
    expect(calendarDate("UoA RE-O'WEEK\n26-Jul-2026")).toBe('2026-07-26')
    expect(calendarDate('Term 3')).toBeUndefined()
  })
  it('resolves reordered columns explicitly, never Preaching Prep', () => {
    const read = calendarRow([
      ['Week','Date','Preaching Prep','Sunday Topic','Unichurch Preacher'],
      ['36','6-Sep-2026','Not Rowan',' The Confidence\nto Continue ','Ming'],
    ], '2026-09-06', 'B')
    expect(read('Unichurch Preacher')).toBe('Ming')
    expect(read('Sunday Topic')).toBe('The Confidence to Continue')
    expect(() => read('Central Preacher')).toThrow('mapping')
  })
  it('refuses duplicate or missing matches', () => {
    expect(() => calendarRow([['Date'],['6-Sep-2026'],['6-Sep-2026']], '2026-09-06', 'A')).toThrow('Multiple')
    expect(() => calendarRow([['Date']], '2026-09-06', 'A')).toThrow('No calendar')
  })
  it('accepts a Google spreadsheet URL without allowing arbitrary remote URLs', () => {
    expect(spreadsheetID('https://docs.google.com/spreadsheets/d/example_ID/edit#gid=1')).toBe('example_ID')
    expect(() => spreadsheetID('https://example.org/private')).toThrow()
  })
})

import { calendarSeriesNameMatches, chooseCalendarSeries } from './calendar'
it('matches calendar shorthand to titled series without matching unrelated books', () => {
  expect(calendarSeriesNameMatches('Hebrews: Jesus is Better', ' Hebrews ')).toBe(true)
  expect(calendarSeriesNameMatches('Hebrews: Faithful Endurance', 'Hebrews')).toBe(true)
  expect(calendarSeriesNameMatches('Hebrews: Jesus is Better', 'Hebrews: Jesus is Better')).toBe(true)
  expect(calendarSeriesNameMatches('1 John: Light', 'John')).toBe(false)
})
it('uses the latest series start before the sermon rather than an undated shorthand entry', () => {
  const matches = [{id:83}, {id:66,startDate:'2016-05-15'}, {id:80,startDate:'2026-07-19'}, {id:90,startDate:'2027-01-01'}]
  expect(chooseCalendarSeries(matches, '2026-09-06')?.id).toBe(80)
  expect(chooseCalendarSeries(matches, '2016-06-05')?.id).toBe(66)
  expect(chooseCalendarSeries(matches, '2026-07-19')?.id).toBe(80)
})
it('does not guess between tied, undated, or future series', () => {
  expect(() => chooseCalendarSeries([{id:1,startDate:'2026-07-19'}, {id:2,startDate:'2026-07-19'}], '2026-09-06')).toThrow()
  expect(() => chooseCalendarSeries([{id:1}, {id:2}], '2026-09-06')).toThrow()
  expect(() => chooseCalendarSeries([{id:1,startDate:'2027-01-01'}], '2026-09-06')).toThrow()
  expect(chooseCalendarSeries([{id:1}], '2026-09-06')?.id).toBe(1)
  expect(chooseCalendarSeries([], '2026-09-06')).toBeUndefined()
})
