# lis-hubs-back-office

Part of the Livestock Information Service (LIS), which lets livestock keepers, owners, agents and
delegates record and manage their animals.

The back-office hub is the entry point for Defra staff and approved external staff, to manage and
support the lifecycle of an animal, the owner, and keepers. It signs staff in with Microsoft Entra
ID, holds their session, lets them find a holding, and routes requests on to the species
microsites (spokes) that do the actual work.

Deployed on the Core Delivery Platform (CDP). See the
[CDP portal service page](https://portal.cdp-int.defra.cloud/services/lis-hubs-back-office) for
environments, deployments, logs and metrics.

## Architecture

LIS uses a hub and spoke design. A hub owns sign-in and sessions; each spoke is a separate app for
one species and task, mounted under a path on the hub:

```text
browser → back-office hub ─┬─ /cattle           → lis-apps-cattle-home
                           ├─ /cattle/register  → lis-apps-cattle-register
                           ├─ /cattle/move      → lis-apps-cattle-move
                           └─ /cattle/death     → lis-apps-cattle-death
```

- **Authentication:** staff sign in with Microsoft Entra ID (OIDC). The hub keeps a server-side
  session (Redis on CDP) and issues a hub JWT in a cookie, which the spokes verify.
- **Authorisation:** every signed-in request needs the back-office permission (see
  [Sign-in and access](#sign-in-and-access)).
- **Spokes:** the hub proxies each path to its spoke, forwarding only the hub JWT cookie and the
  cookie consent cookie. The list of spokes and their paths comes from
  [lis-hubs-infra-registry](https://github.com/DEFRA/lis-hubs-infra-registry).
- **Downstream calls:** the holdings search reads from `lis-be4fe-cattle-home`, with an AWS STS
  service token and an API key.
- **Shared packages:**
  [lis-hubs-infra-access](https://github.com/DEFRA/lis-hubs-infra-access) (`@defra/lis-hubs-infra-access`: auth, sessions, access decisions),
  [lis-hubs-infra-core](https://github.com/DEFRA/lis-hubs-infra-core) (`@defra/lis-hubs-infra-core`: logging, request context, service clients, proxy),
  [lis-hubs-infra-registry](https://github.com/DEFRA/lis-hubs-infra-registry) (`@defra/lis-hubs-infra-registry`: module list),
  [lis-infra-ui-services](https://github.com/DEFRA/lis-infra-ui-services) (`@defra/lis-infra-ui-services`: layout, error pages, cookies page, maintenance page, session cache, security headers).

See [HUB-ARCHITECTURE.md](https://github.com/DEFRA/lis-dev/blob/main/HUB-ARCHITECTURE.md) for the
hub and spoke design.

### Sign-in and access

The hub is the only place staff sign in. A request for a protected page without a session
redirects to `/auth/login` with the original path as a relative `returnUrl`. The login route
redirects to Microsoft Entra ID (scope `openid email profile`), and after sign-in completes at
`/sso` the hub sends the browser back to that path.

After sign-in, each value in the ID token's `roles` claim is resolved through the role map in
`@defra/lis-hubs-infra-access`. The hub then requires the `lis-perm-back-office` permission
(granted by `lis-role-back-office`, which `lis-role-bcms-user` extends) before it issues a hub JWT,
and checks it again on every signed-in request. A user without it stays signed in to the hub but
gets no hub JWT, so no spoke is reachable; they are sent to `/auth/not-authorised` (a 403 page with
a sign out link) until they sign out.

The OIDC redirect URI is `HUB_ORIGIN` followed by `OIDC_REDIRECT_PATH`. The hub always serves the
callback at `/sso`, so keep `OIDC_REDIRECT_PATH` as `/sso`: changing it alone breaks sign-in. If
`HUB_ORIGIN` changes, update the Entra application registration to match exactly.

The hub's `HUB_JWT_ISSUER` must be in each spoke's `HUB_ORIGINS`. `HUB_JWT_AUDIENCE`,
`HUB_JWT_COOKIE_NAME` and `HUB_JWT_SECRET` must match the spoke's values.

### Routes

| Path                   | Purpose                                                                     |
| ---------------------- | --------------------------------------------------------------------------- |
| `/`                    | Redirects to `/holdings`                                                    |
| `/holdings`            | Find a holding: search by term, 25 results a page, linking to `/cattle/...` |
| `/auth/login`          | Starts sign-in                                                              |
| `/sso`                 | OIDC callback                                                               |
| `/auth/logout`         | Signs the user out                                                          |
| `/signout`             | Redirects to `/auth/logout` (the header link)                               |
| `/auth/not-authorised` | Tells a refused user they are not authorised, with a sign out link          |
| `/cookies`             | Cookies page and consent form                                               |
| `/health`              | Health check                                                                |
| `/cattle/...`          | Proxied to the cattle spokes (see above)                                    |

Static assets are served under `ASSET_PATH` (default `/public`).

## Prerequisites

- Node.js 24 (see `.nvmrc`, use `nvm use`)
- Docker with Docker Compose
- A local clone of [lis-dev](https://github.com/DEFRA/lis-dev) (recommended, see [Running with lis-dev](#running-with-lis-dev-recommended))

## Setup

### Development

```bash
nvm use
npm install
cp .env.example .env
```

`.env` is loaded when running standalone, and also by a sideloaded `npm run dev` for variables that
compose does not set. `HUB_JWT_SECRET`, `SESSION_COOKIE_PASSWORD` and `OIDC_CLIENT_SECRET` have no
default and the service will not start without them. `.env.example` sets local values for all
three, which you can keep for local use (the password must be at least 32 characters).

### Test

There are no tools to install beyond `npm install`. Tests use [Vitest](https://vitest.dev/).

## Running with lis-dev (recommended)

The hub only works properly alongside the spokes, their backend services and a fake identity
provider. [lis-dev](https://github.com/DEFRA/lis-dev) runs all of these locally with Docker
Compose and serves them behind local HTTPS hostnames, so it is the recommended way to run and work
on this repo. Follow its README for the one-time setup.

Start the stack:

```bash
cd lis-dev
docker compose up -d
```

In the stack the hub runs as the `lis-hubs-back-office` service on port 3102, signs in through the
fake identity provider's Entra ID endpoint and uses Redis for sessions. To work on this repo, swap
its container for a local server with hot reload while the rest of the stack stays in Docker:

```bash
.bin/sideload up back-office
.bin/sideload restore    # when done: back to the container
```

Then open <https://back-office.lis.defra> and sign in through the fake identity provider.

## Running standalone

You can also run the server on its own with `npm run dev`, using the values in `.env` (port 3102
in `.env.example`). Without the rest of the stack, sign-in needs an Entra ID (or compatible OIDC)
provider at `OIDC_DISCOVERY_URL`, the holdings search can't reach `lis-be4fe-cattle-home`, and the
spoke paths have nothing to proxy to.

| Script                   | Purpose                                                      |
| ------------------------ | ------------------------------------------------------------ |
| `npm run build:frontend` | Build frontend assets with Vite                              |
| `npm run dev`            | Build frontend assets, then start the server with nodemon    |
| `npm run dev:debug`      | As `dev`, but waits for a debugger to attach                 |
| `npm run dev:debug:ide`  | Start the server with `node --inspect`, for an IDE debugger  |
| `npm start`              | Build frontend assets, then start with `NODE_ENV=production` |

### Container image

The `Dockerfile` builds the frontend assets and prunes dev dependencies in a `build` stage on
`defradigital/node-development`, then copies the result into a `production` stage on
`defradigital/node` (with `curl` added for the CDP health check). The image listens on `PORT`
(8085 unless the build argument or environment says otherwise) and runs `node src`.

### Configuration

Configuration is in `src/config/config.js`. Values marked secret must be set as secrets in the
CDP portal for every deployed environment.

| Variable                                            | Description                                                                                                     | Default                                 |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `ENVIRONMENT`                                       | Environment name: `local`, `docker_compose`, `dev`, `test`, `ext-test`, `perf-test` or `prod`                   | `local`                                 |
| `HOST`                                              | Address to bind                                                                                                 | `0.0.0.0`                               |
| `PORT`                                              | Port to bind                                                                                                    | `8085`                                  |
| `SERVICE_VERSION`                                   | Deployed version, for logs                                                                                      | none                                    |
| `ASSET_PATH`                                        | Base path for static assets                                                                                     | `/public`                               |
| `STATIC_CACHE_TIMEOUT`                              | Static asset cache timeout (ms)                                                                                 | `86400000`                              |
| `HTTP_PROXY`                                        | Outbound HTTP proxy                                                                                             | none                                    |
| `LOG_ENABLED`                                       | Whether logging is on                                                                                           | `true`, except under test               |
| `LOG_LEVEL`                                         | Log level                                                                                                       | `info`                                  |
| `LOG_FORMAT`                                        | `ecs` or `pretty`                                                                                               | `ecs` in production, otherwise `pretty` |
| `LOG_HASH_SECRET`                                   | Secret. Key for hashing sensitive values in logs (e.g. `user_email_hash`)                                       | none                                    |
| `MAINTENANCE_AVAILABLE_FROM`                        | UK local date-time (e.g. `2026-11-19T09:00`) to show the maintenance page until; empty means not in maintenance | empty                                   |
| `HUB_ORIGIN`                                        | Public origin of the hub                                                                                        | `http://localhost:3102`                 |
| `SESSION_CACHE_ENGINE`                              | `memory` or `redis`                                                                                             | `memory`                                |
| `SESSION_CACHE_NAME`                                | Session cache name                                                                                              | `back-office-session`                   |
| `SESSION_CACHE_TTL`                                 | Server-side session TTL (ms, at most 7 days)                                                                    | `14400000`                              |
| `SESSION_COOKIE_TTL`                                | Session cookie TTL (ms, at most 7 days)                                                                         | `14400000`                              |
| `SESSION_COOKIE_PASSWORD`                           | Secret, required. Encrypts the session cookie (at least 32 characters)                                          | none                                    |
| `REDIS_HOST`                                        | Redis host                                                                                                      | `127.0.0.1`                             |
| `REDIS_PORT`                                        | Redis port                                                                                                      | `6379`                                  |
| `REDIS_USERNAME`                                    | Redis username                                                                                                  | empty                                   |
| `REDIS_PASSWORD`                                    | Secret. Redis password                                                                                          | empty                                   |
| `REDIS_KEY_PREFIX`                                  | Redis key prefix                                                                                                | `back-office:`                          |
| `REDIS_TLS`                                         | Connect to Redis over TLS                                                                                       | `false`                                 |
| `USE_SINGLE_INSTANCE_CACHE`                         | Single Redis instance rather than a cluster                                                                     | `true`                                  |
| `AUTH_PRIMARY_PROVIDER`                             | Authentication provider; only `entra` is configured                                                             | `entra`                                 |
| `HUB_JWT_SECRET`                                    | Secret, required. Signs and verifies hub JWTs                                                                   | none                                    |
| `HUB_JWT_ISSUER`                                    | Hub JWT issuer                                                                                                  | `http://localhost:3102`                 |
| `HUB_JWT_AUDIENCE`                                  | Hub JWT audience                                                                                                | `livestock-spokes`                      |
| `HUB_JWT_COOKIE_NAME`                               | Cookie that carries the hub JWT                                                                                 | `livestock_hub_jwt`                     |
| `HUB_JWT_TTL_SECONDS`                               | Hub JWT TTL (seconds)                                                                                           | `14400`                                 |
| `OIDC_DISCOVERY_URL`                                | Microsoft Entra ID OIDC discovery URL                                                                           | none                                    |
| `OIDC_CLIENT_ID`                                    | Entra ID client ID                                                                                              | `back-office-entra-client`              |
| `OIDC_CLIENT_SECRET`                                | Secret, required. Entra ID client secret                                                                        | none                                    |
| `OIDC_REDIRECT_PATH`                                | OIDC callback path                                                                                              | `/sso`                                  |
| `OIDC_SERVICE_ID`                                   | Optional service ID passed to the identity provider                                                             | none                                    |
| `CATTLE_HOME_API_KEY`                               | Secret. API key for `lis-be4fe-cattle-home`, sent as `x-api-key`                                                | empty                                   |
| `CATTLE_HOME_API_TIMEOUT`                           | Total time allowed for a `lis-be4fe-cattle-home` response, headers and body (ms)                                | `5000`                                  |
| `CATTLE_HOME_API_CIRCUIT_BREAKER_FAILURE_THRESHOLD` | Consecutive transport failures before the `lis-be4fe-cattle-home` circuit opens                                 | `5`                                     |
| `CATTLE_HOME_API_CIRCUIT_BREAKER_RESET_TIMEOUT`     | Time the `lis-be4fe-cattle-home` circuit stays open before a probe request (ms)                                 | `30000`                                 |
| `PROXY_TIMEOUT`                                     | Time to wait for a spoke's response headers before answering 504 (ms)                                           | `30000`                                 |
| `PROXY_CIRCUIT_BREAKER_FAILURE_THRESHOLD`           | Consecutive transport failures before a spoke's circuit opens                                                   | `5`                                     |
| `PROXY_CIRCUIT_BREAKER_RESET_TIMEOUT`               | Time a spoke's circuit stays open before a probe request (ms)                                                   | `30000`                                 |

`NODE_ENV` sets production, development and test behaviour (log format and template caching). In
lis-dev, the compose files set `AWS_ENDPOINT_URL_STS` to point at the fake STS.

## Running tests

```bash
npm test                 # unit tests with coverage
npm run test:coverage    # coverage with text and lcov reports (Istanbul)
npm run lint             # ESLint
npm run format:check     # Prettier
```

End-to-end journeys are covered by [lis-journey-tests](https://github.com/DEFRA/lis-journey-tests).

## Monitoring

- Health check: `GET /health`
- Logs: OpenSearch dashboard per environment, linked from the [CDP portal service page](https://portal.cdp-int.defra.cloud/services/lis-hubs-back-office) under Logs
- Metrics: Grafana dashboard per environment, linked from the [CDP portal service page](https://portal.cdp-int.defra.cloud/services/lis-hubs-back-office) under Metrics

## Pipelines

Build, versioning and publishing run in GitHub Actions (`.github/workflows`), using the reusable
workflows in [lis-github-actions](https://github.com/DEFRA/lis-github-actions) and Cake scripts
(`*.cake`):

- **Pull request to `main`**: validate (format, lint, test, container smoke test on port 3102),
  Sonar analysis, version check
- **Push to a `feature/` or `hotfix/` branch**: validate, Sonar analysis, prerelease version and tag
- **Merge to `main`**: validate, Sonar analysis, release tag
- **Tag push (`*.*.*`)**: publish the container image (`publish.yml`)

Versions come from git tags (SemVer).

## Branching policy

The repo uses mainline development. Branch from `main` and name the branch:

- `feature/LREG-<ticket>-<short-kebab-description>`
- `hotfix/LREG-<ticket>-<short-kebab-description>`

`LREG` must be uppercase, because the GitHub ruleset rejects other branch names. Rebase onto `main`
rather than merging `main` in. Incomplete work goes behind a feature flag.

## Contributing to this project

- Follow the [Defra software development standards](https://github.com/DEFRA/software-development-standards).
- `npm run git:pre-commit-hook` runs the security audit, format check, lint and tests; `npm run setup:husky` installs Husky.
- Open a pull request against `main` using the PR template. CI must pass and the Sonar quality gate must be green before merge.
