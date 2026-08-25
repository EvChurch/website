// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { PublicConnectGroup } from '@/lib/connect-groups/public'
import { ConnectGroupsFinder } from './ConnectGroupsFinder'

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true

const groups: PublicConnectGroup[] = [
  {
    id: 1,
    name: 'Bill & Cherrys group',
    publicName: 'Rosedale (North campus)',
    rockGroupGuid: '9756a8fd-a865-4070-add3-03b3396c4b9a',
    campus: { name: 'North', slug: 'north' },
    leaders: [
      { name: 'Bill Wong', avatarUrl: 'https://home.ev.church/GetAvatar.ashx?PhotoId=288&Size=96' },
      { name: 'Cherry Chu', avatarUrl: null },
    ],
    meetingDay: 0,
    meetingTime: '12:30:00',
    scheduleText: 'Sunday at 12:30 PM',
  },
  {
    id: 2,
    name: "Mark & Natalie's CG",
    publicName: 'Epsom',
    rockGroupGuid: '30f8c58b-c132-404d-a0b2-e0f96cc54c51',
    campus: { name: 'Central', slug: 'central' },
    leaders: [
      { name: 'Mark Donaldson', avatarUrl: null },
      { name: 'Natalie Donaldson', avatarUrl: null },
    ],
    meetingDay: 2,
    meetingTime: '19:00:00',
    scheduleText: 'Tuesday at 7:00 PM',
  },
]

function click(container: HTMLElement, label: string) {
  const control = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
    (button) => button.textContent?.trim() === label,
  )
  control?.click()
}

describe('ConnectGroupsFinder', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('shows every group and passes the selected Rock GroupGuid to the launcher', async () => {
    await act(async () => root.render(<ConnectGroupsFinder groups={groups} />))

    expect(container.textContent).toContain('Rosedale (North campus)')
    expect(container.textContent).toContain('Epsom')
    expect(container.textContent).toContain('Bill Wong, Cherry Chu')
    expect(container.querySelector('img[src*="PhotoId=288"]')).not.toBeNull()
    expect(container.textContent).toContain('CC')
    expect(
      Array.from(container.querySelectorAll('a')).some(
        (link) =>
          link.getAttribute('href') ===
          '?launcher=connect-group&groupGuid=9756a8fd-a865-4070-add3-03b3396c4b9a',
      ),
    ).toBe(true)
  })

  it('filters by campus and meeting day without dropping the all-groups option', async () => {
    await act(async () => root.render(<ConnectGroupsFinder groups={groups} />))

    await act(async () => click(container, 'North'))
    expect(container.textContent).toContain('Rosedale (North campus)')
    expect(container.textContent).not.toContain('Epsom')

    await act(async () => click(container, 'Tuesday'))
    expect(container.textContent).toContain('No Connect Groups match those filters')

    await act(async () => click(container, 'All campuses'))
    expect(container.textContent).toContain('Epsom')
    expect(container.textContent).not.toContain('Rosedale (North campus)')
  })
})
