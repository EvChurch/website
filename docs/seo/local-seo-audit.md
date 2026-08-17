# Ev Church Technical and Local SEO Audit

**Audit date:** 14 August 2026 (Pacific/Auckland)  
**Production site:** `https://www.ev.church`  
**Google Search Console property:** `sc-domain:ev.church`  
**GA4 property:** `486694161`  
**Status:** Audit evidence was captured before remediation and re-verified against the repository, production, and connected SEO tools on 14 August 2026. No application code or production configuration was changed during this audit refresh.

## Implementation status — 14 August 2026

- Rock already contains complete address, coordinate, and Google Place ID data for all three campus locations. The defect was in the website sync: campus responses contain only a `LocationId`, so the sync now hydrates the full Rock location (including attributes) before mapping it into Payload.
- Campus pages now select and publish the synced coordinates and Place ID in their `Church` JSON-LD, alongside the full postal address.
- Campus hero and gallery media now use responsive Next.js images. The hero is the only eager, high-priority image; gallery images load lazily below the fold.
- The website has a deployed permanent, path-preserving `new.ev.church` to `www.ev.church` redirect.
- The Rock Service Guide home page at `home.ev.church` now has Rock's **Allow Indexing** setting disabled and emits `<meta name="robots" content="noindex, nofollow">`. Other functional Service Guide routes remain unchanged.

Current live re-verification confirms that the first implementation pass is deployed:

- Each campus now renders its full postal address, coordinates, Google Place map identity, and Sunday hours in campus-specific `Church` JSON-LD.
- `/campus/2`, `/campus/3`, and `/campus/4` permanently redirect in one hop to the matching slug route.
- `new.ev.church` permanently preserves paths into `www.ev.church`.
- Tested `home.ev.church` routes emit `noindex, nofollow`; the previously cited legacy event route now returns 404.
- The live sitemap still contains 914 canonical `www` URLs and only the three slug campus routes.
- Post-remediation Lighthouse and PageSpeed runs vary materially. The latest authenticated mobile PSI run measured campus LCP at 10.52 s (North), 10.08 s (Central), and 10.13 s (Unichurch), while origin field LCP remains about 2.62 s. Repeated/page-level evidence is required before another performance change.

Performance tables and GSC/GA4/Bing datasets are labelled by capture period. Narrative findings and the backlog reflect current re-verification unless explicitly described as pre-remediation.

## Executive Summary

### 1. How healthy is current SEO?

The current website is technically sound in the major crawl, canonical, metadata, sitemap, local-entity, and navigation areas, but it is still in an SEO migration period rather than a settled state.

The live site has crawlable pages, consistent `www` canonicals, a clean XML sitemap, working apex-to-`www` redirects, useful titles and descriptions, strong navigation, and valid structured data syntax. Google has already recrawled and indexed the current homepage, Visit page, and all three slug campus pages after the latest deployment.

The main remaining risk is search-engine consolidation. Fresh inspection passes for the slug campus pages with the correct `www` Google canonical, but most historical campus visibility belongs to the old numeric URLs (`/campus/2`, `/campus/3`, `/campus/4`) and some indexed `new.ev.church` pages. Google still reports those sampled legacy URLs as indexed with their old selected canonicals even though they now redirect correctly. The technical prerequisites are in place; legacy recrawl and deindexing remain outstanding.

There is no confirmed P0 crawl or indexing outage. Several previously identified implementation issues are deployed. Legacy canonical consolidation and performance monitoring remain open; the first meaningful analytics events and an isolated Organic Search report are implemented in the current delivery branch, but production deployment and key-event decisions remain outstanding.

### 2. What is already working?

- The homepage, Visit page, and all three current campus pages are submitted, fetched successfully, mobile-crawled, and indexed by Google with correct `www` Google canonicals.
- `http://ev.church` and `https://ev.church` redirect to `https://www.ev.church/` in one hop.
- Current production titles, descriptions, canonical tags, Open Graph URLs, and sitemap URLs consistently use `https://www.ev.church`.
- The live XML sitemap contains 914 unique URLs, no parameterised URLs, no non-`www` URLs, no numeric campus URLs, and no `new.ev.church` or `home.ev.church` URLs.
- Google reports the sitemap with zero errors and zero warnings; Bing reports it as successful.
- Main navigation, footer navigation, homepage service times, Visit, and contextual cards all link naturally to the three campus pages.
- Campus pages have a clear H1, service time, location label, local introduction, kids information where relevant, directions link, map, parking information, event links, canonical, breadcrumbs, and campus-specific `Church` markup.
- Campus-specific schema now contains verified full addresses, geo coordinates, Google Place map links, and Sunday service hours.
- Legacy numeric campus URLs and the retired `new.ev.church` host now redirect directly to canonical equivalents; tested `home.ev.church` pages are noindexed.
- Mobile field data at the origin level shows good INP (104 ms) and CLS (0.001). The homepage passes Lighthouse SEO (100), best practices (100), and accessibility is high (96).
- Organic search is strongly local: in the refreshed 90-day GSC country breakdown, New Zealand produced 1,989 of 2,299 clicks (86.5%).

