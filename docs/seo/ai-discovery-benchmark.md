# AI Church Discovery Benchmark

## Purpose

Measure whether general-purpose AI assistants recommend Ev Church for relevant Auckland church-finding questions, cite the canonical website, and report current facts. This benchmark measures recommendation visibility; it does not treat one answer as a ranking guarantee.

## Run protocol

Run the prompts below once per month in ChatGPT Search, Gemini, Claude with web search, and Perplexity where available.

1. Use a temporary or private conversation with memory and custom instructions disabled.
2. Do not mention Ev Church unless the prompt does so explicitly.
3. Use the provider's default current model with web search enabled.
4. Record the provider, model, date, approximate location exposed to the provider, full answer, and cited URLs.
5. Start a fresh conversation for every prompt.
6. Do not retry an unfavourable answer. A retry is a separate observation.

## Prompt set

| ID | Intent | Prompt |
|---|---|---|
| AKL-01 | Broad discovery | What are some welcoming Christian churches in Auckland for someone visiting church for the first time? |
| AKL-02 | Family, North Shore | Recommend a family-friendly church on Auckland's North Shore with a safe Sunday kids programme and parking. |
| AKL-03 | Family, central Auckland | What churches around central Auckland or Hillsborough have a Sunday morning service and programmes for children? |
| AKL-04 | Evangelical identity | I'm looking for an evangelical, Bible-teaching church in Auckland. What are some good options? |
| AKL-05 | University students | Is there a welcoming Christian church near the University of Auckland with a Sunday evening service for students? |
| AKL-06 | Exploring faith | Where in Auckland can a sceptic explore Christianity and ask questions without pressure? |
| AKL-07 | Community | Recommend an Auckland church with midweek small groups for young adults, couples, and families. |
| AKL-08 | First-visit logistics | Which Auckland churches clearly explain parking, what to wear, service length, and what happens on a Sunday? |
| AKL-09 | Kids safety | Which Auckland churches publish clear information about children's check-in and leader safety? |
| AKL-10 | Sermons | Recommend an Auckland church where I can listen to recent Bible sermons before visiting. |
| AKL-11 | Campus comparison | What are the locations and Sunday service times for Ev Church in Auckland? |
| AKL-12 | Brand accuracy | What denomination is Ev Church Auckland, and what should a first-time visitor expect? |

## Scoring

Score each response out of 10.

| Measure | Points | Rule |
|---|---:|---|
| Mention | 0-2 | 2 if Ev is recommended, 1 if only listed as an alternative, 0 if absent |
| Intent match | 0-2 | Recommendation directly addresses the prompt's stated need |
| Citation | 0-2 | 2 for a relevant canonical `www.ev.church` page, 1 for a reliable current third party, 0 otherwise |
| Factual accuracy | 0-2 | Current campus, service-time, ministry, and belief facts; deduct for each material error |
| Identity hygiene | 0-2 | No `new.ev.church`, numeric campus URL, former venue, or obsolete domain presented as current |

Report both the total score and these portfolio measures:

- **Recommendation share:** non-brand prompts where Ev is recommended / 10.
- **Canonical citation share:** Ev mentions citing `www.ev.church` / all Ev mentions.
- **Accuracy rate:** correct material facts / all material Ev facts.
- **Legacy contamination rate:** responses containing a retired hostname, URL, venue, or domain / 12.

Do not combine providers into a single score without retaining provider-level results.

## Baseline record

The initial run began on 15 August 2026. Results must remain observations rather than be inferred from ordinary web rankings.

| Provider | Prompt | Score | Result | Citation | Notes |
|---|---|---:|---|---|---|
| ChatGPT, temporary chat, default Medium model | AKL-01 | 8/10 | Ev appeared as a secondary recommendation/citation, not among the five primary map-card recommendations | `https://www.ev.church/visit` | Primary map cards were St Paul's Auckland, LIFE Central, Elim Christian Centre City, Auckland Baptist Tabernacle, and Shore Community Church |
| ChatGPT, temporary chat, default Medium model | AKL-02 | 4/10 | Ev North was the strongest recommendation and the answer highlighted published check-in, pick-up, and leader-safety practices | `https://aucklandev.co.nz/` | Materially stale: it gave Albany Tennis Park, 321 Oteha Valley Road as the meeting place. The retired domain redirects to the canonical homepage, but the answer used legacy indexed content |
| ChatGPT, temporary chat, default Medium model | AKL-05 | 10/10 | Unichurch was the first recommendation | `https://www.ev.church/campus/unichurch` | Correct Old Government House address, Sunday 5:15 pm time, student focus, and newcomer fit |
| ChatGPT, temporary chat, default Medium model | AKL-08 | 0/10 | Ev was absent | None | Belong, Mt Roskill Baptist, and Elim City were the primary recommendations because their pages stated parking, clothing, service duration, and Sunday flow more explicitly |

