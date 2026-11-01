// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { BankAccountInput } from './BankAccountInput'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let container: HTMLDivElement
let root: Root
const field = () => container.querySelector('input')!
function Form() {
  const [value, setValue] = useState('')
  return <BankAccountInput required value={value} onValueChange={setValue} />
}
async function enter(value: string, position = value.length) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field(), value)
    field().setSelectionRange(position, position)
    field().dispatchEvent(new Event('input', { bubbles: true }))
  })
}
beforeEach(async () => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root.render(<Form />))
})
afterEach(async () => { await act(async () => root.unmount()); container.remove() })

it('inserts dashes as digits are typed and accepts pasted formatted numbers with either suffix length', async () => {
  await enter('12')
  await enter('121')
  expect(field().value).toBe('12-1')
  expect(field().selectionStart).toBe(4)
  await enter('121234123456700')
  expect(field().value).toBe('12-1234-1234567-00')
  expect(field().checkValidity()).toBe(true)
  await enter('12-1234-1234567-000')
  expect(field().value).toBe('12-1234-1234567-000')
  expect(field().checkValidity()).toBe(true)
  await enter('12-1234-1234567-0')
  expect(field().checkValidity()).toBe(false)
})

it('keeps the cursor near a middle edit instead of jumping to the end', async () => {
  await enter('12-1234-1234567-000')
  await enter('12-9234-1234567-000', 4)
  expect(field().value).toBe('12-9234-1234567-000')
  expect(field().selectionStart).toBe(4)
})

it.each([['Backspace', 3, '11-2341-2345670-00', 1], ['Delete', 2, '12-2341-2345670-00', 2]] as const)('allows %s across an inserted dash', async (key, position, expected, caret) => {
  await enter('12-1234-1234567-000')
  field().setSelectionRange(position, position)
  await act(async () => field().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })))
  expect(field().value).toBe(expected)
  expect(field().selectionStart).toBe(caret)
})

it('rejects letters and excess digits rather than silently saving a different complete number', async () => {
  await enter('12123412345670001')
  expect(field().value).toBe('')
  await enter('12-1234-1234567-00x')
  expect(field().value).toBe('')
  expect(field().checkValidity()).toBe(false)
})

it('replaces the browser validation popup with a message beneath the input and clears it when corrected', async () => {
  await enter('12')
  expect(field().nextElementSibling).toBeNull()
  const invalid = new Event('invalid', { cancelable: true })
  await act(async () => { field().dispatchEvent(invalid) })
  expect(invalid.defaultPrevented).toBe(true)
  const hint = field().nextElementSibling!
  expect(hint.id).toBe(field().getAttribute('aria-describedby'))
  expect(hint.textContent).toContain('00-0000-0000000-00')
  expect(field().getAttribute('aria-invalid')).toBe('true')
  await enter('121234123456700')
  expect(field().nextElementSibling).toBeNull()
  expect(field().hasAttribute('aria-invalid')).toBe(false)
})
