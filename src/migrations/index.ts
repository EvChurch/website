import * as migration_20260301_000000_initial_schema from './20260301_000000_initial_schema';
import * as migration_20260330_000000_add_latest_sermon_block from './20260330_000000_add_latest_sermon_block';

export const migrations = [
  {
    up: migration_20260301_000000_initial_schema.up,
    down: migration_20260301_000000_initial_schema.down,
    name: '20260301_000000_initial_schema',
  },
  {
    up: migration_20260330_000000_add_latest_sermon_block.up,
    down: migration_20260330_000000_add_latest_sermon_block.down,
    name: '20260330_000000_add_latest_sermon_block',
  },
];
