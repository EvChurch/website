interface StoredUpload {
  filename?: string | null
  prefix?: string | null
  _objectKey?: string | null
}

/** Existing uploads have no object key; keep their original storage path. */
export function payloadStorageKey(file: StoredUpload, defaultPrefix = ''): string {
  if (!file.filename) throw new Error('Upload filename is missing.')
  return [file.prefix || defaultPrefix, file._objectKey, file.filename]
    .filter(Boolean)
    .join('/')
}
