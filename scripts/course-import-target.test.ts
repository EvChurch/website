import { describe, expect, it } from 'vitest'
import { assertLocalCourseImportDatabase, assertLocalCourseImportTarget } from './course-import-target'

describe('local course import boundaries', () => {
  it('accepts only the local disposable courses target', () => {
    expect(() => assertLocalCourseImportTarget('postgresql:///ev_courses_dev?host=/var/run/postgresql')).not.toThrow()
    expect(() => assertLocalCourseImportTarget('postgresql://localhost/ev_courses_dev')).not.toThrow()
    for (const url of [undefined, 'postgresql://production.example/ev_courses_dev', 'postgresql://localhost/production', 'postgresql://localhost/ev_courses_dev?hostaddr=203.0.113.1', 'postgresql:///ev_courses_dev']) expect(() => assertLocalCourseImportTarget(url)).toThrow()
  })
  it('independently verifies connected database and server address', () => {
    expect(() => assertLocalCourseImportDatabase('ev_courses_dev', null)).not.toThrow()
    expect(() => assertLocalCourseImportDatabase('ev_courses_dev', '127.0.0.1')).not.toThrow()
    expect(() => assertLocalCourseImportDatabase('production', null)).toThrow()
    expect(() => assertLocalCourseImportDatabase('ev_courses_dev', '203.0.113.1')).toThrow()
  })
})
