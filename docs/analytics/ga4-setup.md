# GA4 Setup and Operations

This document is the source of truth for GA4 on `venturecrane.com`.

## What Is Already Implemented in Code

- Loader component: `src/components/Analytics.astro`
- Runtime init + event tracking: `public/js/ga4-init.js`
- Wired globally in page layout: `src/layouts/Base.astro`
- Tracked events from forms:
  - `newsletter_signup` from `public/js/subscribe.js`
  - `contact_submit` from `public/js/contact.js`
- External link tracking:
  - `outbound_click` from `public/js/ga4-init.js`

## Environment Variables

Set these in your hosting environment for production and preview:

- `PUBLIC_GA4_MEASUREMENT_ID`
  - Example: `G-XXXXXXXXXX`
  - Required to enable GA4 script loading.
- `PUBLIC_GA4_INTERNAL_HOST_PATTERNS`
  - Comma-separated hostname patterns tagged as internal traffic.
  - Default in code: `localhost,127.0.0.1,*.pages.dev`
  - Recommended production value:
    - `localhost,127.0.0.1,*.pages.dev,staging.venturecrane.com`

Notes:

- If `PUBLIC_GA4_MEASUREMENT_ID` is missing, GA4 does not load.
- Internal host matching supports exact hosts and wildcard suffixes like `*.pages.dev`.

## GA4 Property Configuration

Code alone is not enough. You must configure GA4 data filters to exclude internal traffic.

1. Open GA4 Admin for the Venture Crane property.
2. Go to `Data streams` -> select web stream for `venturecrane.com`.
3. Confirm Measurement ID matches `PUBLIC_GA4_MEASUREMENT_ID`.
4. Go to `Admin` -> `Data settings` -> `Data filters`.
5. Ensure there is an `Internal traffic` filter using traffic parameter:
   - Parameter: `traffic_type`
   - Value: `internal`
6. Set filter mode:
   - `Testing` first (recommended for 3-7 days)
   - `Active` after validation

## Internal Traffic Controls for Team Devices

Two ways internal tagging is applied:

1. Hostname match from `PUBLIC_GA4_INTERNAL_HOST_PATTERNS`
2. Browser override via query param and local storage

Browser override commands:

- Enable internal tag in current browser profile:
  - `https://venturecrane.com/?internal=1`
- Remove internal tag in current browser profile:
  - `https://venturecrane.com/?internal=0`

Use `?internal=1` once per browser profile on each team device used for testing.

## QA Checklist

Before considering setup complete:

1. `PUBLIC_GA4_MEASUREMENT_ID` is set in production.
2. `PUBLIC_GA4_INTERNAL_HOST_PATTERNS` is set and includes preview hosts.
3. GA4 stream receives `page_view` events.
4. Custom events appear in Realtime:
   - `outbound_click`
   - `newsletter_signup`
   - `contact_submit`
5. Internal traffic is visible in `Testing` filter mode.
6. Internal filter is switched to `Active` after validation window.

## Weekly Reporting Workflow

Use `docs/analytics/weekly-kpi-report-template.md`.

Data pull process:

1. GA4, date range = previous Monday to Sunday.
2. Apply host filter to production host only (`venturecrane.com`) for page-level KPIs.
3. Fill KPI snapshot and acquisition mix from GA4.
4. Cross-check total page trend with Cloudflare Web Analytics as a sanity check.
5. Record any filter anomalies in the `Internal Traffic QA` section.