### 3. What are the three biggest problems?

1. **Search-engine consolidation is incomplete.** Fresh inspection passes for all three slug campus pages, but the old numeric campus URLs and sampled `new.ev.church` page are also still reported as indexed with legacy selected canonicals. Redirects and current canonicals are correct; recrawl/deindexing must be monitored.
2. **Meaningful outcome measurement needs deployment validation.** The current delivery branch covers campus directions, event registration, confirmed Visit/Newish/Explaining Christianity submissions, and explicit Connect Group/Kids/Youth intent clicks. Generic Contact remains deliberately outside GA on its privacy-sensitive route. The new events still require production deployment, collection validation, and an agreed key-event baseline.
3. **Mobile LCP remains inconsistent.** The latest lab run measured roughly 10 seconds on all three campus pages, while origin field LCP is about 2.6 seconds and field INP/CLS are good. The gap needs repeated page-level diagnosis before another performance change is justified.

### 4. What are the three biggest opportunities?

1. **Consolidate existing local authority into the current campus URLs.** The old campus pages generated 250 clicks and 5,351 impressions over 90 days. Preserving those signals through redirects, complete local entities, and recrawl is more valuable than creating new suburb pages.
2. **Improve pages already close to meaningful discovery.** Over 90 days, “church in auckland” ranked 6.0 (159 impressions), “christian church near me” ranked 6.4 (44 impressions), “church near me” ranked 13.4 (64 impressions), and “christian church auckland” ranked 10.7 (45 impressions). The current homepage and Visit content now fit these intents well; consolidation and CTR monitoring should come before additional content.
3. **Validate church-connection measurement.** Visiting, directions, registration, faith exploration, and ministry/group intent now have a typed implementation in the current branch. Validate production collection and mark only agreed successful outcomes—not intent clicks—as key events.

### 5. What should we do this week?

1. Monitor the old numeric and `new.ev.church` URLs moving to the already-indexed slug canonicals; retain the permanent redirects and reinspect the legacy URLs after recrawl.
2. Deploy and validate the completed GA4 event contract, then agree which successful outcomes are key events. Use the saved `www Organic Search landing pages` exploration rather than property-wide totals.
3. Repeat mobile performance measurements, prioritising homepage, North, and Unichurch; inspect LCP render delay and the homepage hero priority hint before proposing more performance code.
4. Normalize Unichurch schema as Old Government House (B102), 24 Princes Street, Auckland CBD, Auckland 1010; do not invent telephone or office-hour fields.
5. Correct Central's ambiguous “heart of the city” tagline during the next approved content edit, then decide whether `resources.ev.church` or `/sermons` is the primary branded sermon destination.

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

- GSC performance was refreshed through 13 August 2026. Current production content and the sitemap were updated on 13–14 August, so historical performance remains primarily a migration baseline rather than a verdict on the current pages.
- The connector's dimension exports do not fully reconcile: current 90-day device totals are 2,299 clicks and 20,654 impressions, while summed page rows are higher and query rows are lower. Site-wide totals below use device totals; page/query rows are directional and may include URL-level duplication or query privacy loss.
- GA4's available tool surface did not expose hostname-filtered landing-page, Organic Search channel, source/medium, city, or custom-dimension reports. The property contains Rock-style paths such as `/MyAccount`, `/ScheduleToolbox`, `/Give/`, and `/Unsubscribe/...`, so its totals cannot be attributed solely to `www.ev.church`.
- GA4 reported no key events/conversions. “Users,” deduplicated total active users, organic landing pages, and organic engagement cannot be stated reliably from the available reports.
- Bing authentication and sitemap access worked, but search performance returned zero rows and URL inspection was throttled. This is recorded as unavailable evidence, not zero real-world Bing traffic.
- PageSpeed field data is origin-level and identical across tested URLs; lab data is page-specific. The connector labels one lab responsiveness value “firstInputDelay”; this audit uses INP for field responsiveness and TBT as the lab main-thread proxy.
- The authenticated GSC, GA4, Bing, URL Inspection, schema, and PageSpeed datasets were refreshed through the connected tools on 14 August. GA4's exposed report surface remains the principal data limitation.

## Current Canonical URL Inventory

