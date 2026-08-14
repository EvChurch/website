# Ev Church Technical and Local SEO Audit

**Audit date:** 14 August 2026 (Pacific/Auckland)  
**Production site:** `https://www.ev.church`  
**Google Search Console property:** `sc-domain:ev.church`  
**GA4 property:** `486694161`  
**Status:** Audit evidence was captured before remediation. P1 implementation began on 14 August 2026.

## Implementation status — 14 August 2026

- Rock already contains complete address, coordinate, and Google Place ID data for all three campus locations. The defect was in the website sync: campus responses contain only a `LocationId`, so the sync now hydrates the full Rock location (including attributes) before mapping it into Payload.
- Campus pages now select and publish the synced coordinates and Place ID in their `Church` JSON-LD, alongside the full postal address.
- Campus hero and gallery media now use responsive Next.js images. The hero is the only eager, high-priority image; gallery images load lazily below the fold.
- The website has a permanent, path-preserving `new.ev.church` to `www.ev.church` redirect ready for deployment. DNS/domain attachment and live redirect verification remain deployment steps.
- The Rock Service Guide home page at `home.ev.church` now has Rock's **Allow Indexing** setting disabled and emits `<meta name="robots" content="noindex, nofollow">`. Other functional Service Guide routes remain unchanged.

Unless explicitly labelled as implementation status, the findings below describe the pre-remediation audit snapshot.

## Executive Summary

### 1. How healthy is current SEO?

The current website is technically sound in several important respects, but it is in an SEO migration period rather than a settled state.

The live site has crawlable pages, consistent `www` canonicals, a clean XML sitemap, working apex-to-`www` redirects, useful titles and descriptions, strong navigation, and valid structured data syntax. Google has already recrawled and indexed the current homepage and About page after the latest deployment.

The main risk is consolidation. The latest available Search Console performance data ends on 12 August, while the current sitemap and content were updated on 13–14 August. Most historical campus visibility therefore belongs to the old numeric URLs (`/campus/2`, `/campus/3`, `/campus/4`) and some indexed `new.ev.church` pages, not the new slug URLs. Google had not yet recrawled the current campus pages when this audit ran. The new slug pages also expose empty street/locality values in their campus-specific JSON-LD because the corresponding production Payload fields are blank.

There is no confirmed P0 crawl or indexing outage. There are five high-confidence P1 issues that should be handled promptly.

### 2. What is already working?

- The homepage and About page are submitted, fetched successfully, mobile-crawled, and indexed by Google with matching user and Google canonicals.
- `http://ev.church` and `https://ev.church` redirect to `https://www.ev.church/` in one hop.
- Current production titles, descriptions, canonical tags, Open Graph URLs, and sitemap URLs consistently use `https://www.ev.church`.
- The live XML sitemap contains 914 unique URLs, no parameterised URLs, no non-`www` URLs, no numeric campus URLs, and no `new.ev.church` or `home.ev.church` URLs.
- Google reports the sitemap with zero errors and zero warnings; Bing reports it as successful.
- Main navigation, footer navigation, homepage service times, Visit, and contextual cards all link naturally to the three campus pages.
- Campus pages have a clear H1, service time, location label, local introduction, kids information where relevant, directions link, map, parking information, event links, canonical, breadcrumbs, and campus-specific `Church` markup.
- Mobile field data at the origin level shows good INP (104 ms) and CLS (0.001). The homepage passes Lighthouse SEO (100), best practices (100), and accessibility is high (96).
- Organic search is strongly local: in the 90-day GSC country breakdown, New Zealand produced 1,981 of 2,289 clicks (86.5%).

### 3. What are the three biggest problems?

1. **Legacy URL and hostname consolidation is unfinished.** The old numeric campus URLs remain Google's indexed/canonical versions, current slug campus pages had not been recrawled, indexed `new.ev.church` campus pages now return 404, and tested `home.ev.church` event content is still a 200 page without a canonical or noindex directive.
2. **Campus location entities are incomplete.** All three production campus records currently have blank address, geo, and Google Place ID fields. The current UI falls back to broad labels such as “Rosedale, Auckland,” while campus JSON-LD emits empty `streetAddress` and `addressLocality` values.
3. **Campus mobile LCP is poor.** Lab LCP is 14.69 s at North, 14.49 s at Central, and 12.98 s at Unichurch. The North page eagerly preloads a 417 KB hero plus four gallery JPEGs (about 1.97 MB in total) because they are rendered as eager, unresponsive `<img>` elements.

### 4. What are the three biggest opportunities?

1. **Consolidate existing local authority into the current campus URLs.** The old campus pages generated 250 clicks and 5,351 impressions over 90 days. Preserving those signals through redirects, complete local entities, and recrawl is more valuable than creating new suburb pages.
2. **Improve pages already close to meaningful discovery.** Over 90 days, “church in auckland” ranked 6.0 (159 impressions), “christian church near me” ranked 6.4 (44 impressions), “church near me” ranked 13.4 (64 impressions), and “christian church auckland” ranked 13.3 (47 impressions). The current homepage and Visit content now fit these intents well; consolidation and CTR monitoring should come before additional content.
3. **Turn ministry interest into measurable outcomes.** Youth, kids, Connect Groups, visiting, directions, contact, and faith-exploration actions are not named or marked as key events. Defining these actions will show whether organic discovery leads to meaningful church connection.

### 5. What should we do this week?

