/**
 * NextUp v6.1 - Multi-Brand Configuration
 * Supports: ABC, CBC, CBL, and individual CBL team pages (PR Penguins example)
 * 
 * Updated: Nov 2, 2025
 * - Migrated to GitHub-hosted assets
 * - Added multi-brand support
 * - Team-specific branding for CBL franchises
 */

// ============================================================
// BRAND CONFIGURATION
// ============================================================

const BRANDS = {
  
  // ========================================
  // AMERICAN BOCCE CO (ABC)
  // Primary Organization - Leagues & Tournaments
  // ========================================
  'ABC': {
    name: 'American Bocce Co.',
    slug: 'abc',
    tagline: 'Play More Bocce',
    description: 'Growing participation of bocce anywhere and everywhere',
    
    // URLs
    website: 'https://www.americanbocceco.com/',
    instagram: '@americanbocceco',
    
    // Branding
    logo: 'https://bereasonable13.github.io/zeventbook/assets/logos/ABCMainTransparent.webp',
    colors: {
      primary: '#1a1a1a',      // Black
      secondary: '#f4f4f4',    // Off-white
      accent: '#ff6b35',       // Orange-red (based on ABC branding)
      text: '#333333',
      background: '#ffffff'
    },
    
    // Features enabled for ABC
    features: {
      eventOnly: true,
      tournament: true,
      season: true,
      seasonTournament: true,
      registration: true,
      checkIn: true,
      analytics: true,
      qrCodes: true
    },
    
    // Use cases
    useCases: ['leagues', 'tournaments', 'events', 'partnerships']
  },
  
  // ========================================
  // CHICAGO BOCCE CLUB (CBC)
  // Private Social Club - Rich Event Opportunities
  // ========================================
  'CBC': {
    name: 'Chicago Bocce Club',
    slug: 'cbc',
    tagline: 'Modern Social Club for Chicago Professionals',
    description: 'Exclusive environment with exceptional touches',
    
    // URLs
    website: 'https://www.chicagobocceclub.com/',
    instagram: '@chicagobocceclub',
    
    // Branding (elegant, upscale)
    logo: 'https://bereasonable13.github.io/zeventbook/assets/logos/ChicagoBocceClub.webp',
    colors: {
      primary: '#2c3e50',      // Dark blue-grey (sophisticated)
      secondary: '#c9a961',    // Gold (premium)
      accent: '#8b0000',       // Deep red (elegant)
      text: '#333333',
      background: '#f8f9fa'
    },
    
    // Features enabled for CBC
    features: {
      eventOnly: true,
      tournament: true,
      season: false,           // Focus on events, not seasons
      seasonTournament: false,
      registration: true,
      checkIn: true,
      analytics: true,
      qrCodes: true,
      memberOnly: true         // Private club feature
    },
    
    // Use cases
    useCases: ['member-events', 'leagues', 'tournaments', 'private-parties', 'corporate-events']
  },
  
  // ========================================
  // CHICAGO BOCCE LEAGUE (CBL)
  // Semi-Pro League - Team PR & Stats
  // ========================================
  'CBL': {
    name: 'Chicago Bocce League',
    slug: 'cbl',
    tagline: 'The Next Big Thing in Bocce',
    description: "North America's first fully broadcasted semi-pro bocce league",
    
    // URLs
    website: 'https://www.chicagobocceleague.com/',
    instagram: '@chicagobocceleague',
    broadcastNetwork: 'Bocce Broadcast Network',
    
    // Branding (sports league aesthetic)
    logo: 'https://bereasonable13.github.io/zeventbook/assets/logos/ChicagoBocceLeague.webp',
    colors: {
      primary: '#0d1b2a',      // Navy (professional sports)
      secondary: '#e0e1dd',    // Light grey
      accent: '#d62828',       // Bold red (energy)
      text: '#1b263b',
      background: '#ffffff'
    },
    
    // Features enabled for CBL
    features: {
      eventOnly: true,         // Match broadcasts
      tournament: true,        // Playoffs
      season: true,            // Regular season
      seasonTournament: true,  // Full integration
      registration: false,     // Roster managed separately
      checkIn: false,          // Not needed for broadcast
      analytics: true,         // Stats dashboard
      qrCodes: true,
      liveStats: true,         // Rolling stats
      playerProfiles: true,    // Player pages
      teamPages: true          // Individual team branding
    },
    
    // League structure
    format: '3-person no-walk',
    teams: 6,
    players: 36,
    venue: 'Chicago Bocce Club',
    broadcast: 'BBN - 6 camera setup',
    
    // Use cases
    useCases: ['broadcasts', 'team-pr', 'player-highlights', 'stats', 'playoffs']
  },
  
  // ========================================
  // CBL TEAM: PR PENGUINS
  // Individual Team Branding Example
  // ========================================
  'PR_PENGUINS': {
    name: 'PR Penguins',
    slug: 'pr-penguins',
    tagline: 'Chicago Bocce League Franchise',
    description: 'Founding franchise of the Chicago Bocce League',
    
    // Parent organization
    league: 'CBL',
    
    // URLs
    instagram: '@pr_penguins',
    website: 'https://www.chicagobocceleague.com/teams/pr-penguins', // Future team page
    
    // Team Branding (Penguins-inspired: black, gold, white)
    logo: 'https://bereasonable13.github.io/zeventbook/assets/logos/ParkRidgePenguins.webp',
    colors: {
      primary: '#000000',      // Black
      secondary: '#fcb714',    // Gold
      accent: '#ffffff',       // White
      text: '#333333',
      background: '#f4f4f4'
    },
    
    // Features enabled for team pages
    features: {
      eventOnly: true,         // Match pages
      tournament: false,       // Team doesn't run tournaments
      season: false,           // Season managed by CBL
      seasonTournament: false,
      registration: false,
      checkIn: false,
      analytics: true,         // Team stats
      qrCodes: true,
      liveStats: true,
      playerProfiles: true,    // Roster profiles
      teamPages: true
    },
    
    // Team info
    owner: 'TBD',
    franchiseFoundation: 'TBD', // Star player
    venue: 'Chicago Bocce Club',
    
    // Use cases
    useCases: ['team-pr', 'player-highlights', 'match-pages', 'fan-engagement']
  }
  
  // ========================================
  // ADD MORE CBL TEAMS HERE
  // Template for other 5 founding franchises
  // ========================================
  // 'TEAM_SLUG': {
  //   name: 'Team Name',
  //   slug: 'team-slug',
  //   league: 'CBL',
  //   colors: { ... },
  //   features: { ... }
  // }
};