| Content | Current canonical URL | Observed status |
|---|---|---|
| Homepage | `https://www.ev.church` | 200; indexed; matching Google/user canonical |
| Ev North | `https://www.ev.church/campus/north` | 200; submitted and indexed; Google canonical is the current `www` URL |
| Ev Central | `https://www.ev.church/campus/central` | 200; submitted and indexed; matching user/Google canonical |
| Unichurch | `https://www.ev.church/campus/unichurch` | 200; submitted and indexed; matching user/Google canonical |
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
| 17 Jul–13 Aug (28 days) | 775 | 6,392 | 12.1% | 14.5 weighted | Migration baseline |
| 16 May–13 Aug (90 days) | 2,299 | 20,654 | 11.1% | 15.5 | Primary baseline |
| 15 Feb–15 May (previous 90 days) | 2,995 | 24,926 | 12.0% | 12.5 | Comparison period |
| 14 Aug 2025–13 Aug 2026 | 10,203 | 89,411 | 11.4% | 13.8 weighted | Seasonality/context only |

Current 90 days versus previous 90 days:

- Clicks: down 696 (-23.2%).
- Impressions: down 4,272 (-17.1%).
- CTR: down 0.88 percentage points (-7.4% relative).
- Average position: worsened from 12.5 to 15.5.

This is an observed decline, not a demonstrated penalty or technical cause. The periods cross a major host/canonical/content transition, event demand is seasonal, and the current site is newer than the data cutoff. Bing has no usable comparison data. Rebaseline after 28 complete days on the current production site.

Google detected click spikes on 25 July and 8 August, not traffic-drop anomalies. The audit helper returned no fully lost queries.

### Device and country

| Device, 90 days | Clicks | Impressions | CTR | Position |
|---|---:|---:|---:|---:|
| Mobile | 1,591 | 10,099 | 15.8% | 7.6 |
| Desktop | 680 | 10,364 | 6.6% | 23.4 |
| Tablet | 28 | 191 | 14.7% | 11.9 |

Mobile produces 69.2% of clicks and has much stronger average visibility than desktop. This makes campus mobile LCP a material SEO and user-experience issue.

| Country, 90 days | Clicks | Impressions | CTR | Position |
|---|---:|---:|---:|---:|
| New Zealand | 1,989 | 8,579 | 23.2% | 8.8 |
| Australia | 166 | 3,432 | 4.8% | 7.3 |
| United States | 35 | 3,256 | 1.1% | 35.8 |
| United Kingdom | 26 | 621 | 4.2% | 23.5 |

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
| christian church near me | 44 | 0 | 0% | 6.4 | Homepage | Find a nearby Christian church | Preserve complete campus entities and strong Visit/campus links; do not create suburb pages | Moderate | XS |
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
| Mobile | 1,707 | 4,058 | 57.8% |
| Desktop | 1,679 | 2,944 | 52.7% |
| Tablet | 27 | 43 | 72.1% |

Across the property, the reported average session duration was 157.4 seconds and engagement rate was 56.7%. New/returning segmentation from the earlier captured audience report showed 3,016 new active users and 898 returning active users. The refreshed user-behaviour report shows New Zealand leading with 2,094 active users and 5,544 sessions.

These are property-level observations, not `www.ev.church` Organic Search KPIs. The same property contains substantial Rock/member/admin-style paths, so totals and engagement cannot be cleanly correlated with GSC without hostname and channel filters.

### Events and key events

| Event, 90 days | Event count | Key events/conversions |
|---|---:|---:|
| `page_view` | 16,324 | 0 |
| `user_engagement` | 10,140 | 0 |
| `session_start` | 7,152 | 0 |
| `scroll` | 5,474 | 0 |
| `first_visit` | 3,064 | 0 |
| `click` | 496 | 0 |
| `form_start` | 484 | 0 |
| `video_progress` | 55 | 0 |
| `video_start` | 25 | 0 |
| `video_complete` | 18 | 0 |
| `form_submit` | 4 | 0 |

No named church-connection events or key events were exposed in the captured 90-day dataset. The current delivery branch adds `get_directions`, `event_registration_click`, `visit_plan_submit`, `contact_church` (Newish), `faith_exploration_enquiry`, `connect_group_enquiry_click`, and `ministry_enquiry_click`; production deployment and collection are not yet proven. Generic Contact remains excluded from GA by the route privacy boundary.

### Correlation with GSC

- GSC shows meaningful New Zealand/mobile search demand. GA4 also reports mobile and New Zealand as the largest categories, but the shared-property contamination prevents a reliable click-to-session reconciliation.
- GSC identifies homepage, old campus URLs, About, Visit, kids, youth, and Connect Groups as meaningful search surfaces. A GA4 exploration named `www Organic Search landing pages` now reports landing pages with hostname `www.ev.church` and default channel group `Organic Search`; it should be used only as a reporting baseline, not evidence that the branch's new events are live.
- No claim is made that high or low GSC CTR caused GA4 engagement outcomes.

