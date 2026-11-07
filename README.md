# Pitchline

Pitchline is a TypeScript + React football intelligence and betting-analysis app powered by Vite and TanStack Router.

## Quick start on Windows

Double-click `start-app.bat` in the project root. It installs dependencies if needed, starts the Pitchline development server, waits until the app is responding, then opens the football app at `/` in your browser. If port 3000 is already in use, it tries 3001 and 3002 so it does not accidentally open another local project (for example, a construction-management app).

Requirements: Node.js 22 or newer and an internet connection for installing dependencies and loading live football scores.

## Development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000/` for the Pitchline football app. The `/agents`, `/predictions`, `/risk`, `/calibration`, and `/lab` paths are additional analysis pages.

## Useful commands

```bash
npm run build
npm run typecheck
npm test
```

## Troubleshooting

- If you see a different app such as construction management, you are likely visiting another local server on the same port. Use `start-app.bat`, which selects an available port and opens the Pitchline root page.
- If scores do not load, check your internet connection. Live fixtures and tables are fetched from ESPN's public scoreboard service; the local app itself does not provide live data offline.
- Keep `.env` values local and never commit secrets.
