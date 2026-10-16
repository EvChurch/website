'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import type {
  RockSignatureConfiguration,
  RockSignatureValues,
} from '@/lib/rock-forms/types'
import { formInputClass, formLabelClass } from './form-styles'

export function RockElectronicSignature({
  configuration,
  value,
  onChange,
  onReadyChange,
}: {
  configuration: RockSignatureConfiguration
  value: RockSignatureValues
  onChange: (value: RockSignatureValues) => void
  onReadyChange: (ready: boolean) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [showDetails, setShowDetails] = useState(false)
  const [error, setError] = useState('')

  const beginDetails = () => {
    if (
      configuration.type === 'drawn'
        ? !value.signatureData
        : !value.signedByName.trim()
    ) {
      setError(
        configuration.type === 'drawn'
          ? 'Draw your signature.'
          : 'Enter your legal name.',
      )
      return
    }
    setError('')
    setShowDetails(true)
    onReadyChange(true)
  }

  const changeSignature = () => {
    setShowDetails(false)
    onReadyChange(false)
    if (configuration.type === 'drawn') {
      canvas.current?.getContext('2d')?.clearRect(0, 0, 1000, 300)
      onChange({ ...value, signatureData: '' })
    }
  }

  return (
    <section className="space-y-5">
      <iframe
        title={`${configuration.documentTerm} to sign`}
        srcDoc={configuration.documentHtml}
        sandbox=""
        referrerPolicy="no-referrer"
        className="h-[32rem] w-full rounded-lg border border-warm-grey bg-white"
      />

      {!showDetails ? (
        <div className="space-y-5 rounded-lg border border-warm-grey p-5">
          {configuration.type === 'drawn' ? (
            <div>
              <p className={formLabelClass}>Draw your signature</p>
              <p className="mt-1 text-sm text-dark-grey">
                Use your mouse or finger to sign below.
              </p>
              <canvas
                ref={canvas}
                width={1000}
                height={300}
                aria-label="Draw your signature"
                className="mt-3 aspect-[10/3] h-auto w-full touch-none rounded-lg border border-warm-grey bg-white"
                onPointerDown={(event) => {
                  const element = event.currentTarget
                  const context = element.getContext('2d')
                  if (!context) {
                    setError('Your browser could not open the signature pad.')
                    return
                  }
                  const rect = element.getBoundingClientRect()
                  const x = ((event.clientX - rect.left) * element.width) / rect.width
                  const y = ((event.clientY - rect.top) * element.height) / rect.height
                  element.setPointerCapture(event.pointerId)
                  context.lineWidth = 3
                  context.lineCap = 'round'
                  context.strokeStyle = '#0F0004'
                  context.beginPath()
                  context.moveTo(x, y)
                  context.lineTo(x + 0.1, y + 0.1)
                  context.stroke()
                  drawing.current = true
                  setError('')
                }}
                onPointerMove={(event) => {
                  if (!drawing.current) return
                  const element = event.currentTarget
                  const rect = element.getBoundingClientRect()
                  const context = element.getContext('2d')
                  context?.lineTo(
                    ((event.clientX - rect.left) * element.width) / rect.width,
                    ((event.clientY - rect.top) * element.height) / rect.height,
                  )
                  context?.stroke()
                }}
                onPointerUp={(event) => {
                  if (!drawing.current) return
                  drawing.current = false
                  onChange({
                    ...value,
                    signatureData: event.currentTarget.toDataURL('image/png'),
                  })
                }}
                onPointerCancel={() => {
                  drawing.current = false
                }}
              />
              <Button
                type="button"
                variant="text"
                onClick={() => {
                  canvas.current
                    ?.getContext('2d')
                    ?.clearRect(0, 0, 1000, 300)
                  onChange({ ...value, signatureData: '' })
                }}
              >
                Clear signature
              </Button>
            </div>
          ) : (
            <label className={formLabelClass}>
              Type your legal name
              <input
                required
                maxLength={200}
                autoComplete="name"
                className={formInputClass}
                value={value.signedByName}
                onChange={(event) =>
                  onChange({ ...value, signedByName: event.target.value })
                }
              />
            </label>
          )}

          <p className="text-sm text-dark-grey">
            By clicking Sign, I agree to the document above and understand this
            is a legal representation of my signature.
          </p>
          {error && (
            <p role="alert" className="text-sm text-rich-red">
              {error}
            </p>
          )}
          <Button type="button" onClick={beginDetails}>
            Sign
          </Button>
        </div>
      ) : (
        <div className="space-y-5 rounded-lg border border-warm-grey p-5">
          {configuration.type === 'drawn' ? (
            <label className={formLabelClass}>
              Legal name
              <input
                required
                maxLength={200}
                autoComplete="name"
                className={formInputClass}
                value={value.signedByName}
                onChange={(event) =>
                  onChange({ ...value, signedByName: event.target.value })
                }
              />
            </label>
          ) : (
            <div>
              <p className={formLabelClass}>Legal name</p>
              <p className="mt-2">{value.signedByName}</p>
            </div>
          )}
          <label className={formLabelClass}>
            {configuration.sendCopy
              ? 'Email address to receive a copy'
              : 'Email address'}
            <input
              required
              type="email"
              maxLength={254}
              autoComplete="email"
              className={formInputClass}
              value={value.signedByEmail}
              onChange={(event) =>
                onChange({ ...value, signedByEmail: event.target.value })
              }
            />
          </label>
          <Button type="button" variant="text" onClick={changeSignature}>
            Change signature
          </Button>
        </div>
      )}
    </section>
  )
}
