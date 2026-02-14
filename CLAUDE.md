# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Local Development
- **Serve locally**: `make serve` or `python3 -m http.server 5173`
- **Open in browser**: `make open` or navigate to `http://localhost:5173`
- **Alternative Node.js server**: `npx http-server -p 5173` (if Node.js is available)

### Testing
- **Run Jest tests**: `npm test` (requires dev dependencies: `npm i -D jest @jest-environment/jsdom`)
- **Watch mode**: `npm test:watch`
- **Smoke tests**: `npm run smoke` (lightweight Node.js-based functionality tests)
- **Manual testing**: Open `tests/manual.html` in browser for UI flow verification

### Chrome Extension Development
- Open `chrome://extensions`, enable Developer Mode, click "Load unpacked"
- Select project root directory to load the extension
- Pin extension for quick access and test popup functionality

## Architecture Overview

### Core Structure
This is a **static single-page application** with no build process or backend dependencies. The architecture follows a **state-first pattern** with vanilla JavaScript:

- **`app.js`**: Main application controller containing all client-side logic, state management, formula engine, CSV helpers, URL generation, UI rendering, and localStorage persistence
- **`index.html`**: Single-page UI entry point with semantic HTML5 structure and accessibility features
- **`style.css`**: Component styles and responsive layout
- **Dual deployment**: Same codebase functions as both web app and Chrome extension via `manifest.json`

### State Management Pattern
```javascript
// Centralized state object
const state = {
  columns: [...],  // Column definitions
  rows: [...],     // Data rows
  template: {...}  // URL template configuration
};

// State-first rendering pattern
function renderAll() {
  renderTable();
  renderUrlList();
  renderTemplateUI();
  renderPreview();
}
```

### Key Modules and Features
- **CSV Engine**: Custom parser/stringifier for bulk data import/export
- **Formula Engine**: Dynamic URL template evaluation with variable substitution
- **Google Places API Integration**: CID lookup with secure key storage in `chrome.storage.sync`
- **URL Generation**: Google Search URL builder with location targeting
- **Performance Modules**: Optional advanced features in `optimized-*.js` files for web workers, reactive state management, and async patterns

### Storage Strategy
- **localStorage**: Primary persistence using `STORAGE_KEY = 'cid-generator-v1'` with schema versioning
- **Chrome Storage**: API keys stored in `chrome.storage.sync` for extension mode
- **Fallback patterns**: Graceful degradation when storage APIs unavailable

## Development Guidelines

### Code Style (from CONTRIBUTING.md)
- **JavaScript**: ES2015+, 2-space indentation, semicolons, single quotes
- **Naming**: `camelCase` for variables/functions, `UPPER_SNAKE_CASE` for constants
- **DOM Safety**: Use `textContent`/`value` for user data (never `innerHTML`)
- **Dependencies**: Keep dependency-free; prefer small, pure helper functions

### Security Practices
- **API Keys**: Never commit keys to repository; restrict Google Maps keys to allowed referrers
- **User Data**: Sanitize all user input; use safe DOM assignment methods
- **localStorage**: Store only non-sensitive data; preserve schema compatibility

### Testing Strategy
- **Manual flows**: Bulk Import → URL preview → Table edit → Copy/Export → Template presets → View toggle
- **Unit tests**: Focus on utilities (`CSV`, `evaluateFormula`, `plusify`, URL composition)
- **Browser compatibility**: Test in Chrome, Firefox, Safari, Edge

### Pull Request Requirements
- Use Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Include before/after screenshots for UI changes
- Provide reproduction steps and testing notes
- Follow checklist in `.github/pull_request_template.md`

## Common Tasks

### Adding New Features
1. Update state structure if needed
2. Add pure helper functions for logic
3. Update relevant render functions
4. Bind event listeners in `bindEvents()`
5. Test manual workflows and add unit tests

### API Integration
- Google Places API key management through UI panel
- Fallback modes when API unavailable
- Rate limiting and error handling patterns

### Performance Optimization
- Leverage existing optimization modules in `optimized-*.js` files
- Avoid full table re-renders; target specific updates
- Use debouncing for frequent operations

### Chrome Extension Updates
- Manifest v3 compliance maintained
- Test both popup and options page modes
- Verify storage permissions and API access