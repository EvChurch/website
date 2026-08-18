'use client'

import type { FormEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { HiLink, HiListBullet } from 'react-icons/hi2'

import {
  parseCommentRichText,
  type CommentRichTextBlock,
  type CommentRichTextRun,
} from '@/lib/members/comment-rich-text'
import { MemberAvatar } from './MemberAvatar'

function sameFormatting(left: CommentRichTextRun, right: CommentRichTextRun) {
  return left.bold === right.bold && left.italic === right.italic && left.href === right.href
}

function runsFromNode(node: Node, inherited: Omit<CommentRichTextRun, 'text'> = {}): CommentRichTextRun[] {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ? [{ text: node.textContent, ...inherited }] : []
  }
  if (!(node instanceof HTMLElement)) return []
  if (node.tagName === 'BR') return [{ text: '\n', ...inherited }]
  const formatting = {
    ...inherited,
    ...(['B', 'STRONG'].includes(node.tagName) ? { bold: true as const } : {}),
    ...(['I', 'EM'].includes(node.tagName) ? { italic: true as const } : {}),
    ...(node.tagName === 'A' && node.getAttribute('href') ? { href: node.getAttribute('href') ?? undefined } : {}),
  }
  const runs = [...node.childNodes].flatMap((child) => runsFromNode(child, formatting))
  return runs.reduce<CommentRichTextRun[]>((merged, run) => {
    const previous = merged.at(-1)
    if (previous && sameFormatting(previous, run)) previous.text += run.text
    else merged.push(run)
    return merged
  }, [])
}

function textWithBlockBreaks(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
  if (!(node instanceof HTMLElement)) {
    return [...node.childNodes].map(textWithBlockBreaks).join('')
  }
  if (node.tagName === 'BR') return '\n'
  const text = [...node.childNodes].map(textWithBlockBreaks).join('')
  return ['DIV', 'P', 'LI'].includes(node.tagName) ? `${text}\n` : text
}

function documentFromEditor(editor: HTMLElement) {
  const blocks: CommentRichTextBlock[] = []
  function addNode(node: Node) {
    if (node instanceof HTMLUListElement) {
      for (const item of node.querySelectorAll(':scope > li')) {
        const children = runsFromNode(item).filter((run) => run.text)
        if (children.length > 0) blocks.push({ type: 'bullet', children })
      }
      return
    }
    if (node instanceof HTMLElement && ['DIV', 'P'].includes(node.tagName)) {
      const nestedList = [...node.children].some((child) => child instanceof HTMLUListElement)
      if (nestedList) {
        for (const child of node.childNodes) addNode(child)
        return
      }
    }
    const children = runsFromNode(node).filter((run) => run.text)
    if (children.length > 0) blocks.push({ type: 'paragraph', children })
  }
  for (const node of editor.childNodes) addNode(node)
  return JSON.stringify({ version: 1, blocks })
}

function appendRun(parent: HTMLElement, run: CommentRichTextRun) {
  let node: Node = document.createTextNode(run.text)
  if (run.href) {
    const link = document.createElement('a')
    link.href = run.href
    link.append(node)
    node = link
  }
  if (run.italic) {
    const italic = document.createElement('em')
    italic.append(node)
    node = italic
  }
  if (run.bold) {
    const bold = document.createElement('strong')
    bold.append(node)
    node = bold
  }
  parent.append(node)
}

function populateEditor(editor: HTMLElement, body: string) {
  editor.replaceChildren()
  const richText = parseCommentRichText(body)
  if (!richText) {
    editor.textContent = body
    return
  }
  let list: HTMLUListElement | null = null
  for (const block of richText.blocks) {
    if (block.type === 'bullet') {
      list ??= document.createElement('ul')
      if (!list.parentElement) editor.append(list)
      const item = document.createElement('li')
      for (const run of block.children) appendRun(item, run)
      list.append(item)
      continue
    }
    list = null
    const paragraph = document.createElement('p')
    for (const run of block.children) appendRun(paragraph, run)
    editor.append(paragraph)
  }
}

function CommentSubmitButton({ variant }: { variant: 'new' | 'edit' }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-rich-red px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-black disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? 'Saving…' : variant === 'edit' ? 'Save changes' : 'Add comment'}
    </button>
  )
}

