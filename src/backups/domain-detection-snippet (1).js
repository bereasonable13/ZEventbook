// Add this to the top of Admin.html, Public.html, etc.

function getBrandFromRequest() {
  // 1. URL parameter (testing/override)
  const urlParams = new URLSearchParams(window.location.search);
  const brandParam = urlParams.get('brand');
  if (brandParam) {
    return brandParam;
  }
  
  // 2. Custom domain mapping
  const hostname = window.location.hostname;
  const domainMap = {
    'events.americanbocceco.com': 'ABC',
    'abc.nextup.com': 'ABC',
    'events.chicagobocce.club': 'ABC'
  };
  
  if (domainMap[hostname]) {
    return domainMap[hostname];
  }
  
  // 3. Subdomain pattern
  if (hostname.includes('.nextup.com')) {
    const subdomain = hostname.split('.')[0];
    if (subdomain && subdomain !== 'www' && subdomain !== 'nextup') {
      return subdomain.toUpperCase();
    }
  }
  
  // 4. Default
  return 'ABC';
}

// Replace: const currentBrand = urlParams.get('brand') || 'ABC';
// With: const currentBrand = getBrandFromRequest();
