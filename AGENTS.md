# Repository Guidelines

## Project Structure & Module Organization
- `index.html` — single-page UI entry; includes `app.js` and basic markup.
- `app.js` — all client-side logic: state, formula engine, CSV helpers, URL generation, UI rendering, localStorage.
- `style.css` — layout and component styles.
- No bundler or backend; static assets only. If you add images, place them under `assets/` (create if needed).

## Build, Test, and Development Commands
- Run locally (no build step): `python3 -m http.server 5173` then open `http://localhost:5173`.
- Alternative (Node installed): `npx http-server -p 5173`.
- Lint/format: none configured. If you add tooling, include `package.json` scripts (e.g., `lint`, `format`) and keep them optional.

## Coding Style & Naming Conventions
- JavaScript: ES2015+, 2-space indent, keep semicolons. Prefer single quotes; match surrounding code.
- Naming: `camelCase` for variables/functions, `UPPER_SNAKE_CASE` for simple config constants (e.g., `STORAGE_KEY`).
- Files: lowercase, no spaces (e.g., `app.js`, `style.css`).
- DOM safety: assign user data via `textContent`/`value` (avoid `innerHTML`).
- Keep it dependency-free and modular: small, pure helpers (e.g., CSV, formula, URL parts) over large functions.

## Testing Guidelines
- Current: manual testing in a modern browser.
  - Verify flows: Bulk Import, URL preview, table edit, Copy All, CSV export/import, template presets, view toggle.
