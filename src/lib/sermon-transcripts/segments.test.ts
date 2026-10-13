import { expect, it } from 'vitest'
import { readTranscriptSegments } from './segments'
import { checkTagLease, readTopicSelection } from './workflow'
it('only exposes valid timestamped transcript segments', () => {
  expect(readTranscriptSegments([{ text: 'Valid', start: 3, end: 5 }, { text: 'Bad', start: -1, end: 2 }, { text: 'Bad', start: 5, end: 2 }, null])).toEqual([{ text: 'Valid', start: 3, end: 5 }])
})
it('validates bounded topic selections and refuses expired claims', () => {
  expect(readTopicSelection([1,1,2], [' Hope '])).toEqual({ ids: [1,2], names: ['Hope'] })
  expect(() => readTopicSelection([], [])).toThrow()
  expect(() => readTopicSelection([1.2], [])).toThrow()
  expect(() => checkTagLease({status:'tagging',leaseToken:'a',leaseExpiresAt:'2000-01-01'}, 'a')).toThrow()
})
