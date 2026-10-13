// @vitest-environment jsdom
import { act, useImperativeHandle, useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@iframe-resizer/react', () => ({
  default: function Frame({ forwardRef, src, onLoad }: {
    forwardRef: React.Ref<{ getElement: () => HTMLIFrameElement | null }>
    src: string
    onLoad: () => void
  }) {
    const ref = useRef<HTMLIFrameElement>(null)
    useImperativeHandle(forwardRef, () => ({ getElement: () => ref.current }))
    return <iframe ref={ref} src={src} onLoad={onLoad} title="Registration" />
  },
}))
import { RegistrationFrame } from './RegistrationFrame'

const origin = 'https://registration.example.org'
const channel = 'a'.repeat(64)
describe('registration payment window connection', () => {
  let container: HTMLDivElement
  let root: Root
  let frame: HTMLIFrameElement
  const scrollTo = vi.fn()
  let focus: ReturnType<typeof vi.spyOn>

  async function send(source: Window | null, type: string, from = origin, id = channel) {
    await act(async () => window.dispatchEvent(new MessageEvent('message', {
      origin: from, source, data: { type, channel: id },
    })))
  }

  beforeEach(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    focus = vi.spyOn(window, 'focus').mockImplementation(() => {})
    const scrollContainer = document.createElement('div')
    scrollContainer.scrollTo = scrollTo
    await act(async () => root.render(<RegistrationFrame
      src={`${origin}/?RegistrationInstanceId=84`} title="Registration"
      scrollContainerRef={{ current: scrollContainer }} />))
    frame = container.querySelector('iframe')!
  })
  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('only creates the fixed bridge URL for a valid identifier from the registration frame', async () => {
    await send(frame.contentWindow, 'blinkpay:connect', 'https://attacker.example')
    await send(window, 'blinkpay:connect')
    await send(frame.contentWindow, 'blinkpay:connect', origin, '../token=secret')
    expect(container.querySelectorAll('iframe')).toHaveLength(1)
    await send(frame.contentWindow, 'blinkpay:connect')
    const bridge = container.querySelectorAll('iframe')[1]
    expect(new URL(bridge.src).origin).toBe(origin)
    expect(new URL(bridge.src).pathname).toBe('/Plugins/ChurchEv/BlinkPay/Bridge.ashx')
    expect(new URL(bridge.src).searchParams.get('channel')).toBe(channel)
    expect(bridge.hidden).toBe(true)
  })

  it('retains the bridge after visible frame navigation and only acknowledges its matching messages', async () => {
    await send(frame.contentWindow, 'blinkpay:connect')
    const bridge = container.querySelectorAll('iframe')[1]
    const reply = vi.spyOn(bridge.contentWindow!, 'postMessage').mockImplementation(() => {})
    frame.src = `${origin}/?confirmation=1`
    await act(async () => frame.dispatchEvent(new Event('load')))
    scrollTo.mockClear()
    await send(frame.contentWindow, 'blinkpay:attention')
    await send(bridge.contentWindow, 'blinkpay:attention', origin, 'b'.repeat(64))
    await send(bridge.contentWindow, 'blinkpay:attention', 'https://attacker.example')
    expect(focus).not.toHaveBeenCalled()
    await send(bridge.contentWindow, 'blinkpay:attention')
    expect(container.querySelectorAll('iframe')[1]).toBe(bridge)
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' })
    expect(focus).toHaveBeenCalledOnce()
    expect(reply).toHaveBeenCalledWith({ type: 'blinkpay:launcher-ready', channel }, origin)
    expect(frame.src).toBe(`${origin}/?confirmation=1`)
  })
})
