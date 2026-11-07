# Pitchline

A TypeScript and React application built with Vite, with supporting scripts for local development and project maintenance.

## Stack

- React, TypeScript, and Vite
- TanStack Router / Start
- Tailwind CSS
- Node.js scripts and tests

## Requirements

- Node.js 22 or newer
- npm

## Install and run

```bash
npm ci
npm run dev
```

## Checks and tests

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run check
```

Run `npm run check` before submitting changes. To format files, run `npm run format`.

## Build

```bash
npm run build
```

## Environment variables

Use `.env.example` as the reference for required variables. Keep real credentials in local environment configuration or the deployment secrets manager; do not commit secrets.

## Project layout

- `src/routes/` — application routes
- `src/lib/` — shared application and domain logic
- `scripts/` — development and maintenance scripts