1. Complete and protect production campus addresses, geo coordinates, and Google Place IDs at the authoritative source, then verify the three rendered pages and JSON-LD.
2. Add one-hop redirects for indexed `new.ev.church` routes to their `www` equivalents, and make `home.ev.church` either consistently noindex at the host level or redirect equivalent public content where a destination exists.
3. After those fixes, request/confirm Google recrawl of the three current campus URLs and monitor the old numeric URLs moving to the new canonicals.
4. Convert campus hero/gallery images to the repository's responsive image pattern, lazy-load below-the-fold gallery media, and rerun mobile PSI.
5. Define a small GA4 measurement contract for directions, visit/contact/forms, Connect Groups, event registration, faith exploration, and outbound registration; isolate reporting by hostname before using GA4 totals as website KPIs.

### 6. What should we deliberately not spend time on?

- Do not create thin “Church Albany,” “Church Glenfield,” or “Church Browns Bay” doorway pages. Current evidence does not justify them.
- Do not rewrite every title or add more generic Auckland keywords. The current core metadata is already materially better than the indexed legacy pages, and it has not had time to settle.
- Do not pursue generic traffic unrelated to attending, exploring Christianity, joining community, or using sermon resources.
- Do not treat Bing's zero-row performance response as proof of no Bing demand, and do not prioritise Bing-specific content while the Google/canonical migration is unresolved.
- Do not start a broad JavaScript reduction project. Lab Total Blocking Time is acceptable; image delivery and server response are the clearer performance constraints.

## Scope, Evidence, and Limitations

### Evidence collected

- Current repository implementation and production Payload content.
- Live HTTP responses, metadata, redirects, robots.txt, XML sitemap, response timing, and media headers.
- Google Search Console: 28 days, current 90 days, previous 90 days, and 12 months; query, page, query + page, device, and country dimensions.
- Google URL Inspection for the homepage, About, all current and numeric campus URLs, `new.ev.church`, and `home.ev.church`.
- GA4 property `486694161`: user behaviour, audience segments, events, and conversion/key-event output.
- Bing verification, sitemap, crawl health, performance, and URL inspection attempts.
- Mobile PageSpeed Insights for the homepage, three campuses, and About (the highest-click non-homepage landing page in the GSC export).
- Live schema validation for the homepage and three campuses.

### Important limitations

- GSC performance ends on 12 August 2026. Current production content and the sitemap were updated on 13–14 August. Historical performance is therefore a legacy baseline, not a performance verdict on the current pages.
- The connector's dimension exports do not fully reconcile: current 90-day device/country totals are 2,289 clicks and 20,730 impressions, while summed page rows are higher and query rows are lower. Site-wide totals below use device/country totals; page/query rows are directional and may include URL-level duplication or query privacy loss.
- GA4's available tool surface did not expose hostname-filtered landing-page, Organic Search channel, source/medium, city, or custom-dimension reports. The property contains Rock-style paths such as `/MyAccount`, `/ScheduleToolbox`, `/Give/`, and `/Unsubscribe/...`, so its totals cannot be attributed solely to `www.ev.church`.
- GA4 reported no key events/conversions. “Users,” deduplicated total active users, organic landing pages, and organic engagement cannot be stated reliably from the available reports.
- Bing authentication and sitemap access worked, but search performance returned zero rows and URL inspection was throttled. This is recorded as unavailable evidence, not zero real-world Bing traffic.
- PageSpeed field data is origin-level and identical across tested URLs; lab data is page-specific. The connector labels one lab responsiveness value “firstInputDelay”; this audit uses INP for field responsiveness and TBT as the lab main-thread proxy.

## Current Canonical URL Inventory

| Content | Current canonical URL | Observed status |
|---|---|---|
| Homepage | `https://www.ev.church` | 200; indexed; matching Google/user canonical |
| Ev North | `https://www.ev.church/campus/north` | 200; canonical present; Google inspection is stale/pre-migration |
| Ev Central | `https://www.ev.church/campus/central` | 200; canonical present; Google inspection is stale/pre-migration |
| Unichurch | `https://www.ev.church/campus/unichurch` | 200; canonical present; Google inspection is stale/pre-migration |
| About | `https://www.ev.church/about` | 200; indexed; matching canonical |
| Sundays / visiting | `https://www.ev.church/visit` | 200; canonical present |
| Connect Groups | `https://www.ev.church/connect-groups` | 200; canonical present |
| Kids | `https://www.ev.church/kids` | 200; canonical present |
| Youth | `https://www.ev.church/youth` | 200; canonical present |
| Sermons | `https://www.ev.church/sermons` | 200; canonical present |
| Events | `https://www.ev.church/events` | 200; canonical present |
| Christianity course | `https://www.ev.church/explaining-christianity` | 200; canonical present |
| Gospel overview | `https://www.ev.church/good-news` | Present in sitemap and navigation |
| Beliefs | `https://www.ev.church/what-we-believe` | Present in sitemap and navigation |

## Search Console Performance

### Baseline

| Window | Clicks | Impressions | CTR | Average position | Interpretation |
|---|---:|---:|---:|---:|---|
| 16 Jul–12 Aug (28 days) | 755 | 6,308 | 12.0% | 14.3 weighted | Pre-current-site baseline |
| 15 May–12 Aug (90 days) | 2,289 | 20,730 | 11.0% | 15.6 | Primary baseline |
| 14 Feb–14 May (previous 90 days) | 3,022 | 24,990 | 12.1% | 12.3 | Comparison period |
| 13 Aug 2025–12 Aug 2026 | 10,163 | 89,173 | 11.4% | 13.9 weighted | Seasonality/context only |

Current 90 days versus previous 90 days:

