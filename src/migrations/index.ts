import * as migration_20260330_195149 from './20260330_195149';
import * as migration_20260330_210020 from './20260330_210020';
import * as migration_20260330_223741 from './20260330_223741';

export const migrations = [
  {
    up: migration_20260330_195149.up,
    down: migration_20260330_195149.down,
    name: '20260330_195149',
  },
  {
    up: migration_20260330_210020.up,
    down: migration_20260330_210020.down,
    name: '20260330_210020',
  },
  {
    up: migration_20260330_223741.up,
    down: migration_20260330_223741.down,
    name: '20260330_223741'
  },
];
