import type { RockPerson } from '@/lib/rock-api'

export function getRockPersonName(person: RockPerson): string {
  return (
    person.FullName?.trim() ||
    [person.NickName || person.FirstName, person.LastName].filter(Boolean).join(' ').trim()
  )
}