- Clicks: down 733 (-24.3%).
- Impressions: down 4,260 (-17.0%).
- CTR: down 1.05 percentage points (-8.7% relative).
- Average position: worsened from 12.3 to 15.6.

This is an observed decline, not a demonstrated penalty or technical cause. The periods cross a major host/canonical/content transition, event demand is seasonal, and the current site is newer than the data cutoff. Bing has no usable comparison data. Rebaseline after 28 complete days on the current production site.

Google detected click spikes on 25 July and 8 August, not traffic-drop anomalies. The audit helper returned no fully lost queries.

### Device and country

| Device, 90 days | Clicks | Impressions | CTR | Position |
|---|---:|---:|---:|---:|
| Mobile | 1,593 | 10,140 | 15.7% | 7.6 |
| Desktop | 668 | 10,400 | 6.4% | 23.5 |
| Tablet | 28 | 190 | 14.7% | 12.0 |

Mobile produces 69.6% of clicks and has much stronger average visibility than desktop. This makes campus mobile LCP a material SEO and user-experience issue.

| Country, 90 days | Clicks | Impressions | CTR | Position |
|---|---:|---:|---:|---:|
| New Zealand | 1,981 | 8,647 | 22.9% | 9.2 |
| Australia | 165 | 3,445 | 4.8% | 7.3 |
| United States | 34 | 3,262 | 1.0% | 35.8 |
| United Kingdom | 26 | 620 | 4.2% | 23.4 |

New Zealand is the meaningful discovery market. International impressions should not drive local content priorities unless they relate to sermon resources or a defined ministry objective.

### Branded versus non-branded

The connector's recent brand classifier (query-visible rows only) reported:

| Segment | Clicks | Impressions | CTR | Position |
|---|---:|---:|---:|---:|
| Branded | 381 | 1,036 | 36.8% | 3.6 |
| Non-branded | 29 | 2,099 | 1.4% | 28.1 |

Brand demand is healthy, but non-branded discovery is underdeveloped. This should be addressed by consolidating the current site and strengthening pages with demonstrated intent—not by producing large volumes of suburb or generic keyword pages.

### High-value opportunities already near visibility

The table uses the 90-day query + page export and prioritises church discovery or useful ministry intent. Because the current site post-dates the export, actions should be tested after recrawl before copy is expanded further.

| Query | Impressions | Clicks | CTR | Position | Ranking page | Intent | Recommended action | Expected impact | Effort |
|---|---:|---:|---:|---:|---|---|---|---|---|
| church in auckland | 159 | 1 | 0.6% | 6.0 | Homepage | Find a local church | Preserve current Auckland/Sunday copy; consolidate canonicals; monitor new title/description CTR for 28 days | Moderate | XS |
| christian church near me | 44 | 0 | 0% | 6.4 | Homepage | Find a nearby Christian church | Ensure campus entity/address completeness and strong Visit/campus links; do not create suburb pages | Moderate | S |
| evangelical church | 113 | 4 | 3.5% | 11.5 | Homepage | Find/understand an evangelical church | Retain explicit evangelical identity and link naturally to What We Believe | Low–moderate | XS |
| church near me | 64 | 1 | 1.6% | 13.4 | Homepage | Find a nearby church | Complete location entities, measure directions, and assess CTR after current homepage recrawl | Moderate | S |
| christian church auckland | 45 | 0 | 0% | 10.7 | Homepage | Find an Auckland Christian church | No immediate new copy; validate current metadata after recrawl | Low–moderate | XS |
| ev youth | 184 | 1 | 0.5% | 6.1 | `/youth` | Navigate to the youth ministry | Inspect SERP after current metadata settles; ensure schedule/location remains current; add measurable enquiry/action | Moderate | S |
| ev kids | 93 | 0 | 0% | 8.6 | `/kids` | Navigate to kids ministry | Inspect SERP title/description and add measurable next action; keep North/Central links explicit | Moderate | S |
| connect group | 415 | 0 | 0% | 20.0 | `/connect-groups` | Ambiguous; often product/non-church | Do not chase the generic term. Focus page and measurement on “Connect Groups at Ev Church/Auckland” intent | Low | XS |
| church auckland cbd | 15 | 0 | 0% | 14.1 | Homepage | Find a CBD church | Let Unichurch own genuine CBD/student relevance after consolidation; do not imply Central is CBD | Low | XS |
| ev church sermons | 296 | 2 | 0.7% | 5.8 | `resources.ev.church` | Find Ev sermons | Decide the long-term relationship between Resources and the new `/sermons`; avoid two equivalent sermon hubs | Moderate | M |

“Connect group” is a good example of why impression volume alone is not value. Its intent is ambiguous and its ranking worsened from 13.7 to 20.0 despite impression growth. It should not outrank local church and ministry-connection work.

### CTR and cannibalisation

- The audit helper reports many low-CTR branded query/page combinations across homepage, About, Visit, Vision, and numeric campus URLs. These are not all genuine cannibalisation: GSC can record multiple results/sitelinks, and the data covers the legacy site.
- A genuine consolidation problem exists across indexed numeric campus URLs, indexed `new.ev.church` pages, apex/`www` historical variants, and current slug URLs.
- Unichurch's branded demand was meaningful: “unichurch” generated 51 clicks from 219 impressions at position 4.7, and “uni church” generated 17 clicks from 83 impressions at position 4.8. Most of that was attributed to old `/campus/4` and the homepage. Preserving it into `/campus/unichurch` is a P1.
- Sermon discovery currently resolves mainly to `resources.ev.church`. This may be intentional, but launching a second full sermon hub without an explicit canonical/product boundary creates future cannibalisation risk.

