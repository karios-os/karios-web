# Karios Web

## About

`karios-web` is the frontend GUI for the Karios platform. It is an Nx
monorepo containing:

- **`apps/karios-gui`** — the main React application (the Karios web UI)
- **`libs/`** — shared feature libraries used by the app, including:
  - `feature-admin`
  - `feature-auth`
  - `feature-datacenter`
  - `feature-navigation`
  - `feature-server`
  - `feature-vm`
  - `shared-state`
  - `shared-ui`

The app talks to the Karios backend services (e.g. `karios-apis`) via a
runtime configuration object (`window.__KARIOS_CONFIG__`) that points it at
the control node, provisioning, updates, and other backend APIs.

## Prerequisites

- Node.js (LTS) and npm

## Setup

```bash
npm install
```

## Running locally

```bash
npm start
```

This runs `nx serve karios-gui` and serves the app locally for development.

## Building for production

```bash
npm run build
```

This runs `nx build karios-gui` and outputs the production build to
`dist/apps/karios-gui`.

## Testing

```bash
# Unit tests
npm test

# Linting
npm run lint

# End-to-end tests (Playwright)
npm run test:e2e
```

For end-to-end tests, copy `.env.playwright-example` to `.env.playwright`
(or `.env.deployment` as referenced by the test scripts) and fill in the
target environment URL and credentials before running `test:e2e` /
`test:ui` / `test:health` style scripts.
