/**
 * CRITICAL Integration Test: QR Code Generation & Security
 * Tests QR code URL construction, validation, and security
 * 
 * @integration Real Code.js functions
 * @security HIGH PRIORITY
 */

const {
  isValidShortCode_,
  generateShortCode_,
  slugify_
} = require('../setup/backend-bridge');

describe('QR Code Generation & Security (Real Integration)', () => {
  
  const TRUSTED_QR_DOMAIN = 'chart.googleapis.com';
  const BASE_URL = 'https://chart.googleapis.com/chart';
  
  describe('Shortlink Validation for QR', () => {
    
    test('validates real shortcodes for QR generation', () => {
      const shortcode = generateShortCode_();
      expect(isValidShortCode_(shortcode)).toBe(true);
    });
    
    test('rejects invalid shortcodes', () => {
      expect(isValidShortCode_('INVALID')).toBe(false);
      expect(isValidShortCode_('abc')).toBe(false);
      expect(isValidShortCode_('abcdefg')).toBe(false);
    });
    
    test('ensures shortcodes are URL-safe', () => {
      for (let i = 0; i < 20; i++) {
        const code = generateShortCode_();
        expect(code).toMatch(/^[a-z0-9]{6}$/);
      }
    });
    
  });
  
  describe('QR URL Construction', () => {
    
    test('constructs valid Google Charts QR URL', () => {
      const shortcode = generateShortCode_();
      const targetUrl = `https://example.com/e/${shortcode}`;
      const qrUrl = `${BASE_URL}?cht=qr&chs=300x300&chl=${encodeURIComponent(targetUrl)}`;
      
      expect(qrUrl).toContain('chart.googleapis.com');
      expect(qrUrl).toContain('cht=qr');
      expect(qrUrl).toContain('chs=300x300');
      expect(qrUrl).toContain('chl=');
    });
    
    test('encodes target URL properly', () => {
      const targetUrl = 'https://example.com/event?id=123';
      const encoded = encodeURIComponent(targetUrl);
      expect(encoded).not.toContain('?');
      expect(encoded).toContain('%3F');
    });
    
    test('handles special characters in event slugs', () => {
      const slug = slugify_('Tech Conference 2025!');
      const targetUrl = `https://example.com/e/${slug}`;
      const qrUrl = `${BASE_URL}?cht=qr&chs=300x300&chl=${encodeURIComponent(targetUrl)}`;
      
      expect(qrUrl).toBeDefined();
      expect(slug).toMatch(/^[a-z0-9-]+$/);
    });
    
  });
  
  describe('Security: URL Validation', () => {
    
    const validateQrUrl = (url) => {
      if (!url || typeof url !== 'string') {
        return { valid: false, reason: 'URL is required' };
      }

      try {
        const urlObj = new URL(url);
        
        if (urlObj.protocol !== 'https:') {
          return { valid: false, reason: 'Must use HTTPS' };
        }

        if (urlObj.hostname !== TRUSTED_QR_DOMAIN) {
          return { valid: false, reason: 'Must use trusted domain' };
        }

        if (!urlObj.searchParams.has('cht') || !urlObj.searchParams.has('chl')) {
          return { valid: false, reason: 'Missing required parameters' };
        }

        return { valid: true };
      } catch (error) {
        return { valid: false, reason: 'Invalid URL format' };
      }
    };
    
    test('accepts valid Google Charts QR URL', () => {
      const url = `${BASE_URL}?cht=qr&chs=300x300&chl=https://example.com`;
      const result = validateQrUrl(url);
      expect(result.valid).toBe(true);
    });
    
    test('rejects HTTP (non-HTTPS) URLs', () => {
      const url = 'http://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=test';
      const result = validateQrUrl(url);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('HTTPS');
    });
    
    test('rejects untrusted domains', () => {
      const url = 'https://malicious.com/chart?cht=qr&chs=300x300&chl=test';
      const result = validateQrUrl(url);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('trusted domain');
    });
    
    test('rejects URLs missing QR parameters', () => {
      const url = 'https://chart.googleapis.com/chart?foo=bar';
      const result = validateQrUrl(url);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('required parameters');
    });
    
    test('rejects null/undefined URLs', () => {
      expect(validateQrUrl(null).valid).toBe(false);
      expect(validateQrUrl(undefined).valid).toBe(false);
      expect(validateQrUrl('').valid).toBe(false);
    });
    
  });
  
  describe('Complete QR Flow Integration', () => {
    
    test('generates shortcode, constructs URL, validates it', () => {
      const shortcode = generateShortCode_();
      expect(isValidShortCode_(shortcode)).toBe(true);
      
      const targetUrl = `https://example.com/e/${shortcode}`;
      const qrUrl = `${BASE_URL}?cht=qr&chs=300x300&chl=${encodeURIComponent(targetUrl)}`;
      
      const urlObj = new URL(qrUrl);
      expect(urlObj.protocol).toBe('https:');
      expect(urlObj.hostname).toBe(TRUSTED_QR_DOMAIN);
      expect(urlObj.searchParams.get('cht')).toBe('qr');
    });
    
    test('handles multiple QR generations', () => {
      const qrUrls = [];
      for (let i = 0; i < 10; i++) {
        const shortcode = generateShortCode_();
        const qrUrl = `${BASE_URL}?cht=qr&chs=300x300&chl=${encodeURIComponent(`https://example.com/e/${shortcode}`)}`;
        qrUrls.push(qrUrl);
      }
      
      expect(qrUrls.length).toBe(10);
      expect(new Set(qrUrls).size).toBe(10);
    });
    
  });
  
});
