// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ConnectGroupCommentComposer } from './ConnectGroupCommentComposer'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('ConnectGroupCommentComposer', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('serializes formatted editor content when submitting', async () => {
    const action = vi.fn(async (_formData: FormData) => {})
    await act(async () => root.render(
      <ConnectGroupCommentComposer
        action={action}
        author={{ name: 'Aroha', avatarUrl: null }}
        canPostCoachesOnly={false}
      />,
    ))
    const editor = container.querySelector<HTMLElement>('[contenteditable="true"]')!
    editor.innerHTML = '<p><strong>Update</strong> <a href="https://ev.church/">website</a></p><ul><li>First</li><li>Second</li></ul>'
    await act(async () => editor.dispatchEvent(new InputEvent('input', { bubbles: true })))
    await act(async () => container.querySelector<HTMLFormElement>('form')!.requestSubmit())

    const submitted = action.mock.calls[0]?.[0]
    expect(submitted?.get('body')).toBe(JSON.stringify({
      version: 1,
      blocks: [
        { type: 'paragraph', children: [{ text: 'Update', bold: true }, { text: ' ' }, { text: 'website', href: 'https://ev.church/' }] },
        { type: 'bullet', children: [{ text: 'First' }] },
        { type: 'bullet', children: [{ text: 'Second' }] },
      ],
    }))
  })

  it('leaves list Enter handling to the contenteditable browser behavior', async () => {
    await act(async () => root.render(
      <ConnectGroupCommentComposer
        action={async (_formData) => {}}
        author={{ name: 'Aroha', avatarUrl: null }}
        canPostCoachesOnly={false}
        initialBody={JSON.stringify({ version: 1, blocks: [{ type: 'bullet', children: [{ text: 'First' }] }] })}
      />,
    ))
    const item = container.querySelector('li')!
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })

    expect(item.dispatchEvent(event)).toBe(true)
    expect(event.defaultPrevented).toBe(false)
  })

  it('disables submission while the server action is pending', async () => {
    let finish!: () => void
    const pending = new Promise<void>((resolve) => { finish = resolve })
    await act(async () => root.render(
      <ConnectGroupCommentComposer
        action={async (_formData) => pending}
        author={{ name: 'Aroha', avatarUrl: null }}
        canPostCoachesOnly={false}
      />,
    ))
    const editor = container.querySelector<HTMLElement>('[contenteditable="true"]')!
    editor.textContent = 'Update'
    await act(async () => editor.dispatchEvent(new InputEvent('input', { bubbles: true })))

    await act(async () => {
      container.querySelector<HTMLFormElement>('form')!.requestSubmit()
      await Promise.resolve()
    })
    const submit = container.querySelector<HTMLButtonElement>('button[type="submit"]')!
    expect(submit.disabled).toBe(true)
    expect(submit.textContent).toBe('Saving…')

    await act(async () => finish())
    expect(submit.disabled).toBe(false)
  })
})
