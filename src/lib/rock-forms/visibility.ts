import type { RockVisibilityRule } from './types'

function matchesComparison(actual: string, expected: string, comparison: number) {
  const left = actual.toLocaleLowerCase()
  const right = expected.toLocaleLowerCase()
  const leftNumber = Number(actual)
  const rightNumber = Number(expected)

  switch (comparison) {
    case 1:
      return left === right
    case 2:
      return left !== right
    case 4:
      return left.startsWith(right)
    case 8:
      return left.includes(right)
    case 16:
      return !left.includes(right)
    case 32:
      return actual.trim() === ''
    case 64:
      return actual.trim() !== ''
    case 128:
      return leftNumber > rightNumber
    case 256:
      return leftNumber >= rightNumber
    case 512:
      return leftNumber < rightNumber
    case 1024:
      return leftNumber <= rightNumber
    case 2048:
      return left.endsWith(right)
    case 4096: {
      const [minimum, maximum] = expected.split(',').map(Number)
      return leftNumber >= minimum && leftNumber <= maximum
    }
    default:
      return true
  }
}

export function isRockRuleVisible(
  rule: RockVisibilityRule | null | undefined,
  values: Record<string, string>,
): boolean {
  if (!rule || (!rule.rules?.length && !rule.groups?.length)) return true

  const results = [
    ...(rule.rules || []).map((item) =>
      item.attributeGuid
        ? matchesComparison(
            values[item.attributeGuid] || '',
            item.value || '',
            item.comparisonType || 1,
          )
        : true,
    ),
    ...(rule.groups || []).map((group) => isRockRuleVisible(group, values)),
  ]
  const result =
    rule.expressionType === 1 || rule.expressionType === 4
      ? results.every(Boolean)
      : results.some(Boolean)

  return rule.expressionType === 3 || rule.expressionType === 4
    ? !result
    : result
}