## GA4 Behaviour

### What can be stated

GA4 is active on production with measurement ID `G-1R09W3HMNX`. The repository sends an initial `page_view` plus client-side route-change `page_view` events. Sensitive/member capability routes are excluded by repository privacy rules.

| GA4 device, 90 days | Active users | Sessions | Engagement rate |
|---|---:|---:|---:|
| Mobile | 1,688 | 4,004 | 57.6% |
| Desktop | 1,658 | 2,879 | 52.3% |
| Tablet | 27 | 43 | 72.1% |

Across the property, the reported average session duration was 153.5 seconds and engagement rate was 56.4%. New/returning segmentation reported 3,016 new active users and 898 returning active users. New Zealand led with 2,070 active users and 5,449 sessions.

These are property-level observations, not `www.ev.church` Organic Search KPIs. The same property contains substantial Rock/member/admin-style paths, so totals and engagement cannot be cleanly correlated with GSC without hostname and channel filters.

### Events and key events

| Event, 90 days | Event count | Key events/conversions |
|---|---:|---:|
| `page_view` | 15,591 | 0 |
| `user_engagement` | 9,957 | 0 |
| `session_start` | 7,042 | 0 |
| `scroll` | 5,427 | 0 |
| `first_visit` | 3,024 | 0 |
| `click` | 481 | 0 |
| `form_start` | 478 | 0 |
| `video_progress` | 55 | 0 |
| `video_start` | 25 | 0 |
| `video_complete` | 18 | 0 |
| `form_submit` | 4 | 0 |

No named church-connection events or key events were exposed. Raw `click`, `form_start`, and `form_submit` events are insufficient to distinguish a directions click from an event registration or a Connect Group enquiry.

### Correlation with GSC

- GSC shows meaningful New Zealand/mobile search demand. GA4 also reports mobile and New Zealand as the largest categories, but the shared-property contamination prevents a reliable click-to-session reconciliation.
- GSC identifies homepage, old campus URLs, About, Visit, kids, youth, and Connect Groups as meaningful search surfaces. GA4 cannot currently provide hostname-filtered organic landing-page engagement for those pages through the connected tool.
- No claim is made that high or low GSC CTR caused GA4 engagement outcomes.

## Local SEO Performance

### Ev Church overall

The current homepage has a strong local proposition: “Church in Auckland,” Tāmaki Makaurau context, three campuses, Sunday service times, Visit and campus links, kids, groups, Christianity exploration, events, and sermons. Search demand supports this focus.

The main local entity weakness is not copy—it is incomplete campus address data and an unsettled URL migration.

### Ev North

**Current canonical:** `https://www.ev.church/campus/north`

What works:

- H1 “Ev North,” eyebrow “Rosedale, Auckland,” and description explicitly mention Rosedale and the North Shore.
- Sunday 10:15 am, 75-minute duration, kids ages 1–12, parking, map, directions, and local image alt text are present.
- Navigation, footer, Visit, and homepage link directly to the page.
- Title and description are geographically accurate.

Gaps:

- Production address, geo, and Place ID fields are blank. The visible “Where” output falls back to “Rosedale, Auckland,” not `9–11 Rothwell Avenue`.
- Campus JSON-LD has blank `streetAddress` and `addressLocality`.
- Google last crawled the slug URL on 1 August and selected the apex variant as canonical. This predates the current `www` implementation and is stale evidence, but recrawl is required.
- Mobile lab LCP is 14.69 s.

Legacy baseline: old `/campus/2` produced 60 clicks and 1,418 impressions over 90 days and is still Google's indexed URL. It now redirects in one hop (308) to `/campus/north`.

### Ev Central

**Current canonical:** `https://www.ev.church/campus/central`

What works:

- H1 “Ev Central,” location “Hillsborough, Auckland,” and body copy “south-central Auckland” are accurate.
- Sunday 10:15 am, kids ages 1–12, parking, map, directions, and Hillsborough image alt text are present.
- Title/description do not call Hillsborough Auckland CBD.

Gaps:

- The tagline “In the heart of the city” is ambiguous and unnecessary for a Hillsborough campus. Replace it with accurate Hillsborough/south-central language when content is next edited.
- Production address, geo, and Place ID fields are blank; the visible address falls back to “Hillsborough, Auckland.”
- Campus JSON-LD has blank street/locality.
- Google's July inspection selected the North apex URL as canonical for Central. This reflects the old duplicate implementation, but the current distinct page must be recrawled.
- Mobile lab LCP is 14.49 s.

Legacy baseline: old `/campus/3` produced 53 clicks and 2,631 impressions over 90 days and now redirects in one hop to `/campus/central`.

### Unichurch

**Current canonical:** `https://www.ev.church/campus/unichurch`

What works:

- Title, H1, description, body copy, and image alt text clearly express University of Auckland, tertiary student, Auckland, and Sunday-evening intent.
- The page does not present Central/Hillsborough as CBD; Unichurch correctly owns university/CBD relevance.
- Service time, map, directions, parking, events, and Visit CTA are present.
- Existing branded demand is strong relative to the site.

Gaps:

- The production address is blank, so visible “Where” falls back to “University of Auckland” rather than `24 Princes Street, Auckland CBD`.
- Campus JSON-LD has blank street/locality and no geo coordinates or Place ID.
- Google's July inspection is stale and selected North apex as canonical.
- Mobile lab LCP is 12.98 s.

Legacy baseline: old `/campus/4` produced 137 clicks and 1,302 impressions over 90 days and now redirects in one hop to `/campus/unichurch`.

