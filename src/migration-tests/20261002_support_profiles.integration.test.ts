import { Client } from 'pg'
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest'
import { SUPPORT_PROFILES_UP_SQL } from '../migrations/20261002_010000_support_profiles'

const databaseUrl = process.env.GIVING_MIGRATION_TEST_DATABASE_URL

describe.skipIf(!databaseUrl)('shared support profiles migration', () => {
  let client: Client
  beforeAll(async () => {
    const url = new URL(databaseUrl!)
    const local = ['localhost', '127.0.0.1'].includes(url.hostname) || url.hostname === '' && url.searchParams.get('host') === '/var/run/postgresql'
    if (!local || url.pathname !== '/giving_pilot_test') throw new Error('Use the local disposable giving_pilot_test database')
    client = new Client({ connectionString: databaseUrl })
    await client.connect()
  })
  afterAll(async () => { await client?.end() })
  beforeEach(async () => {
    await client.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;
      CREATE TABLE media(id serial PRIMARY KEY);
      CREATE TABLE pages(id serial PRIMARY KEY, slug varchar, _status varchar);
      CREATE TABLE giving_funds(id serial PRIMARY KEY, name varchar, apprentice_related boolean DEFAULT false, student_minister_related boolean DEFAULT false, sort_order numeric DEFAULT 0);
      CREATE TABLE giving_email_deliveries(id serial PRIMARY KEY, kind varchar CHECK(kind IN ('bank-transfer-details','bank-transfer-thanks','blinkpay-thanks')));
      CREATE TABLE payload_locked_documents_rels(id serial PRIMARY KEY);
      CREATE TABLE payload_mcp_api_keys(id serial PRIMARY KEY);
      CREATE TABLE pages_blocks_manual_card_grid(id varchar PRIMARY KEY, _parent_id integer, _order integer, _path text, description varchar, card_style varchar, columns varchar);
      CREATE TABLE pages_blocks_content(id varchar PRIMARY KEY, _parent_id integer, _order integer, _path text);
      CREATE TABLE pages_blocks_manual_card_grid_cards(id varchar PRIMARY KEY, _parent_id varchar, _order integer, title varchar, image_id integer, description varchar, subtitle varchar);
      CREATE TABLE pages_blocks_manual_card_grid_cards_details(id varchar PRIMARY KEY, _parent_id varchar, _order integer, label varchar, value varchar);
      CREATE TABLE _pages_v(id serial PRIMARY KEY, parent_id integer, latest boolean);
      CREATE TABLE _pages_v_blocks_manual_card_grid(id serial PRIMARY KEY, _uuid varchar, _parent_id integer, _order integer, _path text, description varchar, card_style varchar, columns varchar);
      CREATE TABLE _pages_v_blocks_content(id varchar PRIMARY KEY, _parent_id integer, _order integer, _path text);
      CREATE TABLE _pages_v_blocks_manual_card_grid_cards(id serial PRIMARY KEY, _parent_id integer, _order integer, title varchar, image_id integer, description varchar, subtitle varchar);
      CREATE TABLE _pages_v_blocks_manual_card_grid_cards_details(id serial PRIMARY KEY, _parent_id integer, _order integer, label varchar, value varchar);
      INSERT INTO media VALUES(1);
      INSERT INTO pages VALUES(1,'about','published');
      INSERT INTO pages_blocks_manual_card_grid VALUES('apprentices',1,4,'layout','Apprentices','profile','3');
      INSERT INTO pages_blocks_content VALUES('beliefs',1,5,'layout');
      INSERT INTO pages_blocks_manual_card_grid_cards VALUES('liz', 'apprentices', 1,'Liz Halliday',1,'Existing approved blurb',null);
      INSERT INTO pages_blocks_manual_card_grid_cards_details VALUES('email','liz',1,'Email','liz@example.com');
      INSERT INTO _pages_v VALUES(1,1,false),(2,1,true);
      INSERT INTO _pages_v_blocks_manual_card_grid(_uuid,_parent_id,_order,_path,description,card_style,columns) VALUES('apprentices',1,4,'layout','Apprentices','profile','3'),('apprentices',2,4,'layout','Apprentices','profile','3');
      INSERT INTO _pages_v_blocks_content VALUES('old-beliefs',1,5,'layout'),('latest-beliefs',2,5,'layout');
      INSERT INTO _pages_v_blocks_manual_card_grid_cards(_parent_id,_order,title,image_id,description) VALUES(1,1,'Liz Halliday',1,'Existing approved blurb'),(2,1,'Liz Halliday',1,'Existing approved blurb');
      INSERT INTO _pages_v_blocks_manual_card_grid_cards_details(_parent_id,_order,label,value) VALUES(1,1,'Email','liz@example.com'),(2,1,'Email','liz@example.com');
      INSERT INTO giving_funds(name,apprentice_related,student_minister_related) VALUES('Liz Halliday',true,false),('Henry Huang',false,true),('General',false,false);
    `)
  })

  it('reuses About content, links funds, keeps incomplete profiles unpublished and preserves ordering', async () => {
    await client.query('BEGIN')
    await client.query(SUPPORT_PROFILES_UP_SQL)
    await client.query('COMMIT')
    expect((await client.query('SELECT name,slug,email,blurb,published FROM support_profiles ORDER BY name')).rows).toEqual([
      { name: 'Henry Huang', slug: 'henry-huang', email: null, blurb: null, published: false },
      { name: 'Liz Halliday', slug: 'liz-halliday', email: 'liz@example.com', blurb: 'Existing approved blurb', published: true },
    ])
    expect((await client.query('SELECT count(*)::integer AS count FROM giving_funds WHERE support_profile_id IS NOT NULL')).rows[0].count).toBe(2)
    expect((await client.query('SELECT _order FROM pages_blocks_content WHERE id=\'beliefs\'')).rows[0]._order).toBe(6)
    expect((await client.query("SELECT _order,support_group FROM pages_blocks_manual_card_grid WHERE support_group='student-ministers'")).rows).toEqual([{ _order: 5, support_group: 'student-ministers' }])
    expect((await client.query("SELECT data_source FROM _pages_v_blocks_manual_card_grid WHERE _uuid='apprentices' ORDER BY _parent_id")).rows).toEqual([{ data_source: 'manual' }, { data_source: 'support-profiles' }])
    expect((await client.query('SELECT _parent_id,_order FROM _pages_v_blocks_content ORDER BY _parent_id')).rows).toEqual([{ _parent_id: 1, _order: 5 }, { _parent_id: 2, _order: 6 }])
    expect((await client.query("SELECT _parent_id FROM _pages_v_blocks_manual_card_grid WHERE support_group='student-ministers'")).rows).toEqual([{ _parent_id: 2 }])
    await client.query("INSERT INTO giving_email_deliveries(kind,recipient_email) VALUES('blinkpay-support','liz@example.com')")
  })

  it('is idempotent and preserves later profile edits', async () => {
    await client.query('BEGIN')
    await client.query(SUPPORT_PROFILES_UP_SQL)
    await client.query("UPDATE support_profiles SET blurb='Edited profile',email='updated@example.com' WHERE slug='liz-halliday'")
    await client.query(SUPPORT_PROFILES_UP_SQL)
    await client.query('COMMIT')
    expect((await client.query('SELECT count(*)::integer AS count FROM support_profiles')).rows[0].count).toBe(2)
    expect((await client.query("SELECT blurb,email FROM support_profiles WHERE slug='liz-halliday'")).rows[0]).toEqual({ blurb: 'Edited profile', email: 'updated@example.com' })
    expect((await client.query('SELECT _order FROM pages_blocks_content')).rows[0]._order).toBe(6)
  })

  it('keeps an existing grid manual if any published card is not ready for profile publication', async () => {
    await client.query("INSERT INTO pages_blocks_manual_card_grid_cards VALUES('no-bio','apprentices',2,'Missing Bio',1,null,null)")
    await client.query('BEGIN')
    await client.query(SUPPORT_PROFILES_UP_SQL)
    await client.query('COMMIT')
    expect((await client.query("SELECT data_source FROM pages_blocks_manual_card_grid WHERE id='apprentices'")).rows[0].data_source).toBe('manual')
    expect((await client.query("SELECT count(*)::integer AS count FROM pages_blocks_manual_card_grid_cards WHERE _parent_id='apprentices'")).rows[0].count).toBe(2)
    expect((await client.query("SELECT published FROM support_profiles WHERE slug='missing-bio'")).rows[0].published).toBe(false)
  })

  it('preserves unpublished edits in the latest About draft', async () => {
    await client.query("UPDATE _pages_v_blocks_manual_card_grid_cards SET description='Unpublished draft edit' WHERE _parent_id=2")
    await client.query('BEGIN')
    await client.query(SUPPORT_PROFILES_UP_SQL)
    await client.query('COMMIT')
    expect((await client.query("SELECT data_source FROM _pages_v_blocks_manual_card_grid WHERE _parent_id=2 AND _uuid='apprentices'")).rows[0].data_source).toBe('manual')
    expect((await client.query('SELECT description FROM _pages_v_blocks_manual_card_grid_cards WHERE _parent_id=2')).rows[0].description).toBe('Unpublished draft edit')
    expect((await client.query("SELECT blurb FROM support_profiles WHERE slug='liz-halliday'")).rows[0].blurb).toBe('Existing approved blurb')
  })

  it('does not duplicate an incomplete manual student minister section', async () => {
    await client.query("INSERT INTO pages_blocks_manual_card_grid VALUES('students',1,5,'layout','Student ministers','profile','3'); INSERT INTO pages_blocks_manual_card_grid_cards VALUES('henry','students',1,'Henry Huang',1,null,null)")
    await client.query('BEGIN')
    await client.query(SUPPORT_PROFILES_UP_SQL)
    await client.query('COMMIT')
    expect((await client.query("SELECT id,data_source FROM pages_blocks_manual_card_grid WHERE description='Student ministers'")).rows).toEqual([{ id: 'students', data_source: 'manual' }])
  })

  it('preserves a draft that only changed the card action', async () => {
    await client.query("ALTER TABLE pages_blocks_manual_card_grid_cards ADD COLUMN href varchar; ALTER TABLE _pages_v_blocks_manual_card_grid_cards ADD COLUMN href varchar; UPDATE _pages_v_blocks_manual_card_grid_cards SET href='/unpublished-action' WHERE _parent_id=2")
    await client.query('BEGIN')
    await client.query(SUPPORT_PROFILES_UP_SQL)
    await client.query('COMMIT')
    expect((await client.query("SELECT data_source FROM _pages_v_blocks_manual_card_grid WHERE _parent_id=2 AND _uuid='apprentices'")).rows[0].data_source).toBe('manual')
    expect((await client.query('SELECT href FROM _pages_v_blocks_manual_card_grid_cards WHERE _parent_id=2')).rows[0].href).toBe('/unpublished-action')
  })
})
