import { describe, expect, it, vi } from 'vitest'

import {
  MEMBERS_ROCK_SYNC_DOWN_SQL,
  MEMBERS_ROCK_SYNC_UP_SQL,
  down,
  up,
} from '../migrations/20260808_members_rock_sync'

function migrationArgs(execute = vi.fn().mockResolvedValue(undefined)) {
  return {
    args: { db: { execute }, payload: {}, req: {} } as never,
    execute,
  }
}

describe('members Rock sync migration', () => {
  it('creates only the two private mirrors and their normalized child tables', () => {
    expect(MEMBERS_ROCK_SYNC_UP_SQL).toContain('CREATE TABLE "connect_group_participants"')
    expect(MEMBERS_ROCK_SYNC_UP_SQL).toContain(
      'CREATE TABLE "connect_group_participants_phone_numbers"',
    )
    expect(MEMBERS_ROCK_SYNC_UP_SQL).toContain(
      'CREATE TABLE "connect_group_participants_memberships"',
    )
    expect(MEMBERS_ROCK_SYNC_UP_SQL).toContain(
      'CREATE TABLE "connect_group_leader_resources"',
    )
    expect(MEMBERS_ROCK_SYNC_UP_SQL).toContain('person_alias_guid')
    expect(MEMBERS_ROCK_SYNC_UP_SQL).toContain('leader_notes_file_guid')
    expect(MEMBERS_ROCK_SYNC_UP_SQL).not.toContain('DROP TABLE')
  })

  it('adds durable uniqueness and cascade-safe relationships', () => {
    expect(MEMBERS_ROCK_SYNC_UP_SQL).toContain(
      'connect_group_participants_rock_person_id_idx',
    )
    expect(MEMBERS_ROCK_SYNC_UP_SQL).toContain(
      'connect_group_participants_memberships_rock_membership_id_idx',
    )
    expect(MEMBERS_ROCK_SYNC_UP_SQL).toContain(
      'connect_group_leader_resources_rock_id_idx',
    )
    expect(MEMBERS_ROCK_SYNC_UP_SQL).toContain('ON DELETE cascade')
  })

  it('removes only the new schema on rollback', () => {
    expect(MEMBERS_ROCK_SYNC_DOWN_SQL).toContain(
      'DROP TABLE IF EXISTS "connect_group_leader_resources"',
    )
    expect(MEMBERS_ROCK_SYNC_DOWN_SQL).toContain(
      'DROP TABLE IF EXISTS "connect_group_participants"',
    )
    expect(MEMBERS_ROCK_SYNC_DOWN_SQL).not.toContain('DROP TABLE IF EXISTS "connect_groups"')
    expect(MEMBERS_ROCK_SYNC_DOWN_SQL).not.toContain('DROP TABLE IF EXISTS "campuses"')
  })

  it('executes each direction as one atomic batch', async () => {
    const upArgs = migrationArgs()
    await up(upArgs.args)
    expect(upArgs.execute).toHaveBeenCalledOnce()

    const downArgs = migrationArgs()
    await down(downArgs.args)
    expect(downArgs.execute).toHaveBeenCalledOnce()
  })
})