## Quick Wins

1. Populate all three campus address/geo/Place ID records and verify rendered pages and schema. This improves users' “Where” information and search entity clarity without new pages.
2. Add host-level redirects from the known indexed `new.ev.church` routes to the exact current `www` routes.
3. Replace Central's ambiguous tagline with Hillsborough/south-central wording.
4. After fixes, request/confirm recrawl for the three current campus URLs and inspect Google-selected canonicals.
5. Lazy-load campus gallery images and use responsive optimized images. North currently preloads about 1.97 MB across five JPEGs before the gallery is needed.
6. Define and name the minimum meaningful GA4 events before changing page copy based on traffic alone.

## Technical SEO

### Framework and routing

- Next.js 16 App Router with Payload CMS 3, PostgreSQL, and server-rendered dynamic public pages.
- Generic CMS pages render through `src/app/(frontend)/[slug]/page.tsx`.
- Campuses render through `src/app/(frontend)/campus/[slug]/page.tsx`.
- Events, sermons, sermon taxonomies, blog, sitemap, robots, auth/member, and error routes have explicit route implementations.
- Public layout is `force-dynamic`, and the campus and generic CMS routes are also dynamic. Live warm-request TTFB was approximately 0.24–0.35 s, while CrUX origin TTFB was 1.007 s (needs improvement).

### Metadata and canonical implementation

- Global metadata base is `https://www.ev.church`.
- Homepage, generic CMS pages, campus pages, events, blog, sermons, and taxonomy pages generate explicit canonicals.
- Live homepage, campus, About, Visit, groups, kids, youth, sermons, events, and Christianity course pages all emitted correct `www` canonical and Open Graph URLs.
- Homepage and most CMS pages inherit a generated 1200×630 Open Graph image where no CMS image is provided. Campus pages currently did not expose an `og:image` in the inspected metadata; this is a P3 sharing-quality issue, not an indexing issue.

### Robots and sitemap

- robots.txt allows public content and blocks admin, API, auth, member, and capability paths.
- Sitemap points to `https://www.ev.church/sitemap.xml`.
- Live sitemap: 914 URLs, no duplicates, no query strings, no non-`www` URLs, and only slug campus routes.
- Google: sitemap accepted, zero warnings/errors, last downloaded 13 August.
- Bing: sitemap success, 914 URLs.
- Google's sitemap API returned “0 indexed,” but URL Inspection and live search performance prove indexed URLs exist. Treat that count as unreliable connector/API output, not a P0.

### Images, fonts, JavaScript, and caching

- CMS hero/photo-strip components already use `next/image`, responsive sizes, and priority selectively.
- Campus pages bypass that pattern with plain `<img>` tags for both hero and gallery media.
- React/Next preloaded the hero and all four gallery images on the tested North page. Those five local JPEGs total approximately 1.97 MB; individual campus heroes are 271–417 KB at 1920 px width.
- Campus images are served with `Cache-Control: public, max-age=14400` (four hours), which is short for fingerprinted static assets.
- The campus page loaded 13 script resources, but TBT remained 67–178 ms across tested pages. JavaScript is not the primary lab bottleneck.
- Adobe Typekit is imported via render-blocking CSS (`@import url(...)`), with a preconnect. It may contribute to FCP, but image/LCP and server response should be addressed first.

## Core Web Vitals

### Origin field data

| Metric | 75th percentile | Assessment |
|---|---:|---|
| LCP | 2.617 s | Needs improvement |
| INP | 104 ms | Good |
| CLS | 0.001 | Good |
| FCP | 1.897 s | Needs improvement |
| TTFB | 1.007 s | Needs improvement |

### Mobile lab data

| Page | Performance | LCP | FCP | TBT | CLS | SEO |
|---|---:|---:|---:|---:|---:|---:|
| Homepage | 77 | 4.20 s | 2.90 s | 178 ms | 0.056 | 100 |
| Ev North | 55 | 14.69 s | 4.92 s | 148 ms | 0.000 | 100 |
| Ev Central | 59 | 14.49 s | 4.44 s | 67 ms | 0.056 | 100 |
| Unichurch | 64 | 12.98 s | 2.86 s | 94 ms | 0.055 | 100 |
| About | 63 | 7.97 s | 4.37 s | 155 ms | 0.053 | 100 |

Priority diagnosis:

1. Campus hero/gallery image delivery is the clearest page-specific cause. Use responsive `next/image`/`MediaImage`, explicit sizes, a single priority hero, and lazy gallery images.
2. Public pages perform multiple dynamic server reads in the layout and page. Measure cold and p75 server timing before proposing caching changes; warm curl TTFB alone does not reproduce CrUX.
3. After images, test whether the Typekit CSS import materially delays FCP. Do not remove brand fonts without a measured replacement plan.
4. Do not prioritise broad JS removal: TBT and field INP are already good.

## Analytics Measurement Gaps

### Current repository measurement

- GA4: page views only from application code; enhanced-measurement events appear in GA4.
- PostHog: `$pageview`, exceptions, and session recording; autocapture is disabled.
- No repository code sends named GA4 events for campus, directions, contacts, registrations, ministry enquiries, or exploration journeys.
- `ROCK_FORM_SUBMIT_ACTION` is an internal form action name, not a GA4 event implementation.

### Missing meaningful events