## Local SEO Performance

### Ev Church overall

The current homepage has a strong local proposition: “Church in Auckland,” Tāmaki Makaurau context, three campuses, Sunday service times, Visit and campus links, kids, groups, Christianity exploration, events, and sermons. Search demand supports this focus.

The campus entities and visible location data are now complete. The remaining local SEO issue is confirming that search engines consolidate legacy URLs into the current slug routes; new location copy is not the priority.

### Ev North

**Current canonical:** `https://www.ev.church/campus/north`

What works:

- H1 “Ev North,” eyebrow “Rosedale, Auckland,” and description explicitly mention Rosedale and the North Shore.
- Sunday 10:15 am, 75-minute duration, kids ages 1–12, parking, map, directions, and local image alt text are present.
- Navigation, footer, Visit, and homepage link directly to the page.
- Title and description are geographically accurate.

Remaining gaps:

- Fresh inspection reports the slug URL as submitted and indexed with `https://www.ev.church/campus/north` selected as Google's canonical. The old numeric URL is also still reported as indexed/self-canonical, so legacy consolidation remains open.
- Current live JSON-LD exposes `9-11 Rothwell Avenue, Rosedale`, postcode `0632`, coordinates, Google Place identity, and Sunday hours. The latest mobile PSI lab run measured 10.52 s LCP; repeated measurement is needed because lab runs have varied materially.

Legacy baseline: old `/campus/2` produced 60 clicks and 1,418 impressions over 90 days and remains indexed alongside the current slug URL. It now redirects in one hop (308) to `/campus/north`.

### Ev Central

**Current canonical:** `https://www.ev.church/campus/central`

What works:

- H1 “Ev Central,” location “Hillsborough, Auckland,” and body copy “south-central Auckland” are accurate.
- Sunday 10:15 am, kids ages 1–12, parking, map, directions, and Hillsborough image alt text are present.
- Title/description do not call Hillsborough Auckland CBD.

Remaining gaps:

- The tagline “In the heart of the city” is ambiguous and unnecessary for a Hillsborough campus. Replace it with accurate Hillsborough/south-central language when content is next edited.
- Fresh inspection reports the current Central page as submitted and indexed with matching `www` user/Google canonicals. The old numeric URL is still reported as indexed/self-canonical, so legacy consolidation remains open.
- Current live JSON-LD exposes `80 Olsen Ave, Hillsborough`, postcode `1042`, coordinates, Google Place identity, and Sunday hours. The latest mobile PSI lab run measured 10.08 s LCP, reinforcing the need to use repeated runs and field data rather than a single favourable result.

Legacy baseline: old `/campus/3` produced 53 clicks and 2,631 impressions over 90 days and now redirects in one hop to `/campus/central`.

### Unichurch

**Current canonical:** `https://www.ev.church/campus/unichurch`

What works:

- Title, H1, description, body copy, and image alt text clearly express University of Auckland, tertiary student, Auckland, and Sunday-evening intent.
- The page does not present Central/Hillsborough as CBD; Unichurch correctly owns university/CBD relevance.
- Service time, map, directions, parking, events, and Visit CTA are present.
- Existing branded demand is strong relative to the site.

Remaining gaps:

- Fresh inspection reports the current Unichurch page as submitted and indexed with matching `www` user/Google canonicals. The old numeric URL and sampled staging URL are still reported as indexed/self-canonical, so legacy consolidation remains open.
- Current live JSON-LD exposes Old Government House (B102), Auckland Central, postcode `1010`, coordinates, Google Place identity, and Sunday hours. The latest mobile PSI lab run measured 10.13 s LCP, which remains poor and needs repeated measurement.

Legacy baseline: old `/campus/4` produced 137 clicks and 1,302 impressions over 90 days and now redirects in one hop to `/campus/unichurch`.

## Quick Wins

1. Reinspect the legacy numeric and staging campus URLs after recrawl and confirm they cede index/canonical status to the already-indexed slug pages.
2. Replace Central's ambiguous tagline with Hillsborough/south-central wording during an approved content edit.
3. Define and name the minimum meaningful GA4 events before changing page copy based on traffic alone.
4. Repeat mobile performance measurements for homepage, North, and Unichurch; use medians and field data before another implementation change.
5. Decide the primary branded sermon destination and align internal links after that product decision.

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
- Homepage, campus, and most CMS pages inherit a generated 1200×630 Open Graph image where no CMS image is provided. The campus image is currently generic rather than campus-specific; this is a P3 sharing-quality issue, not an indexing issue.