export function ConnectGroupCommentComposer({
  action,
  author,
  canPostCoachesOnly,
  initialBody = '',
  initialCoachesOnly = false,
  fixedCoachesOnly = false,
  onCancel,
  variant = 'new',
}: {
  action: (formData: FormData) => Promise<void>
  author: { name: string; avatarUrl: string | null }
  canPostCoachesOnly: boolean
  initialBody?: string
  initialCoachesOnly?: boolean
  fixedCoachesOnly?: boolean
  onCancel?: () => void
  variant?: 'new' | 'edit'
}) {
  const editor = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLInputElement>(null)
  const linkUrlInput = useRef<HTMLInputElement>(null)
  const savedLinkSelection = useRef<Range | null>(null)
  const editingLink = useRef<HTMLAnchorElement | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkText, setLinkText] = useState('')
  const [linkUrl, setLinkUrl] = useState('')

  useEffect(() => {
    if (!editor.current || !body.current) return
    populateEditor(editor.current, initialBody)
    body.current.value = documentFromEditor(editor.current)
  }, [initialBody])

  function format(command: 'bold' | 'italic') {
    editor.current?.focus()
    document.execCommand(command)
  }

  function makeList() {
    const selection = window.getSelection()
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null
    if (!editor.current || !selection || !range || !editor.current.contains(range.commonAncestorContainer)) return
    const selected = range.cloneContents()
    let selectedText = range.collapsed
      ? editor.current.innerText
      : [...selected.childNodes].map(textWithBlockBreaks).join('')
    const visibleText = editor.current.innerText
    if (
      !selectedText.includes('\n') &&
      visibleText.includes('\n') &&
      selectedText.replace(/\s/gu, '') === visibleText.replace(/\s/gu, '')
    ) {
      selectedText = visibleText
    }
    const items = selectedText.split(/\n+/u).map((item) => item.trim()).filter(Boolean)
    const list = document.createElement('ul')
    for (const text of items.length > 0 ? items : ['']) {
      const item = document.createElement('li')
      if (text) item.textContent = text
      else item.append(document.createElement('br'))
      list.append(item)
    }
    if (range.collapsed) editor.current.replaceChildren(list)
    else {
      range.deleteContents()
      range.insertNode(list)
    }
    const lastItem = list.lastElementChild
    if (lastItem) {
      range.selectNodeContents(lastItem)
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)
    }
    syncComment()
  }

  function openLink() {
    const selection = window.getSelection()
    savedLinkSelection.current = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null
    editingLink.current = null
    setLinkText(selection?.toString() ?? '')
    setLinkOpen(true)
  }

  function editLink(link: HTMLAnchorElement) {
    const range = document.createRange()
    range.selectNodeContents(link)
    savedLinkSelection.current = range
    editingLink.current = link
    setLinkText(link.textContent ?? '')
    setLinkUrl(link.getAttribute('href') ?? '')
    setLinkOpen(true)
  }

  function closeLinkEditor() {
    editingLink.current = null
    savedLinkSelection.current = null
    setLinkOpen(false)
    setLinkText('')
    setLinkUrl('')
  }

  function handleEditorClick(event: ReactMouseEvent<HTMLDivElement>) {
    const target = event.target instanceof HTMLElement ? event.target.closest('a') : null
    if (!(target instanceof HTMLAnchorElement) || !editor.current?.contains(target)) return
    event.preventDefault()
    editLink(target)
  }

  function applyLink() {
    const range = savedLinkSelection.current
    const enteredUrl = linkUrl.trim()
    const href = /^[a-z][a-z\d+.-]*:/iu.test(enteredUrl) ? enteredUrl : `https://${enteredUrl}`
    let url: URL
    try {
      url = new URL(href)
    } catch {
      return
    }
    if (!editor.current || !['http:', 'https:'].includes(url.protocol)) return
    editor.current.focus()
    const selection = window.getSelection()
    const existingLink = editingLink.current
    let link: HTMLAnchorElement
    if (existingLink && editor.current.contains(existingLink)) {
      link = existingLink
      link.href = url.toString()
      link.textContent = linkText.trim() || enteredUrl
    } else {
      if (!range) return
      selection?.removeAllRanges()
      selection?.addRange(range)
      range.deleteContents()
      link = document.createElement('a')
      link.href = url.toString()
      link.textContent = linkText.trim() || enteredUrl
      range.insertNode(link)
    }
    const nextRange = document.createRange()
    nextRange.setStartAfter(link)
    nextRange.collapse(true)
    selection?.removeAllRanges()
    selection?.addRange(nextRange)
    syncComment()
    closeLinkEditor()
  }

  function removeLink() {
    const link = editingLink.current
    if (!editor.current || !link || !editor.current.contains(link)) return
    const text = document.createTextNode(link.textContent ?? '')
    link.replaceWith(text)
    const selection = window.getSelection()
    const range = document.createRange()
    range.setStartAfter(text)
    range.collapse(true)
    selection?.removeAllRanges()
    selection?.addRange(range)
    syncComment()
    closeLinkEditor()
  }

  function handleLinkFieldKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (!linkUrl.trim()) {
      linkUrlInput.current?.focus()
      return
    }
    applyLink()
  }

  function prepareComment(_event: FormEvent<HTMLFormElement>) {
    if (editor.current && body.current) body.current.value = documentFromEditor(editor.current)
  }

  function syncComment() {
    if (editor.current && body.current) body.current.value = documentFromEditor(editor.current)
  }

  const editingExistingLink = linkOpen && editingLink.current !== null

  return (
    <form action={action} onSubmit={prepareComment} className={`${variant === 'edit' ? '' : 'mt-6 '}rounded-xl border p-5 ${variant === 'edit' && fixedCoachesOnly ? 'border-amber-200 bg-amber-50' : 'border-warm-grey bg-warm-white'}`}>
      {variant === 'new' && (
        <div className="flex items-center gap-3">
          <MemberAvatar name={author.name} src={author.avatarUrl} size="small" />
          <div>
            <p className="text-sm font-bold text-brand-black">{author.name}</p>
            <p className="text-xs text-mid-grey">Add a comment</p>
          </div>
        </div>
      )}
      <div className={`${variant === 'new' ? 'mt-4' : ''} overflow-hidden rounded-lg border border-warm-grey bg-white focus-within:border-rich-red focus-within:ring-2 focus-within:ring-light-red`}>
        <div className="flex items-center gap-1 border-b border-warm-grey px-2 py-1.5" aria-label="Comment formatting">
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format('bold')} aria-label="Bold" className="flex h-9 w-9 items-center justify-center rounded font-bold text-brand-black hover:bg-warm-white">B</button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => format('italic')} aria-label="Italic" className="flex h-9 w-9 items-center justify-center rounded font-serif italic text-brand-black hover:bg-warm-white">I</button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={makeList} aria-label="Bulleted list" className="flex h-9 w-9 items-center justify-center rounded text-brand-black hover:bg-warm-white"><HiListBullet className="h-5 w-5" /></button>
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={openLink} aria-label="Link" aria-expanded={linkOpen} className="flex h-9 w-9 items-center justify-center rounded text-brand-black hover:bg-warm-white"><HiLink className="h-5 w-5" /></button>
        </div>
        {linkOpen && (
          <div className="grid gap-2 border-b border-warm-grey bg-warm-white px-3 py-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-brand-black">Link text<input type="text" value={linkText} onChange={(event) => setLinkText(event.target.value)} onKeyDown={handleLinkFieldKeyDown} placeholder="What people will see" className="mt-1 min-h-10 w-full rounded-md border border-warm-grey bg-white px-3 text-sm font-normal text-brand-black focus:border-rich-red focus:outline-none" /></label>
            <label className="text-xs font-bold text-brand-black">Web address<input ref={linkUrlInput} type="text" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} onKeyDown={handleLinkFieldKeyDown} placeholder="ev.church" className="mt-1 min-h-10 w-full rounded-md border border-warm-grey bg-white px-3 text-sm font-normal text-brand-black focus:border-rich-red focus:outline-none" /></label>
            <div className="flex items-center gap-2 sm:col-span-2 sm:justify-end">
              {editingExistingLink && <button type="button" onClick={removeLink} className="mr-auto min-h-10 px-2 text-sm font-bold text-rich-red hover:underline">Remove link</button>}
              <button type="button" onClick={closeLinkEditor} className="min-h-10 px-2 text-sm font-bold text-mid-grey hover:text-brand-black">Cancel</button>
              <button type="button" onClick={applyLink} disabled={!linkUrl.trim()} className="min-h-10 rounded-md bg-brand-black px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{editingExistingLink ? 'Update link' : 'Add link'}</button>
            </div>
          </div>
        )}
        <div ref={editor} contentEditable suppressContentEditableWarning role="textbox" aria-label="Comment" aria-multiline="true" onClick={handleEditorClick} onInput={syncComment} className="min-h-32 w-full bg-white p-3 text-sm text-brand-black outline-none empty:before:text-mid-grey empty:before:content-['Write_a_comment…'] [&_a]:cursor-pointer [&_a]:font-semibold [&_a]:text-rich-red [&_a]:underline [&_a]:decoration-rich-red [&_a]:underline-offset-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5" />
        <input ref={body} type="hidden" name="body" />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        {canPostCoachesOnly ? <label className="flex items-center gap-2 text-sm font-semibold text-dark-grey"><input type="checkbox" name="coachesOnly" defaultChecked={initialCoachesOnly} className="h-4 w-4 accent-rich-red" />Coaches only</label> : <span />}
        <div className="flex items-center gap-2">
          {onCancel && <button type="button" onClick={onCancel} className="rounded-lg px-4 py-3 text-sm font-bold text-mid-grey hover:text-brand-black">Cancel</button>}
          <CommentSubmitButton variant={variant} />
        </div>
      </div>
    </form>
  )
}
