import * as migration_20260330_195149 from './20260330_195149';
import * as migration_20260330_210020 from './20260330_210020';
import * as migration_20260330_223741 from './20260330_223741';
import * as migration_20260331_190736_add_key_color from './20260331_190736_add_key_color';
import * as migration_20260331_233500_add_banner_overlay from './20260331_233500_add_banner_overlay';
import * as migration_20260405_121839 from './20260405_121839';

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
    name: '20260330_223741',
  },
  {
    up: migration_20260331_190736_add_key_color.up,
    down: migration_20260331_190736_add_key_color.down,
    name: '20260331_190736_add_key_color',
  },
  {
    up: migration_20260331_233500_add_banner_overlay.up,
    down: migration_20260331_233500_add_banner_overlay.down,
    name: '20260331_233500_add_banner_overlay',
  },
  {
    up: migration_20260405_121839.up,
    down: migration_20260405_121839.down,
    name: '20260405_121839'
  },
];
