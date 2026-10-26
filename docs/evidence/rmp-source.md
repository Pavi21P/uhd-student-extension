# RMP source decision — 02B

Reviewed 2026-10-25. **Decision: retain explicit profile-link fallback; no permitted live retrieval source established. G2 remains blocked.** This completes the independent source-decision slice, not live ratings or portal-specific identity verification.

## Evidence and decision

The current [RMP terms, section 6](https://www.ratemyprofessors.com/terms-of-use) restrict scripted access/scraping without prior permission. No permission or licensed feed has been supplied to this project. Targeted searches of the official domain for developer/API access did not establish a documented, authorized ratings API. This is a limited research finding, not a claim that no private or partner API exists.

An API keyword in a search result was checked and referred to a course label, not developer documentation. No ratings/reviews were copied into the repository, no undocumented data endpoint was queried, and no retrieval adapter or host permission was added.

| Option | Current decision | Reason / missing evidence |
| --- | --- | --- |
| Explicit user navigation to a validated profile | Retain existing 10A/11A fallback | Opens a page for the user; the extension does not read ratings. URL format does not verify identity or UHD membership. |
| Official API or licensed feed | Reconsider when documented access is supplied | Need endpoint documentation, permitted use/redisplay, scope, credentials handling, limits and identity fields. |
| Written permission for a specified retrieval method | Reconsider when received | Need an explicit method/scope and response/cache rules; no permission request has been sent. |
| Undocumented endpoints or third-party scraping wrappers | Not selected | Technical reachability is not the agreed evidence of permitted data access. No such implementation was tested. |
| User-entered scores or synthetic fixtures | Not a live ratings source | They must stay personal notes or labeled test data and never populate verified-source ratings. |

## Contract and cache boundary

The existing RatingSnapshot contract requires provider, verified school/profile IDs, nullable overall rating and review count, source URL, fetched time, expiry and provenance. A permitted source must demonstrate these fields or supply a documented mapping. Nullable values are unavailable, not zero; multiple school/name matches require explicit review.

No live response schema, verified UHD school identifier, provider TTL, rate limit or invalidation contract is established. **Current live cache limit: zero records; current automatic retrieval: none.** Do not invent a refresh interval or present synthetic timestamps as provider freshness. Any future 10B adapter must validate identity, provenance and data at its boundary and keep ambiguous/missing/unavailable states explicit.

## What would unblock 10B/G2

1. An official API agreement, licensed feed or written permission covering the proposed retrieval and display method.
2. Source documentation for school/profile identity, ratings/counts, null/error semantics, request limits, caching/expiry and deletion/update handling.
3. A permitted test response that verifies UHD identity and maps cleanly to the existing contract; synthetic examples alone do not meet this condition.
4. Evidence-based matching and portal integration after the separate 01B/11B work.

The terms list support@ratemyprofessors.com as a contact for questions. The project owner can ask about authorized API/partner access, the intended UHD student extension, fields needed, redistribution/display, request volume and cache limits. This is preparation only; no email or other message was sent. Do not put access credentials or private correspondence into the public repository. [Source: RMP terms](https://www.ratemyprofessors.com/terms-of-use).

The [timer research](timing-report.md) is independent of this source decision. Neither preliminary timers nor links complete live RMP or enrollment.
## 10B fallback implementation

The authenticated professor.lookup command now validates input and returns unavailable/provider-unconfigured without network or cache access. Manual profile links retain their existing unverified/session-only behavior. [10B evidence](10b-provider-fallback.md) records boundary tests and built Chrome/Edge checks. This implements only the plan's explicit fallback branch; live retrieval and G2 remain blocked.