- If adding unit tests, use Jest + jsdom; name tests `*.test.js` under `__tests__/` or `tests/`. Add `npm test` script.
- Aim for coverage on utilities (`CSV`, `evaluateFormula`, `plusify`, URL composition).

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:` (e.g., `feat(ui): show URL count`).
- PRs: concise description, linked issue, before/after screenshots for UI changes, repro steps, and scope-limited diffs. Note any new IDs or public function changes.

## Security & Configuration Tips
- API keys: Restrict the Google Maps key to allowed referrers. Do not commit secrets; if rotating keys, document changes and consider moving configuration to a separate module.
- URL building: use safe encoding (`encodeURIComponent`) where applicable; preserve intended `+` behavior for spaces.
- Data storage: only non-sensitive data in `localStorage` (`STORAGE_KEY`).

## Agent-Specific Instructions
- Do not rename DOM IDs or public functions used by event bindings.
- Prefer minimal diffs, no unrelated reformatting, and keep the app framework-free.
- When adding features, preserve existing defaults and localStorage structure for backward compatibility.

## Specialized Agent Playbooks
- Code Review Agent
  - Focus on diffs: correctness, regressions in `app.js`, accessibility changes in `index.html`, and CSS side effects.
  - Checklist: state mutations isolated, no XSS (`textContent` over `innerHTML`), functions small/pure, names clear, no dead code.
  - Label feedback: Blocker / Major / Nit. Include one-line rationale and suggested patch.
- Debugging / Error Detective
  - Reproduce with a local server; watch Console for uncaught errors and failed selectors/IDs.
  - Triage: isolate feature, add temporary `console.debug` and `debugger` near `evaluateFormula`, CSV parse/stringify, and event bindings.
  - Fix minimally; add guards (`?.`, null checks) and keep logs behind TODO comments for removal.
- JavaScript Expert
  - Keep helpers pure (CSV, formula, URL parts). Avoid global leakage; prefer small modules within `app.js` sections.
  - Optimize hot paths (table render, computeRow) and avoid unnecessary DOM writes; batch updates where possible.
  - Preserve `localStorage` schema and default state; add migration only if necessary.
- UI Expert
  - Maintain semantic HTML, keyboard focus, visible focus states, and color contrast. Use existing classes and patterns.
  - Test responsive behavior (320–1440px), avoid layout shifts, and keep button/label text specific.
  - Screenshots for UI PRs: before/after plus hover/focus states.
- Google Business Profile & Maps Expert
  - Use Places API with restricted key (HTTP referrers); prefer `place_id`→`getDetails({ fields: ['url','name','place_id'] })` then extract `cid` from the Maps URL.
  - Respect quotas and backoff; batch lookups, cache results in-memory, and fail softly when status ≠ OK.
  - Validate CIDs (`^\d{10,20}$`), document any new fields, and avoid relying on unstable search params when an official field exists.
  
  Example — get CID from place_id
  ```js
  async function getCIDFromPlaceId(placeId) {
    const service = new google.maps.places.PlacesService(document.createElement('div'));
    const details = await getPlaceDetails(service, placeId); // uses existing helper in app.js
    const cid = extractCIDFromUrl(details?.url || '');       // uses existing helper in app.js
    return cid && /^\d{10,20}$/.test(cid) ? cid : '';
  }
  ```
- URL Encoding/Decoding Expert
  - Use `encodeURIComponent` for values; avoid encoding full URLs. For search-like `+` behavior use `URLSearchParams` or deliberate `string.replace(/\s+/g,'+')` and never both.
  - Prevent double-encoding; decode with `decodeURIComponent` once. Treat `+` as space only for form-encoded contexts.
  - Add guards for malformed inputs; unit-test edge cases: spaces, `&`, `=`, `%`, Unicode.
  
  Examples — building the Google search URL
  ```js
  // A) Standards-compliant encoding (spaces become %20)
  function buildUrlStd(brand, original, cidLoc, cidGmb) {
    const url = new URL('https://www.google.com/search');
    url.search = new URLSearchParams({
      q: String(brand || '').toLowerCase().trim(),
      oq: String(original || '').trim(),
      rldimm: String(cidLoc || ''),
      rlst: 'f'
    }).toString();
    url.hash = `rlfi=hd:;si=${encodeURIComponent(String(cidGmb || ''))}`;
    return url.toString();
  }

  // B) Deliberate plus-style spaces for q/oq (matches current UI)
  function plusify(s) { return String(s || '').trim().replace(/\s+/g, '+'); }
  function buildUrlPlus(brand, original, cidLoc, cidGmb) {
    return `https://www.google.com/search?q=${plusify(brand).toLowerCase()}` +
           `&oq=${plusify(original)}` +
           `&rldimm=${encodeURIComponent(String(cidLoc || ''))}` +
           `&rlst=f#rlfi=hd:;si=${encodeURIComponent(String(cidGmb || ''))}`;
  }
  ```

## PlePer MCP Integration
- Setup
  - Raycast → Settings → Developer → Model Context Protocol → Import server, then use your JSON:
    - `command: node`, `args: ["~/.config/raycast/mcp-servers/pleper-mcp-server/", "dist/index.js"]`
    - Set `PLEPER_API_KEY` and `PLEPER_API_SIGNATURE` in env (keep secret; do not expose in browser code).
- Usage
  - In Raycast, run the PlePer MCP tools to fetch business details by Google Maps URL or `place_id`.
  - Copy the JSON result (includes fields like `name`, `place_id`, `cid`, `url`, `categories`, `website`).
- Mapping into this app
  - `Brand` ← `name`
  - `GMBCID` ← `cid` (aka GMB CID)
  - `OriginalSearch` ← your seed keyword (manual or inferred)
  - `LocationCID` ← choose from your location library (this is the search location rldimm; PlePer may not supply it)
- Parser example
  ```js
  // Map one PlePer record to an app row
  function mapPlePerRecord(rec) {
    return {
      OriginalSearch: '', // set manually or infer
      Brand: rec?.name || '',
      LocationCID: '',   // choose from library (rldimm)
      GMBCID: rec?.cid || rec?.canonical_cid || ''
    };
  }

  // Map an array of records and append to state
  function importPlePerJson(jsonText) {
    const data = JSON.parse(jsonText);
    const records = Array.isArray(data) ? data : [data];
    const rows = records.map(mapPlePerRecord);
    populateFromImport(rows.map(r => r.OriginalSearch), rows[0]?.Brand, rows[0]?.LocationCID, rows[0]?.GMBCID, '', 'append');
  }
  ```
  - Keep API calls out of the browser; use Raycast MCP or a server-side proxy if you need live lookups.
