import { expect, it } from 'vitest'
import { fillMissingCalendarMetadata, type SermonMetadata } from './workflow'
const oldTitle = '20260830 0930 Service Recording North'
const blank: SermonMetadata = { title: oldTitle, publishedAt: '', passageReference: '', series: [], topics: [], scriptures: [] }
const defaults = { title: 'If You Knew the Future…', publishedAt: '2026-08-30', audioSpeaker: 36, audioCampus: 2, passageReference: 'Hebrews 9:1-10:18', series: [80], scriptures: [43] }
it('fills calendar details when reconnecting an old filename-only draft', () => {
 expect(fillMissingCalendarMetadata(blank, defaults, oldTitle)).toEqual({...blank,...defaults})
})
it('preserves authored metadata and topics when replacing a recording', () => {
 const authored = {...blank, title:'My edited title', publishedAt:'2026-08-23', audioSpeaker:5, audioCampus:3, passageReference:'Hebrews 8', series:[66], scriptures:[12],topics:[7]}
 expect(fillMissingCalendarMetadata(authored,defaults,oldTitle)).toEqual(authored)
})
