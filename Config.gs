/**
 * NextUp v6.1 - Configuration
 */

const CONFIG = {
  VERSION: '6.1.0',
  BUILD_DATE: '2025-11-06',
  APP_NAME: 'NextUp Event Manager',
  DEFAULT_BRAND: 'ABC',
  EVENTS_SHEET_NAME: 'Events',
  
  BRANDS: {
    'ABC': {
      name: 'American Bocce Co.',
      slug: 'abc',
      tagline: 'Play More Bocce',
      description: 'Growing participation of bocce anywhere and everywhere',
      website: 'https://www.americanbocceco.com/',
      instagram: '@americanbocceco',
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
        registration: true,
        checkIn: true,
        analytics: true,
        qrCodes: true
      },
      entities: [
        { id: 'ABC-Leagues', name: 'ABC Leagues', description: 'Recreational and competitive bocce leagues' },
        { id: 'ABC-Tournaments', name: 'ABC Tournaments', description: 'Tournament series and special events' },
        { id: 'ABC-ChicagoBocceClub', name: 'Chicago Bocce Club', description: 'CBC partnership events' },
        { id: 'ABC-ChicagoBocceLeague', name: 'Chicago Bocce League', description: 'CBL partnership events' },
        { id: 'ABC-Other', name: 'Other', description: 'Other ABC-affiliated events' }
      ]
    },
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
        registration: true,
        checkIn: true,
        analytics: true,
        qrCodes: true,
        memberOnly: true
      },
      entities: [
        { id: 'CBC-Events', name: 'CBC Events', description: 'Chicago Bocce Club events' }
      ]
    },
    'CBL': {
      name: 'Chicago Bocce League',
      slug: 'cbl',
      tagline: 'The Next Big Thing in Bocce',
      description: "North America's first fully broadcasted semi-pro bocce league",
      website: 'https://www.chicagobocceleague.com/',
      instagram: '@chicagobocceleague',
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
        analytics: true,
        qrCodes: true,
        liveStats: true,
        playerProfiles: true
      },
      entities: [
        { id: 'CBL-Events', name: 'CBL Events', description: 'Chicago Bocce League events' }
      ]
    }
  },
  
  DOMAIN_TO_BRAND: {
    'abc.zeventbooks.io': 'ABC',
    'abc.zeventbook.io': 'ABC',
    'events.zeventbooks.io': 'ABC',
    'zeventbooks.io': 'ABC',
    'zeventbook.io': 'ABC',
    'cbc.zeventbooks.io': 'CBC',
    'cbc.zeventbook.io': 'CBC',
    'cbl.zeventbooks.io': 'CBL',
    'cbl.zeventbook.io': 'CBL'
  },
  
  GITHUB: {
    ENABLED: true,
    USERNAME: 'bereasonable13',
    REPO: 'zeventbook',
    get TOKEN() {
      return PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN') || '';
    },
    BRANCH: 'dev',
    EVENTS_PATH: 'events',
    ASSETS_PATH: 'assets',
    BASE_URL: 'https://bereasonable13.github.io/zeventbook'
  }
};
