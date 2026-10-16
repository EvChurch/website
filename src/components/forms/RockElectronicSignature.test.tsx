// @vitest-environment happy-dom

import { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RockSignatureValues } from '@/lib/rock-forms/types'
import { RockElectronicSignature } from './RockElectronicSignature'

const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/dZsAAAAASUVORK5CYII='

describe('Rock electronic signature', () => {
  afterEach(() => vi.restoreAllMocks())

  it('requires drawing and explicit consent before collecting signer details', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    const readiness = vi.fn()
    const changed = vi.fn()
    const context = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      clearRect: vi.fn(),
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(png)
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    function Harness() {
      const [value, setValue] = useState<RockSignatureValues>({
        signatureData: '',
        signedByName: '',
        signedByEmail: '',
      })
      return (
        <RockElectronicSignature
          configuration={{
            type: 'drawn',
            documentHtml: '<p>Membership declaration</p>',
            documentTerm: 'Application',
            sendCopy: true,
            legalName: '',
            email: '',
          }}
          value={value}
          onChange={(next) => {
            changed(next)
            setValue(next)
          }}
          onReadyChange={readiness}
        />
      )
    }

    try {
      await act(async () => root.render(<Harness />))
      expect(container.querySelector('iframe')?.getAttribute('srcdoc')).toBe(
        '<p>Membership declaration</p>',
      )
      const signButton = () =>
        [...container.querySelectorAll('button')].find(
          (button) => button.textContent === 'Sign',
        )!
      await act(async () => signButton().click())
      expect(readiness).not.toHaveBeenCalled()
      expect(container.querySelector('[role="alert"]')?.textContent).toBe(
        'Draw your signature.',
      )

      const canvas = container.querySelector('canvas')!
      Object.defineProperty(canvas, 'setPointerCapture', { value: vi.fn() })
      vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        width: 1000,
        height: 300,
      } as DOMRect)
      await act(async () => {
        canvas.dispatchEvent(
          new PointerEvent('pointerdown', {
            bubbles: true,
            clientX: 20,
            clientY: 30,
            pointerId: 1,
          }),
        )
        canvas.dispatchEvent(
          new PointerEvent('pointermove', {
            bubbles: true,
            clientX: 60,
            clientY: 45,
            pointerId: 1,
          }),
        )
        canvas.dispatchEvent(
          new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }),
        )
      })
      expect(changed).toHaveBeenLastCalledWith(
        expect.objectContaining({ signatureData: png }),
      )
      await act(async () => signButton().click())
      expect(readiness).toHaveBeenLastCalledWith(true)
      expect(container.textContent).toContain('Legal name')
      expect(container.textContent).toContain('Email address to receive a copy')
      expect(container.querySelectorAll('input[required]')).toHaveLength(2)
    } finally {
      await act(async () => root.unmount())
      container.remove()
      vi.unstubAllGlobals()
    }
  })
})
