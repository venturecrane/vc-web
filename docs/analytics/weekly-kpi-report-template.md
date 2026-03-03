# Weekly KPI Report Template

Use this format for weekly reporting on `venturecrane.com`.

## Report Metadata

- Week start (Monday): `YYYY-MM-DD`
- Week end (Sunday): `YYYY-MM-DD`
- Prepared on: `YYYY-MM-DD`
- Data source: `Google Analytics 4` + `Cloudflare Web Analytics`
- Internal filter status: `Enabled` / `Disabled`

## KPI Snapshot

| KPI                                          | This Week | Last Week | WoW % |
| -------------------------------------------- | --------: | --------: | ----: |
| Users (GA4)                                  |           |           |       |
| Sessions (GA4)                               |           |           |       |
| Engaged sessions (GA4)                       |           |           |       |
| Engagement rate (GA4)                        |           |           |       |
| Avg engagement time per session (GA4)        |           |           |       |
| Page views - production host only (GA4)      |           |           |       |
| Newsletter signups (GA4 `newsletter_signup`) |           |           |       |
| Contact submissions (GA4 `contact_submit`)   |           |           |       |
| Outbound clicks (GA4 `outbound_click`)       |           |           |       |

## GA4 Pull Configuration

Use these settings each week to keep reporting consistent:

- Date range: previous Monday through Sunday
- Comparison: previous period
- Internal traffic filter: must be `Active` in GA4 Data Filters
- Hostname filter for page metrics: `Host name` exactly matches `venturecrane.com`

Core report pulls:

- Traffic acquisition:
  - Dimension: `Session default channel group`
  - Metrics: `Sessions`
- Engagement overview:
  - Metrics: `Users`, `Sessions`, `Engaged sessions`, `Engagement rate`, `Average engagement time per session`, `Views`
- Pages and screens:
  - Dimension: `Page path and screen class`
  - Metrics: `Views`, `Average engagement time per session`, `Entrances`
- Events:
  - Dimension: `Event name`
  - Metrics: `Event count`
  - Filter event names: `newsletter_signup`, `contact_submit`, `outbound_click`

## Acquisition Mix

| Channel group  | Sessions | Share |
| -------------- | -------: | ----: |
| Organic Search |          |       |
| Direct         |          |       |
| Referral       |          |       |
| Social         |          |       |
| Other          |          |       |

## Top Content

| Page path | Views | Avg engagement time | Entrances |
| --------- | ----: | ------------------: | --------: |
|           |       |                     |           |
|           |       |                     |           |
|           |       |                     |           |
|           |       |                     |           |
|           |       |                     |           |

## Conversion Detail

### Newsletter

- Signups: ``
- Top pages driving signups: ``

### Contact

- Submissions: ``
- Top pages driving submissions: ``

### Outbound Clicks

- Total outbound clicks: ``
- Top outbound domains: ``

## Internal Traffic QA

- Internal browser flag applied on dev devices (`?internal=1` once per browser): `Yes` / `No`
- Any suspicious internal patterns in this week: `Yes` / `No`
- Notes: ``

## Actions for Next Week

1. `Action`
2. `Action`
3. `Action`
