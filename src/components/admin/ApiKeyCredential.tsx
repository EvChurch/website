'use client'
import { Button, useDocumentInfo, useFormModified } from '@payloadcms/ui'
import { useState } from 'react'
export function ApiKeyCredential() {
  const {id, data} = useDocumentInfo()
  const modified = useFormModified()
  const [secret,setSecret] = useState(''), [error,setError] = useState(''), [busy,setBusy] = useState(false), [generated,setGenerated] = useState(false)
  if (!id || modified) return <p>Save this API key before generating its credential.</p>
  if (data?.revoked) return <p>This API key has been revoked.</p>
  if (secret) return <div><p>Copy this secret now. It will only be shown once.</p><textarea aria-label="API key secret" readOnly value={secret} rows={3} style={{width:'100%'}} /><Button buttonStyle="secondary" onClick={() => setSecret('')}>Dismiss secret</Button></div>
  if (data?.generatedAt || generated) return <p>Credential generated. Create another API key to issue a replacement.</p>
  return <div><Button disabled={busy} onClick={async () => {
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/api-keys/${encodeURIComponent(id)}/generate`,{method:'POST',credentials:'same-origin',cache:'no-store'})
      const result = await response.json() as {secret?:string;error?:string}
      if (!response.ok || !result.secret) throw new Error(result.error ?? 'Unable to generate the key.')
      setSecret(result.secret); setGenerated(true)
    } catch(error) {setError(error instanceof Error ? error.message : 'Unable to generate the key.')}
    finally {setBusy(false)}
  }}>Generate API key</Button>{error && <p role="alert">{error}</p>}</div>
}