| Proposed event | Trigger | Recommended parameters | Key event? |
|---|---|---|---|
| `campus_view` | View a campus route | `campus`, `location`, `service_time` | No |
| `get_directions` | Click campus Google Maps action | `campus`, `destination`, `link_url` | Yes |
| `visit_plan_start` | Start Plan Your Visit form | `campus`, `form_id` | No |
| `visit_plan_submit` | Successful Visit submission | `campus`, `form_id` | Yes |
| `contact_church` | Successful contact action/form | `topic`, `campus`, `method` | Yes |
| `connect_group_enquiry` | Successful group enquiry | `campus`, `group_type` | Yes |
| `event_registration_click` | Click registration CTA | `event_id`, `event_slug`, `campus`, `link_url` | No/Yes by event |
| `ministry_enquiry` | Successful kids/youth/other enquiry | `ministry`, `campus` | Yes |
| `faith_exploration_start` | Start Exploring Christianity/Good News journey | `journey`, `step` | No |
| `faith_exploration_enquiry` | Successful course/enquiry action | `journey`, `campus` | Yes |
| `outbound_registration` | Leave for approved registration provider | `destination_host`, `context`, `campus` | No |

Use stable snake_case names, send events only after confirmed success where applicable, avoid personal data in parameters, and make `campus` an explicit controlled value (`north`, `central`, `unichurch`).

Before using these as SEO outcomes, create GA4 explorations/reports filtered to hostname `www.ev.church` and default channel group `Organic Search`.

## Indexation / Legacy URLs

| Severity | Finding | Observed evidence | Action |
|---|---|---|---|
| High | Current campus slug URLs have stale duplicate canonical decisions | July/August inspections selected apex North; current `www` pages were not yet recrawled | Fix entity data, then request/confirm recrawl and Google-selected canonical |
| High | Indexed `new.ev.church` campus pages now 404 | GSC says the three pages were indexed; live endpoints return JSON 404 | One-hop host/path redirects to exact `www` equivalents |
| High | `home.ev.church` is inconsistently excluded | Root has `noindex,nofollow`; tested event page is 200 with no robots/canonical; GSC shows 13 clicks/70 impressions for one event URL | Apply sitewide `X-Robots-Tag: noindex` or redirect equivalent public pages; keep necessary Rock functions out of search |
| No action required | Numeric campus URLs | `/campus/2`, `/3`, `/4` are still indexed but now 308 in one hop to correct slugs | Monitor consolidation; do not remove redirects |
| Medium | Legacy `/login` remains indexed and ends at a 404 after redirects | 6 clicks/254 impressions over 90 days; live chain ends 404 | Decide intended member login destination; otherwise return a clean direct 410/404 with noindex semantics |
| No action required | Legacy event URLs tested | Old parameterised event URLs redirected to current event slug or Events index | Preserve mapping; sample additional top legacy event URLs during migration monitoring |
| Low | `/Give/` takes two redirects | Live chain reaches `give.ev.church` successfully | Consider one-hop edge redirect if easy; not a discovery priority |
| Monitor | Resources versus new sermons | `resources.ev.church` holds sermon query visibility while new `/sermons` now exists | Define product/canonical boundary before redirects or content consolidation |
| No action required | Apex hostname | HTTP/HTTPS apex redirects one hop to `www` | Preserve |

No evidence was found for live sitemap parameter URLs, sitemap duplicate URLs, or sitemap orphaning of the three current campuses. A full backlink crawl was outside the connected tools, so “no orphaned pages anywhere” is not claimed.

## Structured Data

### What exists

- Sitewide `Church` entity with organisation ID, name, alternate name, URL, logo, description, three postal addresses, social `sameAs`, free access, and public access.
- Campus-specific `Church` entity with unique ID/URL, campus name, alternate name, address, Sunday hours, and `parentOrganization` relation.
- Breadcrumb schema on campus and CMS pages.
- Article/Event schema on relevant content types.
- FAQ schema on the FAQ page when accordion items exist.

### Findings

- The schema validator reports the homepage and all three campuses as syntactically valid.
- Valid syntax is not equivalent to complete local data. Campus-specific street/locality values are empty on all three pages.
- `geo`, telephone, campus image, and direct `sameAs`/map identity are absent from campus entities.
- The organisation entity's three addresses are hard-coded and complete, creating an inconsistency with blank campus entities and UI output.
- Opening/service hours accurately reflect real Sunday gatherings.

Recommended model:

- Keep the parent Ev Church `Church` entity and unique child campus `Church` entities.
- Populate real `PostalAddress`, `GeoCoordinates`, image, and a stable identity link only where verified.
- Keep `parentOrganization` pointing to `https://www.ev.church/#organization`.
- Do not invent telephone numbers, office hours, or broader opening hours.

## Internal Linking

### Strengths

- Header Visit dropdown links to Visit and all three campuses.
- Footer has dedicated About, Next Steps, Sections, and Campus columns; each campus includes service time.
- Homepage links to all campuses in both service times and campus cards, then links to Visit, About, Christianity, Newish, and Connect Groups.
- Visit provides the strongest discovery hub: expectations, kids, all three locations, Plan Your Visit, contact, and About.
- Campus pages link to Visit, relevant upcoming events, directions, calendar, and contact/visit CTA.
- Kids and youth are in header/footer Next Steps; sermons and events are top-level navigation.

### Improvements

- When address data is restored, use the full street address visibly on each campus page. This is user information first and local SEO second.
- Add one natural Unichurch contextual link from relevant student/university content if such content exists; do not create a new page solely for the link.
- Keep Connect Groups linked from homepage, Visit, header, and footer. Do not add repetitive keyword anchors across unrelated pages.
- Resolve the footer's Resources destination versus the new Sermons hub deliberately so users and crawlers understand their distinct roles.

## Content Opportunities

### Supported by evidence