// ============================================================
// GITHUB CONFIGURATION
// ============================================================

const GITHUB = {
  ENABLED: true,
  USERNAME: 'bereasonable13',
  REPO: 'zeventbook',
  TOKEN: 'YOUR_GITHUB_TOKEN_HERE',  // Replace with your actual token
  BRANCH: 'dev',
  EVENTS_PATH: 'events',
  ASSETS_PATH: 'assets',
  
  // GitHub Pages base URL
  BASE_URL: 'https://bereasonable13.github.io/zeventbook'
};

// ============================================================
// DEFAULT BRAND (Fallback)
// ============================================================

const DEFAULT_BRAND = 'ABC';

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get brand configuration by slug
 */
function getBrand(slug) {
  const brandKey = Object.keys(BRANDS).find(
    key => BRANDS[key].slug === slug.toLowerCase()
  );
  return BRANDS[brandKey] || BRANDS[DEFAULT_BRAND];
}

/**
 * Get all brands
 */
function getAllBrands() {
  return BRANDS;
}

/**
 * Check if feature is enabled for brand
 */
function isFeatureEnabled(brandSlug, feature) {
  const brand = getBrand(brandSlug);
  return brand.features && brand.features[feature] === true;
}

/**
 * Get GitHub asset URL
 */
function getAssetUrl(filename) {
  return `${GITHUB.BASE_URL}/${GITHUB.ASSETS_PATH}/${filename}`;
}

/**
 * Get event JSON URL
 */
function getEventUrl(eventId) {
  return `${GITHUB.BASE_URL}/${GITHUB.EVENTS_PATH}/event_${eventId}.json`;
}

// ============================================================
// EXPORT FOR APPS SCRIPT
// ============================================================

// Apps Script doesn't have module exports, but these functions
// are available globally when this file is included