### Robots and sitemap

- robots.txt allows public content and blocks admin, API, auth, member, and capability paths.
- Sitemap points to `https://www.ev.church/sitemap.xml`.
- Live sitemap: 914 URLs, no duplicates, no query strings, no non-`www` URLs, and only slug campus routes.
- Google: sitemap accepted, zero warnings/errors, last downloaded 13 August.
- Bing: sitemap success, 914 URLs.
- Google's sitemap API returned “0 indexed,” but URL Inspection and live search performance prove indexed URLs exist. Treat that count as unreliable connector/API output, not a P0.

### Images, fonts, JavaScript, and caching

- CMS hero/photo-strip components already use `next/image`, responsive sizes, and priority selectively.
- Campus pages now use responsive Next.js images. The hero is eager with `fetchPriority="high"`; below-the-fold gallery images are lazy and use responsive `sizes`.
- The pre-remediation North trace loaded five eager local JPEGs (about 1.97 MB). That implementation defect is fixed. Fresh Lighthouse still reports page-specific image compression/sizing opportunities below the fold, but no broad eager-gallery preload problem.
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

### Pre-remediation mobile lab data

| Page | Performance | LCP | FCP | TBT | CLS | SEO |
|---|---:|---:|---:|---:|---:|---:|
| Homepage | 77 | 4.20 s | 2.90 s | 178 ms | 0.056 | 100 |
| Ev North | 55 | 14.69 s | 4.92 s | 148 ms | 0.000 | 100 |
| Ev Central | 59 | 14.49 s | 4.44 s | 67 ms | 0.056 | 100 |
| Unichurch | 64 | 12.98 s | 2.86 s | 94 ms | 0.055 | 100 |
| About | 63 | 7.97 s | 4.37 s | 155 ms | 0.053 | 100 |

Priority diagnosis:

1. Campus hero/gallery image delivery was the clearest page-specific cause and has been remediated with responsive images, explicit sizes, a single priority hero, and lazy galleries.
2. Public pages perform multiple dynamic server reads in the layout and page. Measure cold and p75 server timing before proposing caching changes; warm curl TTFB alone does not reproduce CrUX.
3. After images, test whether the Typekit CSS import materially delays FCP. Do not remove brand fonts without a measured replacement plan.
4. Do not prioritise broad JS removal: TBT and field INP are already good.

### Post-remediation mobile Lighthouse spot check

Run at approximately 20:50 NZST on 14 August 2026 against production. These are single lab runs on an emulated mobile profile, not PageSpeed/CrUX field results.

| Page | Performance | LCP | FCP | TBT | CLS | TTFB |
|---|---:|---:|---:|---:|---:|---:|
| Homepage | 59 | 10.3 s | 5.1 s | 80 ms | 0.054 | 250 ms |
| Ev North | 62 | 8.4 s | 4.7 s | 120 ms | 0.053 | 220 ms |
| Ev Central | 78 | 4.3 s | 3.3 s | 110 ms | 0.056 | 230 ms |
| Unichurch | 60 | 10.0 s | 4.5 s | 170 ms | 0.053 | 220 ms |

The campus LCP element is the priority hero image. North, Central, and Unichurch all pass Lighthouse's discovery checks: the resource is in the initial document, eagerly loaded, and has a high priority hint. The remaining lab delay was dominated by element render delay on the slow North/Unichurch runs, not image discovery. The homepage hero was discoverable and eager but lacked a high-priority hint in this trace, and its 10.3 s LCP included about 2.0 s element render delay. Validate this across repeated PSI/Lighthouse runs before changing code because the results vary materially from the earlier run and from origin field LCP.

### Latest authenticated mobile PageSpeed refresh

Run on 14 August 2026. The connector returned the same origin-level CrUX values for each route, so the lab values below are page-specific while the field values are not.

| Page | Performance | LCP | FCP | TBT | CLS |
|---|---:|---:|---:|---:|---:|
| Homepage | 74 | 4.20 s | 2.77 s | 291 ms | 0.056 |
| Ev North | 52 | 10.52 s | 4.96 s | 337 ms | 0.000 |
| Ev Central | 53 | 10.08 s | 4.93 s | 317 ms | 0.000 |
| Unichurch | 60 | 10.13 s | 4.89 s | 124 ms | 0.000 |
| About | 54 | 8.00 s | 4.69 s | 323 ms | 0.000 |
| Visit | 56 | 7.25 s | 3.46 s | 479 ms | 0.000 |
| Sermons | 62 | 5.25 s | 3.01 s | 432 ms | 0.076 |

