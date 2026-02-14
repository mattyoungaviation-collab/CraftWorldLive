# Craft World Calculator (Render + WalletConnect v2 + Postgres)

This repo is a starter monorepo for a public Craft World calculator:
- WalletConnect v2 login (Ronin)
- Craft World auth flow: nonce → signature → customToken → Firebase idToken → uid
- Fastify API + Postgres profiles
- Next.js web UI

## Quick start (local)

1) Install pnpm
2) Set env vars for API:

```bash
export DATABASE_URL="postgresql://..."
export FIREBASE_API_KEY="AIzaSyDgDDykbRrhbdfWUpm1BUgj4ga7d_-wy_g"
export CW_APP_VERSION="1.6.5"
export CW_GRAPHQL_URL="https://craft-world.gg/graphql"
export JWT_SECRET="dev-secret-change-me"
```

3) From repo root:

```bash
pnpm install
cd apps/api
pnpm prisma:migrate
pnpm dev
```

4) In another terminal:

```bash
cd apps/web
pnpm dev
```

## WalletConnect Project ID
Edit `apps/web/app/page.tsx` and replace `REPLACE_WITH_YOUR_WALLETCONNECT_PROJECT_ID`.

## Next steps
- Load your CSV-backed factory rows into `packages/data` and serve them from the API.
- Replace manual prices with `exchangePriceList` auto-fetch via `/cw/graphql`.
- Implement workshop/mastery/worker multipliers once you define them.


## Craft World stats endpoints
- POST `/cw/account/workshop` { idToken }
- POST `/cw/account/mastery` { idToken } (placeholder until schema confirmed)

# Deployment (Render)

This repo is a Render-ready monorepo:
- `apps/api` Fastify API (port 10000)
- `apps/web` Next.js web UI
- One Render Postgres database

## 1) Create WalletConnect project
Create a WalletConnect v2 project and copy your Project ID.

Set in Render Web service env:
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` = your project id

## 2) Render services
If you use `render.yaml`:
- Connect your GitHub repo in Render
- Choose “Blueprint” deploy (Render reads `render.yaml`)
- It will create:
  - Postgres
  - API service
  - Web service

## 3) Required environment variables

### API service
- `CW_GRAPHQL_URL` = `https://craft-world.gg/graphql`
- `CW_APP_VERSION` = `1.6.5`
- `JWT_SECRET` = random long string
- `DATABASE_URL` = provided automatically by Render when linked to Postgres

### Web service
- `NEXT_PUBLIC_API_BASE_URL` = your API service URL (e.g. `https://<api>.onrender.com`)
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` = your WC Project ID

## 4) Run locally
From repo root:

```bash
pnpm i
pnpm -r build
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:10000/health

## 5) Using the app
1. Go to **Login** and connect wallet (WCv2) and sign message
2. Calculator page:
   - keep **Auto Pull** checked to auto-fetch Workshop + Proficiencies (mastery) and apply
   - uncheck to manually enter workshop% and mastery level


## Auth persistence note (Render cross-origin)

Root cause found: auth relied on in-memory React state during navigation and mixed token/cookie handling, so subsequent route loads could render as logged out before auth was restored. The API also used permissive CORS instead of explicit credentialed origins.

Fix implemented:
- API now allows credentialed CORS only for `WEB_ORIGIN` (comma-separated origins) and enables `trustProxy` for Render HTTPS.
- API sets an HTTP-only session cookie on `/auth/login` and supports `/auth/me` + `/auth/logout`.
- Web now uses a shared API helper that always sends `credentials: "include"` and restores auth state using `/auth/me`.
- Backward compatibility kept: bearer token in `Authorization` still works.

Why this is required: with different web/api origins, browsers only send cookies when all three are configured together: `SameSite=None; Secure` on cookie, `credentials: "include"` on fetch, and `Access-Control-Allow-Credentials: true` with explicit CORS origins.

### Additional API env vars
- `WEB_ORIGIN` = web origin(s), comma-separated (e.g. `https://<web>.onrender.com`)
- `NODE_ENV` = `production`

### Quick verification (cookie + auth)
```bash
# 1) Login in browser and inspect Set-Cookie on /auth/login
# 2) Validate auth session (replace cookie value):
curl -i https://<api>.onrender.com/auth/me \
  -H 'Origin: https://<web>.onrender.com' \
  -H 'Cookie: cw_session=<session_cookie>'

# 3) CORS preflight should allow credentials for web origin
curl -i -X OPTIONS https://<api>.onrender.com/auth/me \
  -H 'Origin: https://<web>.onrender.com' \
  -H 'Access-Control-Request-Method: GET'
```
