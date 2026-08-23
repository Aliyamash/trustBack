# Trustence Backend API

Independent Node.js API for `https://api.trust-ence.com`, covering website forms, projects, team members, image uploads, and first-party traffic analytics. It uses Node's built-in SQLite driver, stores uploaded images in `uploads/`, and protects management endpoints with `x-admin-api-key`. Analytics derives an approximate country from the request IP and device/browser/OS details from the user-agent; raw IP addresses are not stored.

## Requirements

- Node.js 24 or newer
- pnpm 11

## Setup

1. Copy `.env.example` to `.env` and replace `ADMIN_API_KEY`.
2. Run `pnpm install --frozen-lockfile`.
3. Run `pnpm dev`.

The first start seeds the existing team and portfolio content from the bundled `seed-assets/` directory when the corresponding tables are empty and copies their images into `uploads/`. Use `pnpm seed` to run the same idempotent check manually.

Public endpoints are under `/api`. Upload an image with `POST /api/admin/uploads` as multipart form data using the `image` field, then pass the returned path when creating a project or team member.

Management requests must include `x-admin-api-key`. Uploaded files are served from `/uploads/<filename>`.

## Endpoints

- `POST /api/project-request/` — save a website form submission
- `POST /api/analytics/visit` — record an anonymous page view and browser session
- `GET /api/projects` and `GET /api/projects/:id` — published projects
- `GET /api/last-projects/:limit` — latest published projects
- `GET /api/our-team` — published team members
- `POST /api/admin/uploads` — upload one image using multipart field `image`
- `GET /api/admin/stats` — dashboard totals, traffic analytics, top pages/referrers, seven-day activity, and recent messages
- `GET /api/admin/projects` and `GET /api/admin/team` — complete management lists
- `POST|PUT|DELETE /api/admin/projects[/:id]` — manage projects
- `POST|PUT|DELETE /api/admin/team[/:id]` — manage team members
- `GET /api/admin/submissions` — list form submissions
- `PATCH /api/admin/submissions/:id` — set status to `new`, `contacted`, or `closed`

Images are limited to JPEG, PNG, WebP, or GIF and the configured maximum size. Management endpoints require the `x-admin-api-key` header.

Set `TRUST_PROXY=1` when exactly one trusted reverse proxy sits in front of the API. Leave it `0` for direct local access. An incorrect trust-proxy setting can allow clients to spoof their apparent IP. Cloudflare/Vercel country headers are only accepted when proxy trust is enabled.

GeoIP lookup uses the locally installed `geoip-lite` data and does not send visitor IPs to an external API. This product includes GeoLite2 data created by [MaxMind](https://www.maxmind.com/). Country detection is approximate and can be affected by VPNs or proxies.

## Production

Use `ecosystem.config.cjs` with PM2 and `deploy/nginx-api.conf.example` with Nginx. Keep `data/`, `uploads/`, and `.env` persistent and outside public access. The production frontend origins are shown in `.env.example`.
