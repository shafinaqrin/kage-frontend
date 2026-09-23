# Kage initial intraday Bursa dashboard plan

## Goal

Create the first working vertical slice of Kage inside `kage-frontend/`: a Google Pixel-inspired Material 3 trading dashboard for intraday Bursa Malaysia monitoring, using hardcoded market data initially and a backend connection boundary for Moomoo OpenD. The implementation should be structured for iterative Agile delivery rather than being a one-off static mockup.

## Current repository state

- `kage-frontend/` contains only the design skill metadata; no app scaffold exists.
- `kage-backend/` is empty.
- The supplied references show a responsive dashboard with a collapsible navigation rail/sidebar, top app bar, summary cards, market charts, a transaction/watchlist-style list, calendar/modal behavior, light/dark themes, and a distinctive circular/soft Material motion treatment.
- The references use a green finance palette, but the implementation should apply the same visual language to Bursa intraday data rather than copying the finance-app branding or exact assets.

## Recommended architecture

### Frontend (`kage-frontend/`)

1. Scaffold a TypeScript React app with Vite.
2. Use Tailwind CSS plus a small local Material 3 token/component layer instead of mixing multiple UI systems. Define light and dark color roles, typography, shape, elevation, density, and motion tokens in one place.
3. Add a charting dependency suitable for lightweight candlestick/line/volume visualizations; keep chart wrappers isolated so the library can be replaced later.
4. Use a feature-oriented structure:
   - `app/`: shell, routing, theme provider, API client setup
   - `components/ui/`: M3 buttons, cards, navigation rail, tabs, dialogs, chips, menus, loading/error states
   - `features/market-overview/`: dashboard composition and KPI cards
   - `features/quotes/`: quote table/watchlist and quote detail presentation
   - `features/chart/`: intraday chart and timeframe controls
   - `data/`: typed hardcoded fixtures and API DTO mapping
   - `lib/`: formatting, date/timezone, theme, motion, and API helpers
5. Make the first route a dashboard, with a responsive navigation rail that becomes a compact bottom/overlay navigation pattern on narrow screens.

### Backend (`kage-backend/`)

1. Scaffold a small TypeScript service (Fastify or equivalent) as the only server-side boundary to Moomoo OpenD.
2. Add a `MoomooOpenDClient` adapter with typed methods for connection health, quote snapshots, and candlestick/intraday history. Keep the adapter behind an application service so future brokers/providers can be added without changing UI code.
3. Read OpenD host/port, market, account, and credential-related values from environment variables only; never put secrets in the frontend or fixtures.
4. Expose a minimal frontend-safe API:
   - `GET /api/health`
   - `GET /api/market/overview`
   - `GET /api/market/quotes?symbols=...`
   - `GET /api/market/candles?symbol=...&interval=...`
5. Include a mock/provider mode so the dashboard remains usable when OpenD is not running. The UI should clearly distinguish demo data from live data and show connection state.
6. Add CORS, request validation, timeouts, reconnect/error handling, and rate-conscious polling. Do not attempt trading/order placement in this first slice.

## Docker and networking plan

### Container layout

- Add a multi-stage `kage-frontend/Dockerfile` that installs dependencies, builds the Vite app, and serves the production bundle through an unprivileged Nginx container.
- Add a multi-stage `kage-backend/Dockerfile` that installs dependencies, compiles the TypeScript service, and runs it as a non-root Node.js process.
- Add `docker-compose.yml` at the repository root to run `frontend` and `backend` together with health checks, environment files, restart behavior, and development-friendly named volumes only where appropriate.
- Add `.dockerignore` files for both services so node modules, build output, local secrets, and editor files are not copied into images.

### Shared and external network

- Define a named Docker network, for example `kage-network`, as an **external network** in Compose:
  ```yaml
  networks:
    kage-network:
      external: true
      name: ${KAGE_DOCKER_NETWORK:-kage-network}
  ```
- Document the one-time setup command `docker network create kage-network` before `docker compose up --build`. The Compose project must not silently create a differently named network.
- Attach both `frontend` and `backend` services to this same external network. The backend is reachable from other containers at the stable hostname `backend` and its internal port, not through a container IP.
- Keep Moomoo OpenD on the same external network when it is containerized. If OpenD runs on the host, configure `OPEND_HOST=host.docker.internal` (with the platform-specific host-gateway mapping where required) rather than exposing credentials or OpenD directly to the browser.

### Frontend-to-backend connection

- Browser code must not call `http://backend:<port>` because Docker service DNS is unavailable to users' browsers. The frontend should call a same-origin `/api` path.
- Configure Nginx in the frontend container as a reverse proxy for `/api/*` to `http://backend:<internal-port>`. This lets the browser reach the backend through the frontend's published origin while the containers communicate over `kage-network`.
- Set the backend's CORS policy to the configured frontend origin as a defense-in-depth measure, while relying on the Nginx same-origin proxy for normal browser traffic.
- Use environment substitution at container startup or a documented build-time API base setting; do not bake a localhost-only URL into the production bundle.
- Add Docker health checks: backend checks `/api/health`; frontend checks its HTTP root. Configure `depends_on` with backend health gating, while retaining frontend disconnected/error states for runtime outages.

### Ports and security

