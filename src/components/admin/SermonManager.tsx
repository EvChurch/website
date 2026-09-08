'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { SermonProduction, Sermon, SermonWorkFile } from '@/payload-types'
import type { SermonMetadata } from '@/lib/sermon-management/workflow'
import type { DriveRecording } from '@/lib/sermon-management/drive'
import { SermonWaveform } from './SermonWaveform'
import './sermon-manager.css'

interface Option {
  id: number
  name?: string
  title?: string
}
interface Dashboard {
  sermons: {
    docs: Pick<Sermon, 'id' | 'title' | 'publishedAt' | 'isPublished'>[]
    page?: number
    totalPages: number
  }
  productions: SermonProduction[]
  speakers: Option[]
  series: Option[]
  topics: Option[]
  campuses: Option[]
  scriptures: Option[]
  folders: { folderId: string; campus: number | Option }[]
  topicReviews: { id: number; title: string; topicSuggestions?: unknown }[]
  configured: boolean
}
const api = '/api/sermon-manager'
async function request<T>(url: string, body?: object): Promise<T> {
  const response = await fetch(
    url,
    body
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      : { cache: 'no-store' },
  )
  const result = await response.json()
  if (!response.ok)
    throw new Error(
      result.error ||
        result.errors?.[0]?.message ||
        'Unable to complete this action.',
    )
  return result as T
}
function id(value: number | { id: number } | null | undefined) {
  return typeof value === 'number' ? value : value?.id
}
function fileUrl(value: number | SermonWorkFile | null | undefined) {
  return typeof value === 'object' && value ? value.url || '' : ''
}
function timestamp(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return `${hours}:${String(mins).padStart(2, '0')}:${(seconds % 60).toFixed(1).padStart(4, '0')}`
}
const statusLabel: Record<SermonProduction['status'], string> = {
  importing: 'Preparing recording',
  editable: 'Ready to cut',
  rendering: 'Preparing finished audio',
  ready: 'Ready for review',
  failed: 'Needs attention',
  published: 'Published',
  discarded: 'Discarded',
}