The current field assessment is “average” overall: LCP 2.615 s, TTFB 1.004 s, and FCP 1.861 s need improvement, while INP 103 ms and CLS 0.001 are good. The large lab variance and much healthier field LCP mean this is a P1 investigation/monitoring item, not proof of one specific code defect.

## Analytics Measurement Gaps

### Current delivery-branch measurement

- GA4: page views plus a typed allowlisted helper for meaningful events; enhanced-measurement events also appear in GA4.
- PostHog: `$pageview`, exceptions, and session recording; autocapture is disabled.
- The branch sends `get_directions` for known campus Google Maps actions, `event_registration_click` for approved event registration links, and confirmed-success events for Visit, Contact, Newish, and Exploring Christianity forms. Parameters are controlled and exclude submitted form values.
- Connect Group and ministry CTA intent clicks are implemented on their non-sensitive source pages. Kids context is also carried into a successful Plan Your Visit event. These clicks should not be treated as completed enquiries or key events.
- `ROCK_FORM_SUBMIT_ACTION` is an internal form action name, not a GA4 event implementation.

### Missing meaningful events

| Proposed event | Trigger | Recommended parameters | Key event? |
|---|---|---|---|
| `campus_view` | View a campus route | `campus`, `location`, `service_time` | No |
| `get_directions` | Click campus Google Maps action | `campus`, `destination_host` | Yes |
| `visit_plan_start` | Start Plan Your Visit form | `campus`, `form_id` | No |
| `visit_plan_submit` | Successful Visit submission | `form_type` | Yes |
| `contact_church` | Successful Newish form | `topic`, `method`, `form_type` | Yes |
| `connect_group_enquiry_click` | Click Join a group before entering Contact | `destination_path` | No |
| `event_registration_click` | Click registration CTA | `event_slug`, `campus`, `destination_host` | No/Yes by event |
| `ministry_enquiry_click` | Click the primary Kids/Youth next action | `ministry`, `destination_path` | No |
| `faith_exploration_start` | Start Exploring Christianity/Good News journey | `journey`, `step` | No |
| `faith_exploration_enquiry` | Successful course/enquiry action | `journey`, `form_type` | Yes |
| `outbound_registration` | Leave for approved registration provider | `destination_host`, `context`, `campus` | No |

Use stable snake_case names, send events only after confirmed success where applicable, avoid personal data in parameters, and make `campus` an explicit controlled value (`north`, `central`, `unichurch`).

Before using events as SEO outcomes, validate them in production and agree the key-event set. The saved `www Organic Search landing pages` exploration already filters hostname `www.ev.church` and default channel group `Organic Search`.

## Indexation / Legacy URLs

| Severity | Finding | Observed evidence | Action |
|---|---|---|---|
| High | Legacy campus URLs remain indexed/self-canonical | Fresh inspection passes for current slug pages, but old numeric and sampled staging URLs are also still reported indexed with legacy selected canonicals | Retain redirects; reinspect legacy URLs after recrawl and monitor their removal |
| Resolved; monitor | Indexed `new.ev.church` campus pages returned 404 | Current live host now redirects paths permanently and directly to `www` | Preserve redirect; monitor GSC until legacy URLs disappear |
| Resolved; monitor | `home.ev.church` exclusion was inconsistent | Tested root and campus route now emit `noindex,nofollow`; previously cited legacy event URL now returns 404 | Preserve host-wide exclusion and sample functional routes periodically |
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
- Campus-specific `Church` entity with unique ID/URL, campus name, alternate name, complete address, geo coordinates, Google Place map link, and Sunday hours.
- Breadcrumb schema on campus and CMS pages.
- Article/Event schema on relevant content types.
- FAQ schema on the FAQ page when accordion items exist.

### Findings

- The schema validator reports the homepage and all three campuses as syntactically valid.
- Live campus-specific street, postcode, coordinates, map identity, and Sunday hours are complete for all three locations.
- Telephone, campus image, and direct campus `sameAs` are absent from campus entities. Add only verified real information; the missing fields are enhancements, not evidence that the current schema is invalid.
- The two Unichurch schema representations describe the same place, not conflicting locations: Old Government House is at 24 Princes Street, Auckland CBD, Auckland 1010. Normalize the fields so the venue name, unit/room, street address, locality, and postcode are all explicit and consistent. The organisation addresses are hard-coded while campus entities are synced, so sharing a source would reduce future drift risk.
- Opening/service hours accurately reflect real Sunday gatherings.

Recommended model:

- Keep the parent Ev Church `Church` entity and unique child campus `Church` entities.
- Populate real `PostalAddress`, `GeoCoordinates`, image, and a stable identity link only where verified.
- Do not add `parentOrganization` to `Church`: Schema.org defines `Church` as a `PlaceOfWorship`, not an `Organization`.
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

