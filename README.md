# URLmanipulator - Local SEO URL Generator

**URLmanipulator** is a professional tool for generating targeted Google Search URLs for local SEO campaigns. It combines Google My Business (GMB) Customer IDs (CIDs) with keywords to create location-specific search URLs that can boost local search visibility and drive targeted traffic.

## What It Does

URLmanipulator generates optimized Google Search URLs by combining:
- **Keywords** (your target search terms)
- **GMB CIDs** (Google My Business Customer IDs)
- **Location CIDs** (Geographic location identifiers)
- **Brand information** (Your business name)

### Example Output
Input: "roofing contractor" + Chicago GMB CID + Location CID
Output: `https://www.google.com/search?q=roofing+contractor&ludocid=8071969139480942171&lsig=AB86z5X...`

## Key Features

### 🎯 **Core URL Generation**
- Bulk keyword processing (unlimited keywords)
- Google My Business CID integration
- Location-specific targeting
- Template-based URL customization
- CSV import/export for workflow integration

### 📊 **Enhanced with APIs** (New!)
- **Keywords Everywhere Integration**: Search volume, CPC, and competition data
- **Google Maps Integration**: Location discovery and nearby business search
- **Related Keyword Discovery**: Expand keyword lists automatically
- **Market Intelligence**: Data-driven keyword selection

### 🏪 **Business Discovery**
- Find nearby competitors
- Discover location-based keywords
- Generate location-specific campaigns
- Radius-based business search (1km-25km)

## Platform Support

### 🌐 **Web Application**
- Serve locally: `make serve` then open `http://localhost:5173`
- No build step or dependencies required
- All processing happens client-side

### 🔌 **Chrome Extension**
- Open `chrome://extensions`, enable Developer Mode, choose **Load unpacked**
- Select the project root directory
- Pin the extension for quick access
- Same functionality in popup and options page

## Quick Start

### Basic Setup
1. **Start the application**: `make serve` then open `http://localhost:5173`
2. **Enter your business details**:
   - GMB Brand Name (e.g., "Chicago Roofing Services Inc")
   - GMB CID (e.g., "8071969139480942171")
   - Location CID (e.g., "12673312613543755776")

3. **Add keywords** (one per line):
   ```
   chicago roofers
   roof repair chicago
   roofing contractors near me
   emergency roof repair
   ```

4. **Generate URLs**: Click "Generate CID URLs" to create targeted search URLs

### Enhanced Workflow with APIs

#### 📊 **Keyword Intelligence**
1. **Enrich your keywords** with market data:
   - Click "📊 Enrich Keywords with Data"
   - Get search volume, CPC, and competition metrics
   - New columns automatically added to your data table

2. **Discover related keywords**:
   - Click "🔍 Find Related Keywords"
   - Automatically expands your keyword list
   - Finds semantic variations and related terms

#### 🗺️ **Location & Business Discovery**
1. **Find nearby businesses**:
   - Enter location/business type (e.g., "restaurants in Chicago")
   - Set search radius (1km-25km)
   - Select business type filter
   - Click "🏪 Find Nearby Businesses"

2. **Generate location-based keywords**:
   - Results automatically added to keyword list
   - Creates location-specific search terms
   - Perfect for competitor analysis

### API Configuration

#### Google Maps API
- **Default key included** and pre-configured
- **Custom key**: Add your own in the "Google Places API" panel
- **Features**: CID lookup, location discovery, nearby search

#### Keywords Everywhere API
- **Default key included** and pre-configured
- **Custom key**: Add your own in the "Keywords Everywhere API" panel
- **Features**: Search volume, CPC data, competition analysis, related keywords

## Advanced Features

### Template Customization
Customize URL generation with template variables:
- `{Keyword}` - The search term
- `{Brand}` - Your business name
- `{LocationCID}` - Geographic location ID
- `{GMBCID}` - Google My Business Customer ID

### Data Management
- **CSV Import/Export**: Bulk data processing
- **Column Management**: Add custom data columns
- **State Persistence**: Data saved in browser storage
- **Chrome Extension Sync**: Data syncs across devices (when using extension)

### Performance Features
- **Bulk Processing**: Handle hundreds of keywords at once
- **Real-time Preview**: See URL generation in real-time
- **Copy All**: One-click copy all generated URLs
- **Export Options**: CSV and TXT export formats

## Use Cases

### 🏢 **Local Business SEO**
- Generate location-specific landing page URLs
- Create targeted Google Ads campaigns
- Track local search performance
- Compete with nearby businesses

### 🏪 **Multi-Location Businesses**
- Scale URL generation across multiple locations
- Standardize local SEO campaigns
- Manage franchise or chain store URLs
- Location-based keyword research

### 🎯 **SEO Agencies**
- Client campaign URL generation
- Competitive analysis and discovery
- Keyword research with market intelligence
- Scalable local SEO workflows

## Technical Details

### Architecture
- **Static Application**: No backend required
- **Client-Side Processing**: All data processing in browser
- **API Integration**: Google Maps + Keywords Everywhere
- **Storage**: localStorage with Chrome extension sync
- **Performance**: Optimized for bulk operations

### File Structure
- `index.html` - Main application interface
- `app.js` - Core application logic (85KB)
- `style.css` - Professional dark theme styling
- `manifest.json` - Chrome extension configuration

## Development & Contributing

### Local Development
- **No build step required** - edit files directly
- **Hot reload**: Refresh browser to see changes
- **Static assets only**: HTML, CSS, JavaScript

### Testing
- **Smoke tests**: `npm run smoke`
- **Manual tests**: Open `tests/manual.html`
- **Browser testing**: Chrome, Firefox, Safari, Edge

### Contributing
- Read CONTRIBUTING.md for workflow and commit/PR guidance
- See AGENTS.md for role-specific checklists
- Follow conventional commits format
- Include before/after screenshots for UI changes

## Security & Privacy

### Data Privacy
- **All data stays in your browser** - no external storage
- **API keys encrypted** in Chrome storage
- **No tracking or analytics** - completely private

### API Security
- **Secure key storage** with fallback options
- **Referrer restrictions** recommended for Google Maps API
- **Rate limiting** built-in for Keywords Everywhere API

---

**URLmanipulator** - Professional local SEO URL generation with advanced keyword intelligence and location discovery.