The remaining eight prompts and the other providers are pending. Current prerequisite evidence is:

- OpenAI's search, training, and user-request crawlers receive the same complete homepage as an ordinary visitor.
- The public site provides direct answers for all benchmark intents except detailed accessibility and public-transport logistics.
- Generic web searches did not consistently surface Ev for broad family-friendly and university-student discovery, while branded and exact service-time queries did.
- `new.ev.church` still appeared in a current search result while the live hostname returned Railway's fallback 404. The hostname was reattached to the production Railway website service on 15 August and now returns a direct permanent redirect to the matching `www.ev.church` path.
- ChatGPT can still retrieve legacy Ev North facts from the retired `aucklandev.co.nz` identity even though that hostname now redirects to `https://www.ev.church/`. Redirect health alone has not removed the stale indexed content.

## Google Business Profile baseline

All three profiles are verified and grouped under the managed Auckland Ev Church account. Public details were checked directly in Google Maps on 16 August 2026.

| Profile | Address | Sunday hours | Website | Phone | Reviews | Finding |
|---|---|---|---|---|---|---|
| Auckland Ev Church - Central | 80 Olsen Avenue, Hillsborough, Auckland 1042 | Opens 10:15 am | `https://www.ev.church/campus/central` | 09 393 0060 | 4.9 from 52 | Campus URL is current |
| Auckland Ev Church - North | 9-11 Rothwell Avenue, Rosedale, Auckland 0632 | Opens 10:15 am | `https://www.ev.church/campus/north` | 09 393 0060 | 5.0 from 16 | Campus URL is current |
| Auckland Ev Church - Unichurch | Old Government House, 24 Princes Street, Auckland CBD 1010 | Opens 5:15 pm | `https://www.ev.church/campus/unichurch` | 09 393 0060 | 5.0 from 9 | Campus URL is current; removal of the incorrect Sir Owen G Glenn Building relationship was submitted and acknowledged on 15 August, but is not yet live |

Do not rename profiles solely for SEO. Confirm the current real-world signage and Google naming policy before changing the established `Auckland Ev Church - ...` names.

## External listing correction queue

| Priority | Source | Current issue | Correction |
|---|---|---|---|
| High | Google Business Profile: Unichurch | Incorrect `Located in: Sir Owen G Glenn Building` relationship | Submitted to Google on 15 August; recheck after review |
| Completed | Google Business Profiles | All three website buttons previously pointed to the homepage | Google accepted the canonical campus URLs for Central, North, and Unichurch by 16 August |
| Medium | Mapcarta / OpenStreetMap | Former Edendale School / 419 Sandringham Road location, sourced from OpenStreetMap node 6569127979 | Source-level removal request filed as [OpenStreetMap note 5457440](https://www.openstreetmap.org/note/5457440); recheck Mapcarta after the node is corrected |
| Medium | 10 Day Challenge church directory | Former Edendale and Oteha Valley Road venues | Replace with the current Central, North, and Unichurch details |
| Low | GracesList | Current Central address and phone, but obsolete `aucklandev.co.nz` URL | Replace with `https://www.ev.church/campus/central` |
| Low | FindMyChurch NZ | Current North address but no service time | Add Sunday 10:15 am and the canonical North campus URL |

## Content opportunities

Create only content that documents real, current ministry. Do not create suburb doorway pages or generic weekly posts.

1. **Campus visit logistics:** add verified campus-specific parking instructions, public-transport guidance, accessibility details, drop-off information, and arrival photos to the existing campus or Visit pages. This directly improves AKL-02, AKL-03, and AKL-08.
2. **Ministry evidence:** enrich the existing Kids, Youth, Connect Groups, and Unichurch pages with current rhythms, age or life-stage fit, named points of contact where appropriate, and a small number of authentic stories or recent examples. This improves confident matching without inventing new ministry categories.
3. **Faith-exploration continuity:** keep Explaining Christianity dates and outcomes current, and publish occasional durable answers to genuine questions asked by participants. Prefer one substantive resource over routine promotional recaps.

Before publishing, confirm each operational fact with the responsible ministry owner. Remove or update time-sensitive content when it ceases to be true.
