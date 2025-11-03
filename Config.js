/**
 * NextUp v6.1 - Multi-Brand Configuration
 * Supports: ABC, CBC, CBL, and individual CBL team pages (PR Penguins example)
 * 
 * Updated: Nov 3, 2025
 * - Migrated to GitHub-hosted assets
 * - Added multi-brand support
 * - Team-specific branding for CBL franchises
 * - SECURE: Uses Script Properties for GitHub token
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
      primary: '#1a1a1a',
      secondary: '#f4f4f4',
      accent: '#ff6b35',
      text: '#333333',
      background: '#ffffff'
    },
    
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
    
    useCases: ['leagues', 'tournaments', 'events', 'partnerships']
  },
  
  // ========================================
  // CHICAGO BOCCE CLUB (CBC)
  // ========================================
  'CBC': {
    name: 'Chicago Bocce Club',
    slug: 'cbc',
    tagline: 'Modern Social Club for Chicago Professionals',
    description: 'Exclusive environment with exceptional touches',
    
    website: 'https://www.chicagobocceclub.com/',
    instagram: '@chicagobocceclub',
    
    logo: 'https://bereasonable13.github.io/zeventbook/assets/logos/ChicagoBocceClub.webp',
    colors: {
      primary: '#2c3e50',
      secondary: '#c9a961',
      accent: '#8b0000',
      text: '#333333',
      background: '#f8f9fa'
    },
    
    features: {
      eventOnly: true,
      tournament: true,
      season: false,
      seasonTournament: false,
      registration: true,
      checkIn: true,
      analytics: true,
      qrCodes: true,
      memberOnly: true
    },
    
    useCases: ['member-events', 'leagues', 'tournaments', 'private-parties', 'corporate-events']
  },
  
  // ========================================
  // CHICAGO BOCCE LEAGUE (CBL)
  // ========================================
  'CBL': {
    name: 'Chicago Bocce League',
    slug: 'cbl',
    tagline: 'The Next Big Thing in Bocce',
    description: "North America's first fully broadcasted semi-pro bocce league",
    
    website: 'https://www.chicagobocceleague.com/',
    instagram: '@chicagobocceleague',
    broadcastNetwork: 'Bocce Broadcast Network',
    
    logo: 'https://bereasonable13.github.io/zeventbook/assets/logos/ChicagoBocceLeague.webp',
    colors: {
      primary: '#0d1b2a',
      secondary: '#e0e1dd',
      accent: '#d62828',
      text: '#1b263b',
      background: '#ffffff'
    },
    
    features: {
      eventOnly: true,
      tournament: true,
      season: true,
      seasonTournament: true,
      registration: false,
      checkIn: false,
      analytics: true,
      qrCodes: true,
      liveStats: true,
      playerProfiles: true,
      teamPages: true
    },
    
    format: '3-person no-walk',
    teams: 6,
    players: 36,
    venue: 'Chicago Bocce Club',
    broadcast: 'BBN - 6 camera setup',
    
    useCases: ['broadcasts', 'team-pr', 'player-highlights', 'stats', 'playoffs']
  }
};

// ============================================================
// GITHUB CONFIGURATION (SECURE)
// ============================================================

const GITHUB = {
  ENABLED: true,
  USERNAME: 'bereasonable13',
  REPO: 'zeventbook',
  // TOKEN loaded from Script Properties (secure)
  get TOKEN() {
    return PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN') || '';
  },
  BRANCH: 'dev',
  EVENTS_PATH: 'events',
  ASSETS_PATH: 'assets',
  BASE_URL: 'https://bereasonable13.github.io/zeventbook'
};

// ============================================================
// DEFAULT BRAND (Fallback)
// ============================================================

const DEFAULT_BRAND = 'ABC';

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getBrand(slug) {
  const brandKey = Object.keys(BRANDS).find(
    key => BRANDS[key].slug === slug.toLowerCase()
  );
  return BRANDS[brandKey] || BRANDS[DEFAULT_BRAND];
}

function getAllBrands() {
  return BRANDS;
}

function isFeatureEnabled(brandSlug, feature) {
  const brand = getBrand(brandSlug);
  return brand.features && brand.features[feature] === true;
}

function getAssetUrl(filename) {
  return `${GITHUB.BASE_URL}/${GITHUB.ASSETS_PATH}/${filename}`;
}

function getEventUrl(eventId) {
  return `${GITHUB.BASE_URL}/${GITHUB.EVENTS_PATH}/event_${eventId}.json`;
}
