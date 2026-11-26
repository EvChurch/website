import { describe, expect, it } from 'vitest'
import type { Course } from '@/payload-types'
import { faithfulWithMoneyCourse as course } from './faithful-with-money'

const lessons: Course['lessons'] = course.lessons
const blocks = lessons.flatMap(lesson => lesson.blocks ?? [])
const questions = blocks.filter(block => block.blockType === 'courseQuestion')
const copy = JSON.stringify(course)

describe('Faithful with Money initial authoring content', () => {
  it('keeps three evenings and six talks in order using native blocks', () => {
    expect(course._status).toBe('draft')
    expect(course.lessons.map(lesson => lesson.title)).toEqual(['Whose money is it?', 'The grace of giving', 'A plan for your money'])
    const talkPositions = ['Here’s a question that sounds too easy', 'No one can serve two masters', 'strangest fundraising report', 'So grace makes givers', 'budget has a branding problem', 'we’ve borrowed his buckets'].map(phrase => copy.indexOf(phrase))
    expect(talkPositions.every(position => position >= 0)).toBe(true)
    expect(talkPositions).toEqual([...talkPositions].sort((a, b) => a - b))
    expect(new Set(blocks.map(block => block.id)).size).toBe(blocks.length)
    expect(new Set(blocks.map(block => block.blockType))).toEqual(new Set(['courseTeaching', 'courseQuestion', 'courseBudget', 'coursePrompt']))
    expect(blocks.filter(block => block.blockType === 'coursePrompt')).toHaveLength(9)
    expect(questions.filter(block => block.inputType === 'checklist')).toHaveLength(3)
    expect(questions.filter(block => block.guidance)).toHaveLength(25)
  })
  it('keeps money stories and every financial input personal', () => {
    const stories = questions.filter(block => [
      'What did my family teach me about money, in words or by example?',
      'Am I by nature a spender or a saver? What do I fear?',
      'What’s my first feeling when I think about our finances: calm, dread, guilt, pride, fog?',
      'Where did the four tests land: daydream, anxiety, can’t give away, bank statement?',
      'If the Owner looked over my last month of spending, what would please him? What would I want to explain?',
      'What do I already do well with money that I can thank God for?',
    ].includes(block.prompt))
    expect(stories).toHaveLength(6)
    expect([...stories, ...questions.filter(block => block.inputType === 'number')].every(block => block.visibility === 'personal')).toBe(true)
    expect(questions.filter(block => block.inputType === 'number')).toHaveLength(3)
    const budget = blocks.find(block => block.blockType === 'courseBudget')!
    expect(budget.visibility).toBe('personal')
    expect(budget.categories.map(category => category.label)).toEqual(['Give', 'Live', 'Fire', 'Smile', 'Splurge'])
    expect(budget.categories.every(category => (category.startingLines?.length ?? 0) > 0)).toBe(true)
    expect(questions.some(block => block.visibility === 'shared')).toBe(true)
    expect(questions.every(block => !block.required)).toBe(true)
  })
  it('uses account privacy, qualified credits and verified help', () => {
    for (const phrase of ['Your answers save to your account', 'Its figures are separate from your course answers', 'approved donee organisations', 'Payroll giving has already received its tax credit', '0800 345 123', '4029']) expect(copy).toContain(phrase)
    expect(copy).not.toMatch(/localStorage|sessionStorage|<script|nothing is sent|stays in your browser|hands back a third/i)
  })
})
