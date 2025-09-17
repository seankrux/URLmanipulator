# URLmanipulator

Lightweight, client-only tool to generate Google Search URLs using brand keywords and Google Business Profile CIDs. No backend, no build step.

## Quick Start
- Serve locally: `make serve` then open `http://localhost:5173` (or run `make open`).
- Edit files directly: `index.html`, `app.js`, `style.css`.

## Contributing
- Read CONTRIBUTING.md for workflow and commit/PR guidance.
- See AGENTS.md for role-specific checklists (Code Review, Debugging, UI/UX, Maps/GBP, Security, CSV, QA, Release).
 - PR template checklist: see .github/pull_request_template.md

## Testing (optional)
- Browser smoke tests: open `tests/manual.html` and verify checkmarks.
- Jest: install dev deps then run tests
  - `npm i -D jest @jest-environment/jsdom`
  - `npm test`

## Notes
- Data stays in your browser via `localStorage`.
- Google Maps API usage requires restricting your key to allowed referrers.