- Keep the now-restored full street address visible and consistent with each campus entity. This is user information first and local SEO second.
- Add one natural Unichurch contextual link from relevant student/university content if such content exists; do not create a new page solely for the link.
- Keep Connect Groups linked from homepage, Visit, header, and footer. Do not add repetitive keyword anchors across unrelated pages.
- Resolve the footer's Resources destination versus the new Sermons hub deliberately so users and crawlers understand their distinct roles.

## Content Opportunities

### Supported by evidence

1. **Current homepage/Visit consolidation:** Search demand exists for church-in-Auckland and near-me intent. Current content already answers location, service time, what to expect, kids, and campus selection. Let it be crawled and measured before adding more.
2. **Youth and kids SERP/CTA improvement:** Branded ministry queries already rank 6–9 with very low CTR. Confirm current snippets, schedules, and next actions after recrawl.
3. **Unichurch/student relevance:** Strong branded demand, accurate current content, and complete location data justify student-focused outcome measurement. “Student church” itself had no query row, so do not overstate unbranded demand.
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
| P1 | Legacy campus URLs have not finished consolidating | Current slugs are correctly indexed, but old numeric/staging samples remain indexed/self-canonical in inspection | Retain redirects; reinspect legacy URLs and monitor deindexing/selected canonicals | High confidence; protects ~250 legacy campus clicks/90d | XS |
| P1 | GA4 outcome measurement needs production validation | Typed events and isolated Organic Search exploration exist; production collection and key events are unproven | Deploy/validate current events and agree key events; keep intent clicks distinct from successful outcomes | High measurement value, indirect traffic impact | S |
| P1 | Mobile LCP remains inconsistent after image fix | Latest PSI lab: homepage 4.2 s; campuses about 10.1–10.5 s; origin field LCP 2.615 s | Run repeated PSI/Lighthouse and inspect render delay; fix only a reproducible bottleneck | Moderate UX benefit; possible SEO benefit | S investigation, implementation TBD |
| P2 | Central tagline is geographically ambiguous | “In the heart of the city” while campus is Hillsborough | Change to accurate Hillsborough/south-central language | Low–moderate local clarity | XS |
| P2 | Unichurch address fields are not normalized | Sitewide schema has `24 Princes Street`; campus schema has the venue name but omits the street number | Represent it consistently as Old Government House (B102), 24 Princes Street, Auckland CBD, Auckland 1010 | Clearer entity data; low ranking impact | XS–S |
| P2 | Branded youth/kids snippets underperform | `ev youth`: 184 impressions, 0.5% CTR, pos 6.1; `ev kids`: 93, 0%, pos 8.6 | Inspect post-launch SERPs and refine title/description/CTA only if weakness persists | Moderate | S |
| P2 | Sermon destinations may compete | Resources owns branded sermon visibility; new `/sermons` launched | Make an explicit primary-destination decision and align links/canonicals/redirects | Moderate | M–L |
| P2 | Origin TTFB needs improvement | CrUX p75 1.007 s; dynamic layout/page reads | Profile cold/p75 server timing and cache only safe public data | Moderate | M |
| P2 | Legacy login URL ends in redirected 404 | 254 impressions/6 clicks | Define correct member destination or cleanly retire URL | Low SEO; useful UX | S |
| P3 | Campus Open Graph images are generic | Live campus metadata uses the shared `/og-image` rather than a campus image | Add verified campus-specific image only if sharing quality warrants it | Sharing quality only | S |
| P3 | Static image cache is four hours | Fingerprinted campus assets use `max-age=14400` | Use long immutable caching after confirming deployment semantics | Low–moderate performance | S |
| P3 | Two-hop `/Give/` redirect | Live request reaches give site after two hops | Shorten at edge if convenient | Low | XS |

No P0 item is supported by current evidence.

## Proposed Code Changes

No application code was changed during this audit refresh. The repository already contains the deployed implementation work described below; remaining P1 recommendations are mapped for review.

### 1. Completed: campus location data

- **Files/components:** `src/sync/mappers/campus.ts` (`mapRockCampus`), `src/collections/Campuses.ts`, `src/app/(frontend)/campus/[slug]/page.tsx` (`getAddress`, `CampusJsonLd` props), `src/components/seo/CampusJsonLd.tsx`.
- **Implemented:** The sync hydrates the authoritative Rock location and maps street, city, postcode, coordinates, and Google Place ID into Payload; campus rendering and JSON-LD now use those fields.
- **Tests required:** Mapper fixture with complete and missing location; campus page metadata/render test; JSON-LD test for full address/geo and failure/fallback behaviour; sync idempotency regression.
- **SEO risk:** Medium if implemented incorrectly because all campus entity data and visible addresses could change. Verify exact real-world addresses before mutation.

