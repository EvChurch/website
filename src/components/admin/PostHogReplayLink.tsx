'use client'

import { FieldLabel, useField } from '@payloadcms/ui'
import type { TextFieldClientComponent } from 'payload'

import { parsePostHogReplayUrl } from '@/lib/site-feedback/validation'

const PostHogReplayLink: TextFieldClientComponent = ({ field, path }) => {
  const { value } = useField<string>({ path })
  const replay = parsePostHogReplayUrl(value)

  return (
    <div className="field-type text">
      <FieldLabel
        label={field.label || 'Session replay'}
        localized={field.localized}
        path={path}
        required={field.required}
      />
      {replay ? (
        <a href={replay.url} target="_blank" rel="noreferrer">
          Open session replay
        </a>
      ) : (
        <p>No session replay was available for this submission.</p>
      )}
    </div>
  )
}

export default PostHogReplayLink
