import { describe, expect, it } from 'vitest'
import { isRockRuleVisible } from './visibility'

const baseRule = {
  guid: 'rule',
  expressionType: 1,
  rules: [
    {
      attributeGuid: 'field',
      comparisonType: 1,
      value: 'Yes',
    },
  ],
  groups: null,
}

describe('Rock conditional visibility', () => {
  it('shows fields with no conditions', () => {
    expect(isRockRuleVisible(undefined, {})).toBe(true)
  })

  it('evaluates equality without case sensitivity', () => {
    expect(isRockRuleVisible(baseRule, { field: 'yes' })).toBe(true)
    expect(isRockRuleVisible(baseRule, { field: 'no' })).toBe(false)
  })

  it('requires all conditions to be false for GroupAllFalse', () => {
    expect(
      isRockRuleVisible(
        {
          ...baseRule,
          expressionType: 3,
          rules: [
            { attributeGuid: 'one', comparisonType: 1, value: 'Yes' },
            { attributeGuid: 'two', comparisonType: 1, value: 'Yes' },
          ],
        },
        { one: 'no', two: 'no' },
      ),
    ).toBe(true)
    expect(
      isRockRuleVisible(
        {
          ...baseRule,
          expressionType: 3,
          rules: [
            { attributeGuid: 'one', comparisonType: 1, value: 'Yes' },
            { attributeGuid: 'two', comparisonType: 1, value: 'Yes' },
          ],
        },
        { one: 'yes', two: 'no' },
      ),
    ).toBe(false)
  })

  it('shows GroupAnyFalse when at least one condition is false', () => {
    const rule = {
      ...baseRule,
      expressionType: 4,
      rules: [
        { attributeGuid: 'one', comparisonType: 1, value: 'Yes' },
        { attributeGuid: 'two', comparisonType: 1, value: 'Yes' },
      ],
    }
    expect(isRockRuleVisible(rule, { one: 'yes', two: 'no' })).toBe(true)
    expect(isRockRuleVisible(rule, { one: 'yes', two: 'yes' })).toBe(false)
  })

  it('supports multi-select contains rules', () => {
    expect(
      isRockRuleVisible(
        {
          ...baseRule,
          rules: [{ attributeGuid: 'field', comparisonType: 8, value: 'two' }],
        },
        { field: 'one,two' },
      ),
    ).toBe(true)
  })
})