### 2. Completed implementation; monitoring remains: legacy hosts

- **Files/components:** Primarily Railway/DNS/edge routing outside this repository. `next.config.ts` already owns path redirects when the request reaches this app.
- **Implemented:** `new.ev.church` now permanently preserves paths into `www`; tested Service Guide routes emit `noindex,nofollow`. Search-engine recrawl and deindexing remain external monitoring work.
- **Tests required:** HTTP matrix covering HTTP/HTTPS, host, path, query preservation, final status, redirect count, and final canonical. Re-run GSC inspection after recrawl.
- **SEO risk:** High if broad redirects send unrelated URLs to the homepage. Use exact/path-preserving mappings and leave genuinely unmatched URLs as 404/410.

### 3. Completed implementation; measurement remains: campus images/LCP

- **Files/components:** `src/app/(frontend)/campus/[slug]/page.tsx` (`getHeroImage`, hero image, gallery image loop); reuse `src/components/media/MediaImage.tsx` or `next/image`; possibly deployment cache headers.
- **Implemented:** The hero is the only eager high-priority responsive image; gallery images use responsive sizes and lazy loading while retaining alt text. Fresh lab results improved materially but remain inconsistent, so another code change should follow reproducible evidence.
- **Tests required:** Campus render test asserting exactly one priority image and lazy gallery behaviour; image source/alt tests; mobile PSI rerun for all campuses; visual smoke test at mobile/desktop breakpoints.
- **SEO risk:** Low if URLs/alts remain stable. Main risk is a broken remote image configuration or layout regression.

### 4. Implemented in current branch; validation remains: meaningful analytics events and reporting isolation

- **Files/components:** `src/lib/analytics.ts`, `src/components/analytics/TrackedLink.tsx`, campus actions in `src/app/(frontend)/campus/[slug]/page.tsx`, event registration, and Rock form components.
- **Implemented:** A typed allowlisted helper sends controlled events for directions, registration clicks, confirmed Visit/Newish/Explaining Christianity success, Connect Group/Kids/Youth intent clicks, and Kids-sourced Visit success. Sensitive routes remain excluded and no submitted form values are sent. GA4 contains a saved hostname/channel-filtered landing-page exploration.
- **Validation remaining:** Confirm event collection in production and mark only agreed successful outcomes as key events. Generic Contact stays outside GA unless a separate privacy-reviewed measurement design is approved.
- **Tests:** Unit coverage protects event names, parameters, form-route mapping, and sensitive-path exclusion; production DebugView validation remains.
- **SEO risk:** No direct ranking risk; medium measurement/privacy risk if events duplicate or include personal data.

### 5. Proposed P2: normalize the organisation and campus entity graph

- **Files/components:** `src/components/seo/OrganizationJsonLd.tsx` (`OrganizationJsonLd`) and `src/components/seo/CampusJsonLd.tsx` (`CampusJsonLd`); use the current campus data source rather than duplicating verified addresses where practical.
- **Proposed implementation:** Represent the one verified location consistently as Old Government House (B102), 24 Princes Street, Auckland CBD, Auckland 1010. Keep the venue name separate from `streetAddress` and do not add organization-only properties to the `Church` place entities. Add image, telephone, or direct `sameAs` only when verified.
- **Tests required:** Update `OrganizationJsonLd.test.tsx` and `CampusJsonLd.test.tsx` to assert identical verified address facts and stable `@id` values; rerun live schema validation on all four pages.
- **SEO risk:** Low because this normalizes two descriptions of the same verified location; the main risk is accidentally dropping the venue/room detail while restructuring fields.

## Measurement Plan

### Fixed baseline

Use the current 90-day GSC period (16 May–13 August 2026) only as the migration baseline:

- Organic Google clicks: 2,299.
- Google impressions: 20,654.
- CTR: 11.1%.
- Average position: 15.5.
- New Zealand clicks: 1,989.
- Mobile clicks: 1,591.
- Query-visible recent brand/non-brand baseline: 381 branded clicks versus 29 non-branded clicks (privacy-limited helper output).
- Legacy campus pages: 250 clicks / 5,351 impressions combined.
- Campus slug pages: too new for a meaningful baseline.
- Origin field CWV: LCP 2.617 s, INP 104 ms, CLS 0.001, TTFB 1.007 s.

Use the saved `www Organic Search landing pages` exploration as the GA4 baseline because it isolates hostname `www.ev.church` and default channel group `Organic Search`. Keep the audit's earlier property-wide totals separate.

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
