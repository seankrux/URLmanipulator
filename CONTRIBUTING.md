# Contributing

Thank you for improving this project. Please follow these basics to keep changes smooth and reviewable.

## Quick Start
- Serve locally: `make serve` (or `python3 -m http.server 5173`) and open `http://localhost:5173` (or `make open`).
- Edit files in place: `index.html`, `app.js`, `style.css`. No build step, no backend.
- Validate flows manually: Bulk Import → URL preview → Table edit → Copy/Export/Import → Template presets → View toggle.

## Commits & PRs
- Use Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`.
- Open a PR using the template; include before/after screenshots for UI changes and steps to verify.
- Keep diffs minimal and scoped. Avoid unrelated reformatting.

## Style & Safety
- JS: ES2015+, 2-space indent, semicolons, camelCase; constants in UPPER_SNAKE_CASE.
- DOM safety: set user data via `textContent`/`value` (avoid `innerHTML`).
- LocalStorage: preserve `STORAGE_KEY` schema and defaults.
- Secrets: do not add API keys in browser code. Restrict the Maps key to referrers.

## Tests
- Current testing is manual. If you add unit tests, use Jest + jsdom; name tests `*.test.js` under `__tests__/` or `tests/` and add an `npm test` script.

## Playbooks
- See AGENTS.md for role-specific checklists (Code Review, Debugging, UI/UX, Maps/GBP, Security, CSV import, QA, Release).