- Publish only the frontend port to the host by default (for example `8080:80`); keep the backend internal to the Docker network unless local API debugging explicitly needs a host mapping.
- Never publish Moomoo OpenD to the host or public network as part of this initial setup.
- Use `.env.example` for non-secret defaults such as ports, network name, API mode, OpenD host, and polling interval. Keep real `.env` files ignored and out of version control.
- Run both application containers as non-root users where the base image allows it, use minimal production images, and add graceful shutdown handling.

## First-slice product scope

### Dashboard

- App bar with page title, market session/date context, connection status, theme toggle, and profile/settings affordance.
- Responsive navigation rail/sidebar with Dashboard, Watchlist, Charts, Positions/Orders (disabled or placeholder), and Settings.
- Hero/market-session card showing Bursa session status, latest composite/index snapshot, and a clear live/demo indicator.
- KPI cards for index value/change, active watchlist movers, portfolio/position placeholder, and market breadth.
- Main intraday chart panel with hardcoded KLSE/Bursa sample candles or line data, volume, timeframe chips, and selected-symbol state.
- Watchlist/quote table with symbol, company name, last price, absolute change, percentage change, volume, and positive/negative states.
- Top movers or market breadth panel using typed fixture data.
- Empty, loading, disconnected, and OpenD error states from the beginning so later API wiring does not require a visual rewrite.

### Themes and Material behavior

- Light and dark themes using semantic Material 3 roles rather than hardcoded component colors.
- Respect system preference initially, persist an explicit user choice, and avoid flash-of-wrong-theme on reload.
- Implement Material-style state layers for hover, focus, pressed, selected, and disabled states.
- Use spring-like/custom easing for navigation rail expansion, dialog transitions, card press feedback, theme changes, and chart/timeframe selection; animate transforms/opacity rather than layout properties.
- Add accessible keyboard focus, reduced-motion handling, semantic landmarks, table labels, and adequate contrast in both themes.
- Use the provided high-end visual skill where it does not conflict with Material 3: preserve generous spacing, nested surfaces, and refined motion, while keeping M3 affordances recognizable.

## Data and OpenD integration strategy

1. Define shared domain types for symbols, quote snapshots, candles, market sessions, and connection status.
2. Add deterministic hardcoded Bursa fixtures for development and visual validation.
3. Implement frontend repository hooks against the backend API, with mock mode as the default until OpenD connectivity is configured.
4. Implement the backend OpenD adapter using the actual supported OpenD protocol/client package after confirming the local OpenD interface and required permissions. Keep protocol-specific shapes confined to the adapter.
5. Normalize timestamps to Bursa time (`Asia/Kuala_Lumpur`) and format currency/decimal values consistently.
6. Add polling only for quote snapshots in the first iteration; candle history can load on symbol/timeframe changes. Document that data availability depends on the Moomoo account, market permissions, and OpenD session.

## Validation and delivery increments

### Increment 1 — foundation

- Scaffold frontend/backend, shared types, theme tokens, app shell, responsive navigation, Dockerfiles, Compose configuration, and the external network setup.
- Verify production builds locally and inside both containers, health checks, frontend-to-backend proxying, lint/typecheck, keyboard navigation, and both themes.

### Increment 2 — demo dashboard

- Add fixtures, KPI cards, watchlist, chart panel, responsive states, and Material motion.
- Validate against the supplied screenshots at desktop/tablet/mobile widths and with reduced motion enabled.
- Validate both direct local development mode and the production Docker Compose path.

### Increment 3 — OpenD read-only connection

- Add environment configuration, health state, adapter, normalized API endpoints, polling, and graceful fallback.
- Verify OpenD unavailable, available, malformed responses, connection interruption, and backend access to OpenD over the shared network.

### Increment 4 — hardening for Agile follow-up

- Add component/formatter tests and API adapter tests.
- Add concise local setup/config documentation without committing credentials.
- Leave extension points for real positions, orders, alerts, news, and additional Bursa instruments.

## Decisions and assumptions

- This first pass is read-only; no buy/sell, account mutation, or order placement is included.
- OpenD runs locally or on a trusted backend-reachable host; browser-to-OpenD direct connections are avoided.
- Hardcoded data is a fallback/demo mode, not a claim of live market data.
- The frontend and backend share a pre-created external Docker network named `kage-network`; frontend browser requests use the Nginx `/api` reverse proxy rather than Docker DNS.
- Existing repository conventions are absent, so scaffold and dependency choices will be introduced cleanly within the two existing folders.
- The screenshots are interaction and layout references, not a request to reproduce their logo, copy, or exact assets.

## Definition of done

- `kage-frontend/` runs locally and presents a responsive Bursa intraday dashboard.
- Light/dark theme switching, persistence, keyboard focus, and reduced-motion behavior work.
- Dashboard uses typed deterministic fixtures and visibly labels demo/live connection state.
- Backend exposes validated read-only market endpoints and a health endpoint.
- OpenD adapter configuration is environment-based, isolated, and fails gracefully when unavailable.
- Frontend can consume backend responses without changing dashboard components when fixtures are replaced by live data.
- Frontend and backend build as production Docker images.
- `docker network create kage-network && docker compose up --build` starts the stack, with both containers attached to the same external network.
- Browser requests to `/api/*` are proxied from frontend to backend successfully without exposing backend or OpenD ports by default.
- Lint, typecheck, tests (where introduced), and production builds pass.
