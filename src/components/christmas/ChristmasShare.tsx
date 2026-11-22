'use client'

import { useEffect, useRef, useState } from 'react'

const url = 'https://www.ev.church/christmas'
const title = 'Christmas 2026 at Ev Church'
const text = 'Come see what Christmas brings. Join me at Ev Church this December!'
const linkClass = 'inline-flex min-h-11 items-center font-semibold text-[#f3d49b] underline underline-offset-4'

export function ChristmasShare({ image, label = 'Share Christmas' }: { image?: string; label?: string }) {
  const container = useRef<HTMLDivElement>(null)
  const file = useRef<File | undefined>(undefined)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!image || !navigator.canShare || !container.current) return
    const controller = new AbortController()
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      void fetch(image, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) return
          const blob = await response.blob()
          const candidate = new File([blob], image.split('/').pop()!, { type: 'image/jpeg' })
          if (navigator.canShare({ files: [candidate] })) file.current = candidate
        })
        .catch(() => { /* Link sharing stays available if the image cannot load. */ })
    }, { rootMargin: '200px' })
    observer.observe(container.current)
    return () => { controller.abort(); observer.disconnect() }
  }, [image])

  async function share() {
    setStatus('')
    if (!navigator.share) { setOptionsOpen(true); return }
    try {
      // Keep this call in the click event so Safari retains user activation.
      await navigator.share(file.current
        ? { title, text: `${text} ${url}`, files: [file.current] }
        : { title, text, url })
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError') return
      setStatus('Choose an option below to share the Christmas page.')
      setOptionsOpen(true)
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setStatus('Link copied!')
    } catch {
      setStatus(`Copy this link: ${url}`)
    }
  }

  return (
    <div ref={container}>
      <button type="button" onClick={share} aria-label={label} className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#d9b879] bg-[#d9b879] px-6 py-3 text-base font-semibold text-[#0b203b] hover:bg-[#f3d49b] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f3d49b]">{label}</button>
      <details className="mt-3" open={optionsOpen} onToggle={(event) => setOptionsOpen(event.currentTarget.open)}>
        <summary className="cursor-pointer text-sm text-[#f3d49b] underline underline-offset-4">More sharing options</summary>
        <div className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-1">
          <a className={linkClass} href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">Facebook</a>
          <a className={linkClass} href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a className={linkClass} href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">X</a>
          <a className={linkClass} href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`}>Email</a>
          <button type="button" className={linkClass} onClick={copyLink}>Copy link</button>
        </div>
      </details>
      <p role="status" className="mt-2 text-sm text-white/85">{status}</p>
    </div>
  )
}
