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
import * as migration_20260805_012700_featured_events from './20260805_012700_featured_events';
import * as migration_20260805_185400_upcoming_events_block from './20260805_185400_upcoming_events_block';
import * as migration_20260805_234700_campus_managed_pages from './20260805_234700_campus_managed_pages';
import * as migration_20260806_093700_service_times_block from './20260806_093700_service_times_block';
import * as migration_20260806_103317_exact_campus_map_locations from './20260806_103317_exact_campus_map_locations';
import * as migration_20260806_130100_path_to_five_flexible_content from './20260806_130100_path_to_five_flexible_content';
import * as migration_20260806_auth0_admin_sso from './20260806_auth0_admin_sso';
import * as migration_20260807_service_guide_items from './20260807_service_guide_items';
import * as migration_20260808_members_rock_sync from './20260808_members_rock_sync';
import * as migration_20260811_143500_ev_kids_ages_1_to_12 from './20260811_143500_ev_kids_ages_1_to_12';
import * as migration_20260811_daily_bible_readings from './20260811_daily_bible_readings';
import * as migration_20260811_home_daily_reading_block from './20260811_home_daily_reading_block';
import * as migration_20260812_190000_fix_site_feedback_lock_relation from './20260812_190000_fix_site_feedback_lock_relation';
import * as migration_20260812_daily_bible_readings_api_bible from './20260812_daily_bible_readings_api_bible';
import * as migration_20260812_site_feedback from './20260812_site_feedback';
import * as migration_20260812_zzz_missing_paths from './20260812_zzz_missing_paths';
import * as migration_20260813_033314_add_payload_mcp from './20260813_033314_add_payload_mcp';
import * as migration_20260813_120000_feedback_triage_all_mcp from './20260813_120000_feedback_triage_all_mcp';
import * as migration_20260813_110000_feedback_posthog_replay from './20260813_110000_feedback_posthog_replay';
import * as migration_20260813_230000_feedback_triage_assessment from './20260813_230000_feedback_triage_assessment';
import * as migration_20260813_site_feedback_email_notifications from './20260813_site_feedback_email_notifications';
import * as migration_20260814_leader_resource_shares from './20260814_leader_resource_shares';
import * as migration_20260814_143000_fix_leader_resource_share_lock_relation from './20260814_143000_fix_leader_resource_share_lock_relation';
import * as migration_20260815_170000_giving_pilot from './20260815_170000_giving_pilot';
import * as migration_20260815_210000_giving_drafts from './20260815_210000_giving_drafts';
import * as migration_20260815_230000_giving_checkout_orchestration from './20260815_230000_giving_checkout_orchestration';
import * as migration_20260816_000000_giving_webhook_jobs from './20260816_000000_giving_webhook_jobs';
import * as migration_20260816_010000_giving_administration from './20260816_010000_giving_administration';
import * as migration_20260817_010000_giving_bank_code from './20260817_010000_giving_bank_code';
import * as migration_20260817_020000_giving_bank_acknowledgement from './20260817_020000_giving_bank_acknowledgement';
import * as migration_20260817_085255_connect_group_coaching from './20260817_085255_connect_group_coaching';
import * as migration_20260818_010000_giving_rock_alias_reuse from './20260818_010000_giving_rock_alias_reuse';
import * as migration_20260818_090000_connect_group_comments from './20260818_090000_connect_group_comments';
import * as migration_20260818_234000_profile_card_style from './20260818_234000_profile_card_style';

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
    name: '20260803_110431_rock_form_embed',
  },
  {
    up: migration_20260804_rock_connection_signup.up,
    down: migration_20260804_rock_connection_signup.down,
    name: '20260804_rock_connection_signup',
  },
  {
    up: migration_20260805_012700_featured_events.up,
    down: migration_20260805_012700_featured_events.down,
    name: '20260805_012700_featured_events',
  },
  {
    up: migration_20260805_185400_upcoming_events_block.up,
    down: migration_20260805_185400_upcoming_events_block.down,
    name: '20260805_185400_upcoming_events_block',
  },
  {
    up: migration_20260805_234700_campus_managed_pages.up,
    down: migration_20260805_234700_campus_managed_pages.down,
    name: '20260805_234700_campus_managed_pages',
  },
  {
    up: migration_20260806_093700_service_times_block.up,
    down: migration_20260806_093700_service_times_block.down,
    name: '20260806_093700_service_times_block',
  },
  {
    up: migration_20260806_103317_exact_campus_map_locations.up,
    down: migration_20260806_103317_exact_campus_map_locations.down,
    name: '20260806_103317_exact_campus_map_locations',
  },
  {
    up: migration_20260806_130100_path_to_five_flexible_content.up,
    down: migration_20260806_130100_path_to_five_flexible_content.down,
    name: '20260806_130100_path_to_five_flexible_content',
  },
  {
    up: migration_20260806_auth0_admin_sso.up,
    down: migration_20260806_auth0_admin_sso.down,
    name: '20260806_auth0_admin_sso',
  },
  {
    up: migration_20260807_service_guide_items.up,
    down: migration_20260807_service_guide_items.down,
    name: '20260807_service_guide_items',
  },
  {
    up: migration_20260808_members_rock_sync.up,
    down: migration_20260808_members_rock_sync.down,
    name: '20260808_members_rock_sync',
  },
  {
    up: migration_20260811_143500_ev_kids_ages_1_to_12.up,
    down: migration_20260811_143500_ev_kids_ages_1_to_12.down,
    name: '20260811_143500_ev_kids_ages_1_to_12',
  },
  {
    up: migration_20260811_daily_bible_readings.up,
    down: migration_20260811_daily_bible_readings.down,
    name: '20260811_daily_bible_readings',
  },
  {
    up: migration_20260811_home_daily_reading_block.up,
    down: migration_20260811_home_daily_reading_block.down,
    name: '20260811_home_daily_reading_block',
  },
  {
    up: migration_20260812_daily_bible_readings_api_bible.up,
    down: migration_20260812_daily_bible_readings_api_bible.down,
    name: '20260812_daily_bible_readings_api_bible',
  },
  {
    up: migration_20260812_site_feedback.up,
    down: migration_20260812_site_feedback.down,
    name: '20260812_site_feedback',
  },
  {
    up: migration_20260812_190000_fix_site_feedback_lock_relation.up,
    down: migration_20260812_190000_fix_site_feedback_lock_relation.down,
    name: '20260812_190000_fix_site_feedback_lock_relation',
  },
  {
    up: migration_20260812_zzz_missing_paths.up,
    down: migration_20260812_zzz_missing_paths.down,
    name: '20260812_zzz_missing_paths',
  },
  {
    up: migration_20260813_033314_add_payload_mcp.up,
    down: migration_20260813_033314_add_payload_mcp.down,
    name: '20260813_033314_add_payload_mcp',
  },
  {
    up: migration_20260813_110000_feedback_posthog_replay.up,
    down: migration_20260813_110000_feedback_posthog_replay.down,
    name: '20260813_110000_feedback_posthog_replay',
  },
  {
    up: migration_20260813_site_feedback_email_notifications.up,
    down: migration_20260813_site_feedback_email_notifications.down,
    name: '20260813_site_feedback_email_notifications'
  },
  {
    up: migration_20260813_120000_feedback_triage_all_mcp.up,
    down: migration_20260813_120000_feedback_triage_all_mcp.down,
    name: '20260813_120000_feedback_triage_all_mcp',
  },
  {
    up: migration_20260813_230000_feedback_triage_assessment.up,
    down: migration_20260813_230000_feedback_triage_assessment.down,
    name: '20260813_230000_feedback_triage_assessment',
  },
  {
    up: migration_20260814_leader_resource_shares.up,
    down: migration_20260814_leader_resource_shares.down,
    name: '20260814_leader_resource_shares',
  },
  {
    up: migration_20260814_143000_fix_leader_resource_share_lock_relation.up,
    down: migration_20260814_143000_fix_leader_resource_share_lock_relation.down,
    name: '20260814_143000_fix_leader_resource_share_lock_relation',
  },
  {
    up: migration_20260815_170000_giving_pilot.up,
    down: migration_20260815_170000_giving_pilot.down,
    name: '20260815_170000_giving_pilot',
  },
  {
    up: migration_20260815_210000_giving_drafts.up,
    down: migration_20260815_210000_giving_drafts.down,
    name: '20260815_210000_giving_drafts',
  },
  {
    up: migration_20260815_230000_giving_checkout_orchestration.up,
    down: migration_20260815_230000_giving_checkout_orchestration.down,
    name: '20260815_230000_giving_checkout_orchestration',
  },
  {
    up: migration_20260816_000000_giving_webhook_jobs.up,
    down: migration_20260816_000000_giving_webhook_jobs.down,
    name: '20260816_000000_giving_webhook_jobs',
  },
  {
    up: migration_20260816_010000_giving_administration.up,
    down: migration_20260816_010000_giving_administration.down,
    name: '20260816_010000_giving_administration',
  },
  {
    up: migration_20260817_010000_giving_bank_code.up,
    down: migration_20260817_010000_giving_bank_code.down,
    name: '20260817_010000_giving_bank_code',
  },
  {
    up: migration_20260817_020000_giving_bank_acknowledgement.up,
    down: migration_20260817_020000_giving_bank_acknowledgement.down,
    name: '20260817_020000_giving_bank_acknowledgement',
  },
  {
    up: migration_20260817_085255_connect_group_coaching.up,
    down: migration_20260817_085255_connect_group_coaching.down,
    name: '20260817_085255_connect_group_coaching',
  },
  {
    up: migration_20260818_010000_giving_rock_alias_reuse.up,
    down: migration_20260818_010000_giving_rock_alias_reuse.down,
    name: '20260818_010000_giving_rock_alias_reuse',
  },
  {
    up: migration_20260818_090000_connect_group_comments.up,
    down: migration_20260818_090000_connect_group_comments.down,
    name: '20260818_090000_connect_group_comments',
  },
  {
    up: migration_20260818_234000_profile_card_style.up,
    down: migration_20260818_234000_profile_card_style.down,
    name: '20260818_234000_profile_card_style',
  },
];