1. **Current homepage/Visit consolidation:** Search demand exists for church-in-Auckland and near-me intent. Current content already answers location, service time, what to expect, kids, and campus selection. Let it be crawled and measured before adding more.
2. **Youth and kids SERP/CTA improvement:** Branded ministry queries already rank 6–9 with very low CTR. Confirm current snippets, schedules, and next actions after recrawl.
3. **Unichurch/student relevance:** Strong branded demand and accurate current content justify improving entity/address completeness and student-focused measurement. “Student church” itself had no query row, so do not overstate unbranded demand.
4. **Faith exploration:** `Explaining Christianity` has small but real engagement (2 clicks/15 impressions for the exact query) and the current page has strong intent fit. Measure enquiries before expanding content.
5. **Sermon architecture:** “Ev church sermons” has 296 impressions at position 5.8 but only two clicks, mostly to Resources. Decide whether Resources or `/sermons` is the primary branded destination and align metadata/internal links accordingly.

### Not supported now

- Individual suburb landing pages for Albany, Glenfield, Browns Bay, Wairau, Mount Roskill, Three Kings, or Onehunga.
- Calling Central an Auckland CBD campus.
- Generic national or international church pages.
- High-volume generic Connect Group content without evidence of church intent.

## Bing Comparison

- Bing account/site verification succeeded for `https://ev.church/`.
- Bing reports the `www` sitemap as successful with 914 URLs.
- Bing crawl health returned no issues, but also no recent crawl statistics.
- Bing search performance returned zero rows for the 90-day query and page requests.
- Bing URL inspection failed with `ThrottleHost`; anomaly checks also returned an invalid-site URL error.

Conclusion: no cross-engine decline or Google-specific issue can be established from Bing. The successful sitemap and absence of reported crawl errors are mildly reassuring, but Bing performance should be treated as unavailable. Do not allocate substantial work to Bing until the connector provides stable data or Bing UI verification confirms a meaningful issue.

## Prioritised Backlog

| Priority | Issue | Evidence | Recommended action | Expected impact | Effort |
|---|---|---|---|---|---|
| P1 | Campus local entity fields are blank | Payload records and live JSON-LD have empty address/locality/geo/Place ID | Fix authoritative Rock/location data or controlled sync source; verify Payload, UI, map, metadata, and schema after sync | High confidence; preserves local clarity and migration | S |
| P1 | Indexed `new.ev.church` pages now 404 | GSC indexed all three campus paths; live host returns 404 | Configure exact one-hop redirects from indexed paths to `www` | Moderate; preserves accumulated signals | S |
| P1 | `home.ev.church` exclusion is inconsistent | Root noindex; tested event page indexable; GSC records traffic | Apply host-wide noindex or exact redirects for equivalent public content | Moderate; reduces duplicate/legacy surface | S–M |
| P1 | Campus slug pages need canonical consolidation | Old numeric pages indexed; slug inspections stale/duplicate | After location/redirect fixes, request recrawl and confirm selected canonicals; retain numeric redirects | High confidence; protects ~250 legacy campus clicks/90d | XS |
| P1 | Campus mobile LCP 13–15 s | PSI lab plus five eager plain images (~1.97 MB at North) | Use responsive optimized image component; one priority hero; lazy gallery; longer immutable caching for fingerprinted assets | Moderate; strong UX benefit, possible SEO benefit | M |
| P1 | GA4 cannot measure meaningful organic outcomes | No named actions or key events; property contains multiple host/app paths | Define events/key events and hostname/channel reporting contract | High measurement value, indirect traffic impact | M |
| P2 | Central tagline is geographically ambiguous | “In the heart of the city” while campus is Hillsborough | Change to accurate Hillsborough/south-central language | Low–moderate local clarity | XS |
| P2 | Branded youth/kids snippets underperform | `ev youth`: 184 impressions, 0.5% CTR, pos 6.1; `ev kids`: 93, 0%, pos 8.6 | Inspect post-launch SERPs and refine title/description/CTA only if weakness persists | Moderate | S |
| P2 | Sermon destinations may compete | Resources owns branded sermon visibility; new `/sermons` launched | Make an explicit primary-destination decision and align links/canonicals/redirects | Moderate | M–L |
| P2 | Origin TTFB needs improvement | CrUX p75 1.007 s; dynamic layout/page reads | Profile cold/p75 server timing and cache only safe public data | Moderate | M |
| P2 | Legacy login URL ends in redirected 404 | 254 impressions/6 clicks | Define correct member destination or cleanly retire URL | Low SEO; useful UX | S |
| P3 | Campus Open Graph images absent | Live campus metadata did not emit `og:image` | Add verified campus image to metadata | Sharing quality only | S |
| P3 | Static image cache is four hours | Fingerprinted campus assets use `max-age=14400` | Use long immutable caching after confirming deployment semantics | Low–moderate performance | S |
| P3 | Two-hop `/Give/` redirect | Live request reaches give site after two hops | Shorten at edge if convenient | Low | XS |

No P0 item is supported by current evidence.

## Proposed Code Changes

No code was changed. These are the P1 code/configuration mappings for review.

### 1. Complete and validate campus location data

- **Files/components:** `src/sync/mappers/campus.ts` (`mapRockCampus`), `src/collections/Campuses.ts`, `src/app/(frontend)/campus/[slug]/page.tsx` (`getAddress`, `CampusJsonLd` props), `src/components/seo/CampusJsonLd.tsx`.
- **Proposed implementation:** Correct the authoritative Rock campus locations so sync produces street, city, postal code, coordinates, and Place ID. Add validation that prevents an enabled public campus from silently emitting an empty address. Prefer source-data repair over hard-coded component fallbacks.
- **Tests required:** Mapper fixture with complete and missing location; campus page metadata/render test; JSON-LD test for full address/geo and failure/fallback behaviour; sync idempotency regression.
- **SEO risk:** Medium if implemented incorrectly because all campus entity data and visible addresses could change. Verify exact real-world addresses before mutation.

