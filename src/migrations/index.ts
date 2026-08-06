import * as migration_20260330_195149 from './20260330_195149';
import * as migration_20260330_210020 from './20260330_210020';
import * as migration_20260330_223741 from './20260330_223741';
import * as migration_20260331_190736_add_key_color from './20260331_190736_add_key_color';
import * as migration_20260331_233500_add_banner_overlay from './20260331_233500_add_banner_overlay';
import * as migration_20260405_121839 from './20260405_121839';
import * as migration_20260405_212901_per_video_boundaries from './20260405_212901_per_video_boundaries';
import * as migration_20260407_222651_speaker_per_media from './20260407_222651_speaker_per_media';
import * as migration_20260803_110431_rock_form_embed from './20260803_110431_rock_form_embed';
import * as migration_20260804_rock_connection_signup from './20260804_rock_connection_signup';
import * as migration_20260806_auth0_admin_sso from './20260806_auth0_admin_sso';

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
    name: '20260405_121839',
  },
  {
    up: migration_20260405_212901_per_video_boundaries.up,
    down: migration_20260405_212901_per_video_boundaries.down,
    name: '20260405_212901_per_video_boundaries',
  },
  {
    up: migration_20260407_222651_speaker_per_media.up,
    down: migration_20260407_222651_speaker_per_media.down,
    name: '20260407_222651_speaker_per_media',
  },
  {
    up: migration_20260803_110431_rock_form_embed.up,
    down: migration_20260803_110431_rock_form_embed.down,
    name: '20260803_110431_rock_form_embed'
  },
  {
    up: migration_20260804_rock_connection_signup.up,
    down: migration_20260804_rock_connection_signup.down,
    name: '20260804_rock_connection_signup',
  },
  {
    up: migration_20260806_auth0_admin_sso.up,
    down: migration_20260806_auth0_admin_sso.down,
    name: '20260806_auth0_admin_sso',
  },
];