export function SermonManager() {
  const [dashboard, setDashboard] = useState<Dashboard>()
  const [production, setProduction] = useState<SermonProduction>()
  const [metadata, setMetadata] = useState<SermonMetadata>()
  const [dirty, setDirty] = useState(false)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(0)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [picker, setPicker] = useState(false)
  const [folder, setFolder] = useState('all')
  const [recordings, setRecordings] = useState<DriveRecording[]>([])
  const [nextPage, setNextPage] = useState<string>()
  const [search, setSearch] = useState('')
  const [newTag, setNewTag] = useState<{
    field: 'audioSpeaker' | 'series' | 'topics'
    name: string
  }>()
  const audio = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(1)
  const stopAt = useRef<number | null>(null)
  useEffect(() => {
    if (!playing) return
    let frame: number
    const tick = () => {
      const player = audio.current
      if (!player) {
        setPlaying(false)
        return
      }
      if (player) {
        if (stopAt.current !== null && player.currentTime >= stopAt.current) {
          player.pause()
          player.currentTime = stopAt.current
          stopAt.current = null
        }
        setCurrentTime(player.currentTime)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing])

  const loadDashboard = useCallback(async (query = '', page = 1) => {
    const result = await request<Dashboard>(
      `${api}?search=${encodeURIComponent(query)}&page=${page}`,
    )
    setDashboard(result)
    setFolder((current) => current || result.folders[0]?.folderId || '')
  }, [])
  const loadProduction = useCallback(async (productionId: number) => {
    const { production: row } = await request<{ production: SermonProduction }>(
      `${api}?production=${productionId}`,
    )
    setProduction(row)
    setMetadata(row.metadata as unknown as SermonMetadata)
    setStart(row.start || 0)
    setEnd(row.end || row.sourceDuration || 0)
    setConfirmed(false)
    setDirty(false)
    return row
  }, [])
  useEffect(() => {
    void loadDashboard().catch((failure: Error) => setError(failure.message))
  }, [loadDashboard])
  useEffect(() => {
    if (!production || !['importing', 'rendering'].includes(production.status))
      return
    const timer = setInterval(() => {
      void loadProduction(production.id).catch((failure: Error) =>
        setError(failure.message),
      )
    }, 5000)
    return () => clearInterval(timer)
  }, [production, loadProduction])

  async function perform(work: () => Promise<void>) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await work()
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Unable to complete this action.',
      )
    } finally {
      setBusy(false)
    }
  }
  async function browse(folderId: string, pageToken?: string) {
    setFolder(folderId)
    await perform(async () => {
      const result = await request<{
        files: DriveRecording[]
        nextPageToken?: string
      }>(
        `${api}?folder=${encodeURIComponent(folderId)}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`,
      )
      setRecordings((existing) =>
        pageToken ? [...existing, ...result.files] : result.files,
      )
      setNextPage(result.nextPageToken)
    })
  }
  async function begin(sermonId?: number, fileId?: string) {
    await perform(async () => {
      const result = await request<{ id: number }>(api, {
        action: 'begin',
        sermonId,
        fileId,
        ...(fileId && production
          ? {
              metadata,
              previousProductionId: production.id,
              previousToken: production.jobToken,
            }
          : {}),
      })
      await loadProduction(result.id)
      setPicker(false)
    })
  }
  async function action(actionName: string) {
    if (!production) return
    await perform(async () => {
      await request(api, {
        action: actionName,
        id: production.id,
        token: production.jobToken,
        metadata,
        start,
        end,
        previewConfirmed: confirmed,
      })
      await loadProduction(production.id)
      if (actionName === 'discard') {
        setProduction(undefined)
        await loadDashboard()
      }
      if (actionName === 'refresh-calendar') await loadDashboard()
      if (actionName === 'save') setNotice('Draft saved.')
      if (actionName === 'publish') {
        setNotice('Published to the website and podcast.')
        await loadDashboard()
      }
    })
  }
  function updateMetadata(values: Partial<SermonMetadata>) {
    setMetadata((old) => (old ? { ...old, ...values } : old))
    setDirty(true)
    setConfirmed(false)
  }
  function changeCut(from: number, to: number) {
    setStart(from)
    setEnd(to)
    setConfirmed(false)
  }
  function seek(time: number) {
    stopAt.current = null
    if (audio.current) audio.current.currentTime = Math.max(0, time)
    setCurrentTime(Math.max(0, time))
  }
  function listen(time: number, until: number) {
    seek(time)
    stopAt.current = until
    void audio.current
      ?.play()
      .catch(() => setError('Press Play to start playback.'))
  }
  const processing = Boolean(
    production && ['importing', 'rendering'].includes(production.status),
  )
  const locked =
    busy ||
    processing ||
    production?.status === 'published' ||
    production?.status === 'discarded'
  const cutsChanged = Boolean(
    production?.source &&
    (start !== production.start || end !== production.end),
  )
  const finishedUrl = production
    ? fileUrl(production.output) ||
      (typeof production.publishedAudio === 'object'
        ? production.publishedAudio?.url || ''
        : '')
    : ''
  const selectedOptions = (event: React.ChangeEvent<HTMLSelectElement>) =>
    Array.from(event.target.selectedOptions, (option) => Number(option.value))

  return (
    <div className="sermon-manager">
      <header className="sermon-manager__header">
        <div>
          <p className="sermon-manager__eyebrow">
            Ev Church · Audio publishing
          </p>
          <h1>Sermon Manager</h1>
          <p>Prepare a recording, review the finished sermon, and publish.</p>
        </div>
        <nav aria-label="Sermon administration">
          <Link href="/admin/collections/speakers">Speakers</Link>
          <Link href="/admin/collections/sermon-series">Series</Link>
          <Link href="/admin/collections/topics">Topics</Link>
          <Link href="/admin/collections/sermon-transcripts">Transcripts</Link>
          <Link href="/admin/globals/sermon-settings">Settings</Link>
        </nav>
      </header>
      {error && (
        <p className="sermon-manager__error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="sermon-manager__notice" role="status">
          {notice}
        </p>
      )}
      {!dashboard ? (
        <p>Loading sermons…</p>
      ) : (
        <>
          {!dashboard.configured && (
            <p className="sermon-manager__notice">
              Before importing recordings, an administrator needs to connect
              Google Drive and configure the campus folders and outro in Sermon
              Settings.
            </p>
          )}
          {!production && dashboard.topicReviews?.length > 0 && <section>
            <h2>Suggested topics</h2>
            {dashboard.topicReviews.map(sermon => <div key={sermon.id}>
              <h3>{sermon.title}</h3>
              {Array.isArray(sermon.topicSuggestions) && sermon.topicSuggestions.filter((name): name is string => typeof name === 'string').map(name => <p key={name}>
                {name}{' '}
                <button disabled={busy} onClick={() => void perform(async () => { await request(api, { action: 'approve-topic', sermonId: sermon.id, name }); await loadDashboard() })}>Approve topic</button>{' '}
                <button disabled={busy} onClick={() => void perform(async () => { await request(api, { action: 'dismiss-topic', sermonId: sermon.id, name }); await loadDashboard() })}>Dismiss</button>
              </p>)}
            </div>)}
          </section>}
          {!production && !picker && (
            <>
              <button
                className="sermon-manager__primary"
                disabled={busy}
                onClick={() => {
                  setPicker(true)
                  if (folder) void browse(folder)
                }}
              >
                Choose a Drive recording
              </button>
              <section>
                <h2>Needs attention</h2>
                {dashboard.productions.length ? (
                  <ul className="sermon-manager__list">
                    {dashboard.productions.map((row) => (
                      <li key={row.id}>
                        <button
                          disabled={busy}
                          onClick={() =>
                            void perform(async () => {
                              await loadProduction(row.id)
                            })
                          }
                        >
                          {row.sourceName}
                        </button>
                        <span>{statusLabel[row.status]}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No sermons awaiting preparation or review.</p>
                )}
              </section>
              <section>
                <h2>Sermon archive</h2>
                <form
                  className="sermon-manager__row"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void perform(() => loadDashboard(search))
                  }}
                >
                  <input
                    aria-label="Search sermon titles"
                    placeholder="Search sermon titles"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  <button disabled={busy}>Search</button>
                </form>
                <ul className="sermon-manager__list">
                  {dashboard.sermons.docs.map((sermon) => (
                    <li key={sermon.id}>
                      <button
                        disabled={busy}
                        onClick={() => void begin(sermon.id)}
                      >
                        {sermon.title}
                      </button>
                      <span>
                        {sermon.isPublished ? 'Published' : 'Draft'}
                        {sermon.publishedAt
                          ? ` · ${new Date(sermon.publishedAt).toLocaleDateString()}`
                          : ''}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="sermon-manager__row">
                  <button
                    disabled={busy || (dashboard.sermons.page || 1) <= 1}
                    onClick={() =>
                      void perform(() =>
                        loadDashboard(
                          search,
                          (dashboard.sermons.page || 1) - 1,
                        ),
                      )
                    }
                  >
                    Previous
                  </button>
                  <span>
                    Page {dashboard.sermons.page || 1} of{' '}
                    {dashboard.sermons.totalPages}
                  </span>
                  <button
                    disabled={
                      busy ||
                      (dashboard.sermons.page || 1) >=
                        dashboard.sermons.totalPages
                    }
                    onClick={() =>
                      void perform(() =>
                        loadDashboard(
                          search,
                          (dashboard.sermons.page || 1) + 1,
                        ),
                      )
                    }
                  >
                    Next
                  </button>
                </div>
              </section>
            </>
          )}
          {picker && (
            <section>
              <h2>Choose the best campus recording</h2>
              <p>
                The original stays in Drive. Import a recording to listen and
                choose the cut.
              </p>
              <div className="sermon-manager__row">
                <select
                  aria-label="Campus recording folder"
                  value={folder}
                  disabled={busy}
                  onChange={(event) => void browse(event.target.value)}
                >
                  <option value="all">All campuses</option>
                  {dashboard.folders.map((row) => (
                    <option key={row.folderId} value={row.folderId}>
                      {typeof row.campus === 'object'
                        ? row.campus.name
                        : dashboard.campuses.find(
                            (campus) => campus.id === row.campus,
                          )?.name}
                    </option>
                  ))}
                </select>
                <button disabled={busy} onClick={() => setPicker(false)}>
                  Cancel
                </button>
              </div>
              <ul className="sermon-manager__list">
                {recordings.map((file) => (
                  <li key={file.id}>
                    <div>
                      <strong>{file.name}</strong>
                      {file.campusName && <p>{file.campusName}</p>}
                      <p>
                        {new Date(file.modifiedTime).toLocaleString()} ·{' '}
                        {(Number(file.size) / 1024 / 1024).toFixed(0)} MB
                      </p>
                      <audio
                        aria-label={`Preview ${file.name}`}
                        controls
                        preload="none"
                        src={`${api}?listen=${encodeURIComponent(file.id)}`}
                      />
                    </div>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void begin(id(production?.sermon), file.id)
                      }
                    >
                      Use recording
                    </button>
                  </li>
                ))}
              </ul>
              {!busy && !recordings.length && (
                <p>No recordings found in this folder.</p>
              )}
              {nextPage && (
                <button
                  disabled={busy}
                  onClick={() => void browse(folder, nextPage)}
                >
                  Load more recordings
                </button>
              )}
            </section>
          )}
          {production && !picker && (
            <>
              <div className="sermon-manager__row">
                <button
                  disabled={busy || dirty || cutsChanged}
                  onClick={() => {
                    setProduction(undefined)
                    setMetadata(undefined)
                    void perform(() => loadDashboard())
                  }}
                >
                  Back to dashboard
                </button>
                <strong role="status">{statusLabel[production.status]}</strong>
              </div>
              <h2>{production.sourceName}</h2>
              {production.status !== 'published' && (
                <button
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        'Discard this draft? Published audio will stay available.',
                      )
                    )
                      void action('discard')
                  }}
                >
                  Discard draft
                </button>
              )}
              {processing && (
                <p role="status">
                  Audio preparation is running in the background. You can leave
                  this page and return later.
                </p>
              )}
              {production.error && (
                <p className="sermon-manager__error">{production.error}</p>
              )}
              {(production.status === 'failed' ||
                (processing &&
                  Date.now() - Date.parse(production.updatedAt) >
                    45 * 60_000)) && (
                <button disabled={busy} onClick={() => void action('retry')}>
                  Retry audio preparation
                </button>
              )}
              {!locked && (
                <button
                  onClick={() => {
                    setPicker(true)
                    if (folder) void browse(folder)
                  }}
                >
                  Choose another campus recording
                </button>
              )}
              {fileUrl(production.listeningCopy) && (
                <section>
                  <h2>1. Cut the recording</h2>
                  <audio
                    ref={audio}
                    preload="metadata"
                    src={fileUrl(production.listeningCopy)}
                    onLoadedMetadata={() => {
                      if (audio.current) audio.current.volume = volume
                      setCurrentTime(audio.current?.currentTime || 0)
                    }}
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    onEnded={() => setPlaying(false)}
                    onEmptied={() => {
                      setPlaying(false)
                      setCurrentTime(0)
                      stopAt.current = null
                    }}
                    onSeeked={() =>
                      setCurrentTime(audio.current?.currentTime || 0)
                    }
                  />
                  <div className="sermon-manager__row">
                    <button
                      type="button"
                      onClick={() => {
                        if (playing) audio.current?.pause()
                        else
                          void audio.current
                            ?.play()
                            .catch(() =>
                              setError(
                                'Unable to play the recording. Try again.',
                              ),
                            )
                      }}
                    >
                      {playing ? 'Pause' : 'Play'}
                    </button>
                    <output aria-label="Playback position">
                      {timestamp(currentTime)}
                    </output>
                    <button
                      type="button"
                      aria-label={volume === 0 ? 'Unmute' : 'Mute'}
                      onClick={() => {
                        const next = volume === 0 ? 1 : 0
                        setVolume(next)
                        if (audio.current) audio.current.volume = next
                      }}
                    >
                      {volume === 0 ? '🔇' : '🔊'}
                    </button>
                    <input
                      aria-label="Volume"
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={volume}
                      onChange={(event) => {
                        const next = Number(event.target.value)
                        setVolume(next)
                        if (audio.current) audio.current.volume = next
                      }}
                    />
                  </div>
                  <fieldset disabled={locked}>
                    <legend>Select one continuous section</legend>
                    <SermonWaveform
                      key={production.id}
                      currentTime={currentTime}
                      disabled={locked}
                      onAudition={listen}
                      peaks={
                        Array.isArray(production.peaks)
                          ? production.peaks.filter(
                              (peak): peak is number =>
                                typeof peak === 'number',
                            )
                          : []
                      }
                      duration={production.sourceDuration || 1}
                      start={start}
                      end={end}
                      onChange={(from, to) => {
                        if (!locked) changeCut(from, to)
                      }}
                      onSeek={seek}
                    />
                    <button
                      className="sermon-manager__primary"
                      disabled={start >= end}
                      onClick={() => void action('render')}
                    >
                      Prepare finished audio
                    </button>
                  </fieldset>
                </section>
              )}
              {metadata && (
                <section>
                  <h2>2. Sermon details</h2>
                  {production.calendarNotice && <p role="status">{production.calendarNotice}</p>}
                  <button disabled={locked} onClick={() => void action('refresh-calendar')}>Refresh from calendar</button>
                  <fieldset disabled={locked}>
                    <legend>Required before publishing</legend>
                    <div className="sermon-manager__grid">
                      <label>
                        Title *
                        <input
                          value={metadata.title}
                          onChange={(event) =>
                            updateMetadata({ title: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        Sermon date *
                        <input
                          type="date"
                          value={metadata.publishedAt?.slice(0, 10) || ''}
                          onChange={(event) =>
                            updateMetadata({ publishedAt: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        Speaker *
                        <select
                          value={metadata.audioSpeaker || ''}
                          onChange={(event) =>
                            updateMetadata({
                              audioSpeaker:
                                Number(event.target.value) || undefined,
                            })
                          }
                        >
                          <option value="">Choose a speaker</option>
                          {dashboard.speakers.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            setNewTag({ field: 'audioSpeaker', name: '' })
                          }
                        >
                          Create speaker
                        </button>
                      </label>
                      <label>
                        Recording campus *
                        <select
                          value={metadata.audioCampus || ''}
                          onChange={(event) =>
                            updateMetadata({
                              audioCampus:
                                Number(event.target.value) || undefined,
                            })
                          }
                        >
                          <option value="">Choose a campus</option>
                          {dashboard.campuses.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Bible passage *
                        <input
                          placeholder="e.g. John 3:1–21"
                          value={metadata.passageReference}
                          onChange={(event) =>
                            updateMetadata({
                              passageReference: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label>
                        Bible books
                        <select
                          multiple
                          value={metadata.scriptures.map(String)}
                          onChange={(event) =>
                            updateMetadata({
                              scriptures: selectedOptions(event),
                            })
                          }
                        >
                          {dashboard.scriptures.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      {(['series', 'topics'] as const).map((field) => (
                        <label key={field}>
                          {field === 'series' ? 'Series *' : 'Topics'}
                          <select
                            multiple
                            value={metadata[field].map(String)}
                            onChange={(event) =>
                              updateMetadata({
                                [field]: selectedOptions(event),
                              })
                            }
                          >
                            {dashboard[field].map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.title || option.name}
                              </option>
                            ))}
                          </select>
                          <small>
                            {field === 'series' ? 'Select at least one.' : 'Generated from the transcript after publication.'} Use Ctrl or Command to select more.
                          </small>
                          <button
                            type="button"
                            onClick={() => setNewTag({ field, name: '' })}
                          >
                            Create {field === 'series' ? 'series' : 'topic'}
                          </button>
                        </label>
                      ))}
                    </div>
                    <button
                      disabled={!dirty && !cutsChanged}
                      onClick={() => void action('save')}
                    >
                      Save draft
                    </button>
                  </fieldset>
                  {newTag && (
                    <form
                      className="sermon-manager__row"
                      onSubmit={(event) => {
                        event.preventDefault()
                        void perform(async () => {
                          const field = newTag.field
                          const collection =
                            field === 'audioSpeaker'
                              ? 'speakers'
                              : field === 'series'
                                ? 'sermon-series'
                                : 'topics'
                          const result = await request<{ doc: Option }>(
                            `/api/${collection}`,
                            {
                              [field === 'series' ? 'title' : 'name']:
                                newTag.name,
                            },
                          )
                          updateMetadata(
                            field === 'audioSpeaker'
                              ? { audioSpeaker: result.doc.id }
                              : {
                                  [field]: [...metadata[field], result.doc.id],
                                },
                          )
                          await loadDashboard()
                          setNewTag(undefined)
                        })
                      }}
                    >
                      <input
                        required
                        aria-label="New entry name"
                        placeholder="Name"
                        value={newTag.name}
                        onChange={(event) =>
                          setNewTag({ ...newTag, name: event.target.value })
                        }
                      />
                      <button disabled={busy}>Create and select</button>
                      <button
                        type="button"
                        onClick={() => setNewTag(undefined)}
                      >
                        Cancel
                      </button>
                    </form>
                  )}
                </section>
              )}
              {finishedUrl && (
                <section>
                  <h2>3. Review and publish</h2>
                  <audio
                    key={finishedUrl}
                    controls
                    preload="metadata"
                    src={finishedUrl}
                  />
                  {production.status !== 'published' && (
                    <>
                      <label className="sermon-manager__confirm">
                        <input
                          type="checkbox"
                          checked={confirmed}
                          disabled={locked || dirty || cutsChanged}
                          onChange={(event) =>
                            setConfirmed(event.target.checked)
                          }
                        />
                        I have listened to the finished audio and checked the
                        sermon details.
                      </label>
                      {dirty && (
                        <p>Save your draft details before publishing.</p>
                      )}
                      {cutsChanged && (
                        <p>
                          Prepare the audio again to preview your updated cut.
                        </p>
                      )}
                      <button
                        className="sermon-manager__primary"
                        disabled={
                          locked ||
                          !confirmed ||
                          dirty ||
                          cutsChanged ||
                          production.status !== 'ready'
                        }
                        onClick={() => void action('publish')}
                      >
                        Publish to website and podcast
                      </button>
                    </>
                  )}
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
