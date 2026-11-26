/** Deliberately limited to the disposable courses QA database. */
export function assertLocalCourseImportTarget(connectionString: string | undefined) {
  if (!connectionString) throw new Error('DATABASE_URL is required')
  const url = new URL(connectionString)
  const host = url.searchParams.get('host') ?? url.hostname
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.pathname !== '/ev_courses_dev' ||
    !['localhost', '127.0.0.1', '[::1]', '/var/run/postgresql'].includes(host) || url.searchParams.has('hostaddr')) {
    throw new Error('Course import requires local ev_courses_dev')
  }
}

export function assertLocalCourseImportDatabase(database: string, address: string | null) {
  if (database !== 'ev_courses_dev' || ![null, '127.0.0.1', '::1'].includes(address)) {
    throw new Error('Connected database is not local ev_courses_dev')
  }
}
