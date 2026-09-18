# BKK Risk API — NestJS In-Memory Mock

Implementation of the uploaded **BKK Data Base API v0.2.0** contract without a database.

## Requirements

- Node.js 20+ (LTS). Verified on Node 24 LTS — recommended.
- npm (bundled with Node.js).
- No database or external service is required to run the server. All data lives in memory.
- **Internet access is only needed for**:
  - `GET /api/risk-points/ranking` — fetches the live heat-map XLSX from BMA Open Data on every request.
  - Startup — the app tries to load the 100 risk points from a Google My Maps KML. Without internet it falls back to 100 seeded mock points and still serves everything except ranking.
- (Optional) `pdftotext` (poppler, also shipped with MiKTeX) — only needed to regenerate `src/data/risk-point-pdf-details.ts` via `scripts/extract-pdf-solutions.js`, not for running the app.

## Install

```bash
npm install
npm install xlsx @types/xlsx
npm install axios
```

`xlsx`, `@types/xlsx`, and `axios` are already declared in `package.json` dependencies, so a plain `npm install` installs everything. The extra commands are optional but harmless if you prefer to install them explicitly.

## Environment

The app **does not read `.env` files**. It reads `process.env` directly and falls back to defaults:

| Variable           | Default            | Description                                   |
| ------------------ | ------------------ | --------------------------------------------- |
| `PORT`             | `3000`             | HTTP port.                                     |
| `ADMIN_MOCK_TOKEN` | `mock-admin-token` | Bearer token required by the mock admin guard. |

Example (PowerShell):

```powershell
$env:PORT = "3000"
$env:ADMIN_MOCK_TOKEN = "mock-admin-token"
```

The defaults already match the examples below, so you can also run with no env vars at all.

## Run

```bash
npm run start:dev
```

Swagger:

- http://localhost:3000/swagger
- OpenAPI JSON: http://localhost:3000/swagger-json

## Endpoints

```text
GET   /api/risk-points
GET   /api/risk-points/ranking
GET   /api/risk-points/:riskPointId
GET   /api/remediations
GET   /api/bottlenecks

POST  /api/admin/imports
POST  /api/admin/ranking/rebuild
PATCH /api/admin/remediations/:remediationId
```

## Mock admin token

```text
Authorization: Bearer mock-admin-token
```

## Important business rules

1. `/api/bottlenecks`: `lat` and `lng` must be sent together.
2. Remediation `isDelayed` is computed by the service and is not accepted from clients.
3. `/api/remediations?delayed=true` returns only delayed, unfinished work.
4. `/api/bottlenecks` can filter by `district`, `congestionLevel`, and optional radius around `lat/lng`.
5. `GET /api/risk-points/ranking` fetches the live heat-map XLSX (`-heat-map-9-11-65.xlsx`) from BMA Open Data on every request. `district` filters by district; `limit` is 1–100 and defaults to 10. `POST /api/admin/ranking/rebuild` re-fetches the same feed — there is no stored/precomputed ranking in this mock.
6. Risk point statistics are derived deterministically from `clusterRank` (`deriveRiskStatistics` in `src/common/risk-statistics.ts`):
   - `accidents = max(58, 420 - 3 * (rank - 1))`
   - `fatalities = max(1, 12 - floor((rank - 1) / 12))`
   - `injuries = max(40, 390 - 3 * (rank - 1))`
   - `riskLevel`: CRITICAL when `accidents >= 300`, HIGH when `>= 220`, MEDIUM when `>= 130`, else LOW.
7. At startup the app tries to load the 100 risk points from a Google My Maps KML; if it fails, it falls back to 100 seeded mock points. Either way, `causes`/`solutions` are attached per rank from the PDF-derived data in `src/data/risk-point-pdf-details.ts` (ranks 1–100).

## Testing & Build

```bash
npm run build      # nest build -> dist/
npm test           # jest unit tests (2 suites)
npm run test:e2e   # e2e config present; no e2e specs written yet
npm run lint
npm run format
```

## cURL examples

### Risk points

```bash
curl.exe "http://localhost:3000/api/risk-points"
curl.exe "http://localhost:3000/api/risk-points?district=จตุจักร&riskLevel=CRITICAL"
curl.exe "http://localhost:3000/api/risk-points/RP-001"
```

### Ranking

```bash
curl.exe "http://localhost:3000/api/risk-points/ranking"
curl.exe "http://localhost:3000/api/risk-points/ranking?district=จตุจักร&limit=5"
```

### Remediation

```bash
curl.exe "http://localhost:3000/api/remediations"
curl.exe "http://localhost:3000/api/remediations?district=จตุจักร"
curl.exe "http://localhost:3000/api/remediations?status=IN_PROGRESS&delayed=true"
```

### Bottlenecks

```bash
curl.exe "http://localhost:3000/api/bottlenecks"
curl.exe "http://localhost:3000/api/bottlenecks?district=จตุจักร&congestionLevel=BLOCKED"
curl.exe "http://localhost:3000/api/bottlenecks?lat=13.7563&lng=100.5018&radiusKm=5"
```

Invalid pair test:

```bash
curl.exe "http://localhost:3000/api/bottlenecks?lat=13.7563"
```

### Admin

```bash
curl.exe -X POST "http://localhost:3000/api/admin/imports" ^
  -H "Authorization: Bearer mock-admin-token" ^
  -H "Content-Type: application/json" ^
  -d "{\"source\":\"THAIRSC\",\"datasetUrl\":\"https://data.bangkok.go.th/dataset/100-risk-map\",\"note\":\"รอบข้อมูลประจำเดือนสิงหาคม 2569\"}"
```

```bash
curl.exe -X POST "http://localhost:3000/api/admin/ranking/rebuild" ^
  -H "Authorization: Bearer mock-admin-token"
```

```bash
curl.exe -X PATCH "http://localhost:3000/api/admin/remediations/RM-001" ^
  -H "Authorization: Bearer mock-admin-token" ^
  -H "Content-Type: application/json" ^
  -d "{\"status\":\"COMPLETED\",\"completedAt\":\"2026-08-05\",\"note\":\"ติดตั้งอุปกรณ์แล้วเสร็จ\"}"
```

Unauthorized test:

```bash
curl.exe -X POST "http://localhost:3000/api/admin/ranking/rebuild"
```