### 2. Consolidate legacy hosts

- **Files/components:** Primarily Railway/DNS/edge routing outside this repository. `next.config.ts` already owns path redirects when the request reaches this app.
- **Proposed implementation:** Route `new.ev.church` to a redirect service/current app and issue permanent, one-hop path-preserving redirects for known equivalent pages. Apply a sitewide `X-Robots-Tag: noindex` to non-public `home.ev.church` content or map public legacy pages to exact current equivalents.
- **Tests required:** HTTP matrix covering HTTP/HTTPS, host, path, query preservation, final status, redirect count, and final canonical. Re-run GSC inspection after recrawl.
- **SEO risk:** High if broad redirects send unrelated URLs to the homepage. Use exact/path-preserving mappings and leave genuinely unmatched URLs as 404/410.

### 3. Fix campus image/LCP implementation

- **Files/components:** `src/app/(frontend)/campus/[slug]/page.tsx` (`getHeroImage`, hero image, gallery image loop); reuse `src/components/media/MediaImage.tsx` or `next/image`; possibly deployment cache headers.
- **Proposed implementation:** Render the hero as the only priority image with responsive `sizes`; render gallery images with responsive variants and lazy loading; provide dimensions/aspect ratio; avoid preloading below-the-fold media; retain current alt text.
- **Tests required:** Campus render test asserting exactly one priority image and lazy gallery behaviour; image source/alt tests; mobile PSI rerun for all campuses; visual smoke test at mobile/desktop breakpoints.
- **SEO risk:** Low if URLs/alts remain stable. Main risk is a broken remote image configuration or layout regression.

### 4. Add meaningful analytics events and reporting isolation

- **Files/components:** `src/components/seo/GoogleAnalytics.tsx`, a small typed analytics helper under `src/lib/`, campus actions in `src/app/(frontend)/campus/[slug]/page.tsx`, buttons/forms in `src/components/forms/`, event registration components, ministry/Christianity CTAs.
- **Proposed implementation:** Add a typed allowlisted event helper; instrument confirmed actions with controlled parameters; add hostname/channel reporting in GA4; mark only meaningful successful outcomes as key events. Do not send form values or personal data.
- **Tests required:** Unit tests for names/parameters/privacy, DOM tests for action firing exactly once, route-change page-view regression, and production DebugView validation.
- **SEO risk:** No direct ranking risk; medium measurement/privacy risk if events duplicate or include personal data.

## Measurement Plan

### Fixed baseline

Use the current 90-day GSC period (15 May–12 August 2026) only as the migration baseline:

- Organic Google clicks: 2,289.
- Google impressions: 20,730.
- CTR: 11.0%.
- Average position: 15.6.
- New Zealand clicks: 1,981.
- Mobile clicks: 1,593.
- Query-visible recent brand/non-brand baseline: 381 branded clicks versus 29 non-branded clicks (privacy-limited helper output).
- Legacy campus pages: 250 clicks / 5,351 impressions combined.
- Campus slug pages: too new for a meaningful baseline.
- Origin field CWV: LCP 2.617 s, INP 104 ms, CLS 0.001, TTFB 1.007 s.

Do not set a GA4 organic landing-page baseline from the current connector output because hostname/channel isolation was unavailable.

### Post-launch comparison cadence

1. **Weekly for six weeks:** inspect current and numeric campus URLs, `new.ev.church` remnants, top legacy event paths, sitemap status, and Page indexing/canonical changes.
2. **At 28 complete days after consolidation:** compare current 28 days with the fixed 16 July–12 August baseline, but annotate seasonality and the site migration.
3. **At 90 complete days:** compare like-for-like current URLs and query groups with the 90-day baseline.

### KPI definitions

| KPI | Definition |
|---|---|
| Organic clicks | GSC total clicks for `sc-domain:ev.church`; report `www` and relevant subdomains separately where possible |
| Non-branded clicks | Query clicks excluding agreed Ev/Unichurch brand variants; disclose privacy-limited rows |
| Local-query impressions/clicks | Agreed query regex for Auckland, near-me, verified campus/locality, and student intent; review false positives |
| CTR | Clicks / impressions by query and landing page; do not use site-wide CTR alone |
| Average position | Impression-weighted; interpret alongside query mix |
| Organic landing-page sessions | GA4 sessions filtered to hostname `www.ev.church` and default channel `Organic Search` |
| Engaged sessions | Same hostname/channel filters, by landing page and campus |
| Important events/key events | Successful directions, visit, contact, group, ministry, event, and faith-exploration outcomes |
| Core Web Vitals | CrUX p75 mobile LCP, INP, CLS and TTFB; lab PSI for page-specific regression diagnosis |
| Campus organic entrances | GA4 organic landing sessions to the three slug URLs, plus GSC clicks to those exact pages |

### Guardrails

- Success is more relevant people finding a campus, planning a Sunday, contacting the church, joining community, registering, exploring Christianity, or using valuable teaching—not raw traffic.
- Track the numeric-to-slug campus migration separately until old URLs have ceded canonical/index status.
- Do not infer causation from simultaneous ranking, traffic, engagement, or performance changes without a controlled change or additional evidence.
