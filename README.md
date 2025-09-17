# URLmanipulator

## Chrome Extension Setup
- Open `chrome://extensions`, enable Developer Mode, and choose **Load unpacked**.
- Select the project root; Chrome will register the toolbar popup and options page.
- Pin the extension for quick access and open the popup to run the generator inside Chrome.

## Google Places API Key
- The popup now includes a **Google Places API** panel so you can store your own key.
- Keys are saved to `chrome.storage.sync` (with a localStorage fallback) and never hard-coded.
- Without a key, CID lookup helpers stay disabled; bulk URL generation still works offline.

## Local Development
- Serve the site directly for wide-layout testing: `python3 -m http.server 5173` and open `http://localhost:5173/index.html`.
- All assets remain static; no build step or dependencies are required.
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
