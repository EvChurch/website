import { describe, expect, it, vi } from 'vitest'

import {
  FEEDBACK_TRIAGE_ASSESSMENT_DOWN_SQL,
  FEEDBACK_TRIAGE_ASSESSMENT_UP_SQL,
  down,
  up,
} from '../migrations/20260813_230000_feedback_triage_assessment'

function migrationArgs(execute = vi.fn().mockResolvedValue(undefined)) {
  return {
    args: { db: { execute }, payload: {}, req: {} } as never,
    execute,
  }
}

describe('feedback triage assessment migration', () => {
  it('adds auditable triage fields and a canonical duplicate relationship', () => {
    for (const field of [
      'triage_summary',
      'classification',
      'risk',
      'requester_rank',
      'area_relevance',
      'priority',
      'recommendation',
      'duplicate_of_id',
      'triaged_at',
      'triage_run_id',
      'triage_version',
      'requester_team_member_id',
      'requester_name_snapshot',
      'requester_role_snapshot',
      'requester_team_group_snapshot',
      'recommendation_rationale',
      'delivery_kind',
      'delivery_phase',
      'delivery_run_id',
      'delivery_branch',
      'delivery_pr_url',
      'delivery_merge_commit',
      'delivery_deployment_id',
      'delivery_verification_result',
      'delivery_last_verified_at',
      'delivery_failure_note',
    ]) {
      expect(FEEDBACK_TRIAGE_ASSESSMENT_UP_SQL).toContain(`"${field}"`)
    }
    expect(FEEDBACK_TRIAGE_ASSESSMENT_UP_SQL).toContain(
      'REFERENCES "public"."feedback_submissions"("id")',
    )
    expect(FEEDBACK_TRIAGE_ASSESSMENT_UP_SQL).toContain(
      'CREATE TRIGGER "feedback_submissions_prevent_canonical_delete"',
    )
    expect(FEEDBACK_TRIAGE_ASSESSMENT_DOWN_SQL).toContain(
      'DROP FUNCTION IF EXISTS prevent_canonical_feedback_deletion()',
    )
  })

  it('adds non-final approval and final duplicate resolution states', () => {
    expect(FEEDBACK_TRIAGE_ASSESSMENT_UP_SQL).toContain("'needs-approval'")
    expect(FEEDBACK_TRIAGE_ASSESSMENT_UP_SQL).toContain("'duplicate'")
    expect(FEEDBACK_TRIAGE_ASSESSMENT_DOWN_SQL).toContain(
      "WHERE \"resolution_status\" IN ('needs-approval', 'duplicate')",
    )
  })

  it('is additive, bounded, and does not grant MCP permissions', () => {
    expect(FEEDBACK_TRIAGE_ASSESSMENT_UP_SQL).toContain("lock_timeout = '5s'")
    expect(FEEDBACK_TRIAGE_ASSESSMENT_UP_SQL).toContain("statement_timeout = '30s'")
    expect(FEEDBACK_TRIAGE_ASSESSMENT_UP_SQL).toContain('ADD COLUMN IF NOT EXISTS')
    expect(FEEDBACK_TRIAGE_ASSESSMENT_UP_SQL).not.toMatch(/DELETE\s+FROM/i)
    expect(FEEDBACK_TRIAGE_ASSESSMENT_UP_SQL).not.toContain('payload_mcp_api_keys')
  })

  it('runs one atomic SQL batch in each direction', async () => {
    const upArgs = migrationArgs()
    await up(upArgs.args)
    expect(upArgs.execute).toHaveBeenCalledOnce()

    const downArgs = migrationArgs()
    await down(downArgs.args)
    expect(downArgs.execute).toHaveBeenCalledOnce()
  })
})
