/**
 * Test Configuration for Multi-Brand Deployments
 * Maps each brand to its deployment URL and expected features
 */

const TEST_CONFIG = {
  brands: {
    ABC: {
      // Deployment info
      deploymentUrl: 'https://script.google.com/macros/s/AKfycby6SGKitRi8UsxXSdNOCcVgi7swVItEAGTVQpZjdeMfjRdS59aArWbTBBsotrs0T19DG/exec',
      brandSlug: 'abc',
      
      // Feature flags (what to test)
      features: {
        eventOnly: true,
        tournament: true,
        season: true,
        analytics: true,
        qrCodes: true,
      },
      
      // Test data
      testEvent: {
        name: 'ABC Test Event - Core Development',
        date: '2025-11-15',
        location: 'ABC Bocce Bar, Chicago'
      },
      
      // Expected branding
      expectedBranding: {
        name: 'American Bocce Co.',
        tagline: 'Play More Bocce',
        primaryColor: '#c8102e',
        logo: 'https://bereasonable13.github.io/zeventbook/assets/logos/ABCMainTransparent.webp'
      }
    },
    
    CBC: {
      deploymentUrl: 'https://script.google.com/macros/s/CBC_DEPLOYMENT_ID_HERE/exec',
      brandSlug: 'cbc',
      
      features: {
        eventOnly: true,
        tournament: true,
        season: false,
        analytics: true,
        qrCodes: true,
        memberOnly: true,
      },
      
      testEvent: {
        name: 'CBC Test Event - Member Social',
        date: '2025-11-20',
        location: 'Chicago Bocce Club'
      },
      
      expectedBranding: {
        name: 'Chicago Bocce Club',
        tagline: 'Modern Social Club for Chicago Professionals',
        primaryColor: '#2c3e50',
        logo: 'https://bereasonable13.github.io/zeventbook/assets/logos/ChicagoBocceClub.webp'
      }
    },
    
    CBL: {
      deploymentUrl: 'https://script.google.com/macros/s/CBL_DEPLOYMENT_ID_HERE/exec',
      brandSlug: 'cbl',
      
      features: {
        eventOnly: true,
        tournament: true,
        season: true,
        analytics: true,
        qrCodes: true,
        liveStats: true,
        playerProfiles: true,
        teamPages: true,
      },
      
      testEvent: {
        name: 'CBL Test Match - Week 3',
        date: '2025-11-18',
        location: 'Chicago Bocce Club'
      },
      
      expectedBranding: {
        name: 'Chicago Bocce League',
        tagline: 'The Next Big Thing in Bocce',
        primaryColor: '#0d1b2a',
        logo: 'https://bereasonable13.github.io/zeventbook/assets/logos/ChicagoBocceLeague.webp'
      }
    }
  },
  
  // Global test settings
  timeout: 30000,
  retryAttempts: 3,
  
  // Pages to test for each brand
  standardPages: ['Admin', 'Public', 'Poster'],
  
  // Helper methods
  getBrandConfig(brandKey) {
    return this.brands[brandKey];
  },
  
  getAllBrandKeys() {
    return Object.keys(this.brands);
  },
  
  getBrandUrl(brandKey, page = 'Admin') {
    const brand = this.brands[brandKey];
    return `${brand.deploymentUrl}?page=${page}`;
  }
};

// Export for Node.js tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TEST_CONFIG;
}
