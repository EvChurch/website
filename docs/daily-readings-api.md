# Public daily Bible readings API

These read-only JSON endpoints need no login or API key. Browser requests from
other origins are supported. Only published readings are returned.

| Endpoint | Response |
| --- | --- |
| `GET /api/daily-readings/latest` | `{ "reading": { ... } }` with the most recently sent published reading |
| `GET /api/daily-readings?limit=20` | `{ "readings": [ ... ] }` with recent summaries, newest sent first |
| `GET /api/daily-readings/{id}` | `{ "reading": { ... } }` with a complete reading |

The list limit defaults to 20 and accepts integers from 1 to 100. Use the `id`
from a summary to fetch its complete reading. IDs are stable source identifiers,
not sequential dates. Latest means latest available; a reading may not be sent
every calendar day.

```sh
curl https://ev.church/api/daily-readings/latest
```

```js
const response = await fetch('https://ev.church/api/daily-readings/latest')
if (!response.ok) throw new Error(`Reading request failed: ${response.status}`)
const { reading } = await response.json()
console.log(reading.passageReference, reading.passageVerses)
```

Summaries contain `id` (number), `title`, `date`, `publishedAt`,
`openingScripture`, `passageReference`, `questions` (string array), and
`prayerPrompts` (string array). Dates are ISO 8601 timestamps; display reading
dates in `Pacific/Auckland` to match the website.

Complete readings also contain `passageVerses` (an ordered array of verse objects),
`bibleVersionAbbreviation`, `bibleVersionTitle`, `bibleCopyright` (nullable
strings), and `apiBibleFumsTokens` (string array). Preserve the supplied Bible
version and copyright notice when displaying Scripture. As the website does,
load `https://pkg.api.bible/fumsV3.min.js` and queue each supplied token once when
the Scripture is displayed:

```js
window.fumsData ??= []
window.fums ??= (command, value) => window.fumsData.push([command, value])
reading.apiBibleFumsTokens.forEach(token => window.fums('trackView', token))
```

Verse numbers are separate from the plain text:

```json
{
  "passageVerses": [
    { "number": 11, "text": "First verse text." },
    { "number": 12, "text": "Second verse text." }
  ]
}
```

`number` is a number, or `null` for source text without a verse marker. Empty
passages return an empty array. Verses stay in source order, including repeated
numbers across chapters; chapter and book identifiers are not stored per verse.
The API replaces the former `passageText` string with `passageVerses`.

The API uses the website's reading cache, refreshed by reading sync and at least
hourly on subsequent requests. HTTP responses use `Cache-Control: no-store` so
clients do not retain another stale copy. Polling once an hour is sufficient.

Errors use `{ "error": "..." }`: `400` for invalid limits or IDs, `404` when an
individual or latest reading is unavailable, and `503` for temporary service
failure. An empty archive returns `200` with `{ "readings": [] }`.
