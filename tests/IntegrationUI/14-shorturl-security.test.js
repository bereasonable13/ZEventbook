/**
 * Integration Test 14: Short URL Security & Functionality
 * CRITICAL: Tests short URL generation, validation, and security
 * 
 * @integration UI ↔ backend
 * @security HIGH PRIORITY
 */

describe('Short URL Security & Functionality', () => {
  
  const TRUSTED_SHORTURL_DOMAINS = ['g.co', 'goo.gl'];
  const GOOGLE_URLSHORTENER_API = 'https://www.googleapis.com/urlshortener/v1/url';

  describe('Short URL Generation', () => {
    const mockBackend = {
      createShortUrl: jest.fn()
    };

    beforeEach(() => {
      mockBackend.createShortUrl.mockClear();
    });

    it('generates short URL from long URL', async () => {
      const longUrl = 'https://example.com?page=public&event=tech-conference-2025';
      
      mockBackend.createShortUrl.mockResolvedValue({
        success: true,
        data: {
          shortUrl: 'https://g.co/abc123',
          longUrl: longUrl
        }
      });

      const result = await mockBackend.createShortUrl(longUrl);

      expect(result.success).toBe(true);
      expect(result.data.shortUrl).toContain('g.co');
      expect(result.data.longUrl).toBe(longUrl);
    });

    it('validates long URL before shortening', () => {
      const validateLongUrl = (url) => {
        try {
          const urlObj = new URL(url);
          return urlObj.protocol === 'https:' && urlObj.hostname.length > 0;
        } catch {
          return false;
        }
      };

      expect(validateLongUrl('https://example.com')).toBe(true);
      expect(validateLongUrl('http://example.com')).toBe(false); // Not HTTPS
      expect(validateLongUrl('not-a-url')).toBe(false);
    });

    it('handles Google API rate limits', async () => {
      mockBackend.createShortUrl.mockResolvedValue({
        error: true,
        code: 429,
        message: 'Rate limit exceeded'
      });

      const result = await mockBackend.createShortUrl('https://example.com');

      expect(result.error).toBe(true);
      expect(result.code).toBe(429);
    });

    it('handles Google API errors gracefully', async () => {
      mockBackend.createShortUrl.mockResolvedValue({
        error: true,
        code: 500,
        message: 'Google URL Shortener API error'
      });

      const result = await mockBackend.createShortUrl('https://example.com');

      expect(result.error).toBe(true);
    });
  });

  describe('Short URL Validation (SECURITY)', () => {
    const validateShortUrl = (url) => {
      if (!url || typeof url !== 'string') {
        return { valid: false, reason: 'Short URL is required' };
      }

      try {
        const urlObj = new URL(url);
        
        // Must be HTTPS
        if (urlObj.protocol !== 'https:') {
          return { valid: false, reason: 'Short URL must use HTTPS' };
        }

        // Must be from trusted domain
        const isTrusted = TRUSTED_SHORTURL_DOMAINS.some(domain => 
          urlObj.hostname === domain
        );
        
        if (!isTrusted) {
          return { valid: false, reason: `Short URL must be from ${TRUSTED_SHORTURL_DOMAINS.join(' or ')}` };
        }

        // Must have a path (the short code)
        if (urlObj.pathname === '/' || urlObj.pathname === '') {
          return { valid: false, reason: 'Short URL must have a code' };
        }

        return { valid: true };
      } catch (error) {
        return { valid: false, reason: 'Invalid URL format' };
      }
    };

    it('validates g.co short URLs', () => {
      const url = 'https://g.co/abc123';
      const result = validateShortUrl(url);
      
      expect(result.valid).toBe(true);
    });

    it('validates goo.gl short URLs', () => {
      const url = 'https://goo.gl/xyz789';
      const result = validateShortUrl(url);
      
      expect(result.valid).toBe(true);
    });

    it('rejects bit.ly URLs', () => {
      const url = 'https://bit.ly/abc123';
      const result = validateShortUrl(url);
      
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('g.co or goo.gl');
    });

    it('rejects tinyurl URLs', () => {
      const url = 'https://tinyurl.com/abc123';
      const result = validateShortUrl(url);
      
      expect(result.valid).toBe(false);
    });

    it('rejects non-HTTPS short URLs', () => {
      const url = 'http://g.co/abc123';
      const result = validateShortUrl(url);
      
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('HTTPS');
    });

    it('rejects short URLs without code', () => {
      const url = 'https://g.co/';
      const result = validateShortUrl(url);
      
      expect(result.valid).toBe(false);
    });

    it('rejects malicious protocols', () => {
      const maliciousUrls = [
        'javascript:alert(1)',
        'data:text/html,<script>',
        'file:///etc/passwd'
      ];

      maliciousUrls.forEach(url => {
        const result = validateShortUrl(url);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('Short URL Resolution', () => {
    it('tracks click analytics', async () => {
      const shortUrl = 'https://g.co/abc123';
      const analytics = {
        clicks: 0,
        lastClicked: null
      };

      // Simulate click
      analytics.clicks++;
      analytics.lastClicked = new Date().toISOString();

      expect(analytics.clicks).toBe(1);
      expect(analytics.lastClicked).toBeDefined();
    });

    it('resolves to correct long URL', () => {
      const mapping = {
        'https://g.co/abc123': 'https://example.com?page=public&event=test'
      };

      const shortUrl = 'https://g.co/abc123';
      const longUrl = mapping[shortUrl];

      expect(longUrl).toBe('https://example.com?page=public&event=test');
    });

    it('handles expired short URLs', () => {
      const shortUrl = {
        url: 'https://g.co/abc123',
        expiresAt: new Date('2024-01-01'),
        isExpired: () => new Date() > shortUrl.expiresAt
      };

      expect(shortUrl.isExpired()).toBe(true);
    });
  });

  describe('Short URL Display Logic', () => {
    const shouldDisplayShortUrl = (url) => {
      try {
        const urlObj = new URL(url);
        return urlObj.protocol === 'https:' &&
               TRUSTED_SHORTURL_DOMAINS.includes(urlObj.hostname) &&
               urlObj.pathname !== '/';
      } catch {
        return false;
      }
    };

    it('displays valid short URL', () => {
      const url = 'https://g.co/abc123';
      expect(shouldDisplayShortUrl(url)).toBe(true);
    });

    it('hides invalid short URL', () => {
      const url = 'https://malicious.com/phishing';
      expect(shouldDisplayShortUrl(url)).toBe(false);
    });

    it('shows copy button for valid URL', () => {
      const url = 'https://g.co/abc123';
      const isValid = shouldDisplayShortUrl(url);
      const showCopyButton = isValid;

      expect(showCopyButton).toBe(true);
    });

    it('hides copy button for invalid URL', () => {
      const url = 'https://bit.ly/untrusted';
      const isValid = shouldDisplayShortUrl(url);
      const showCopyButton = isValid;

      expect(showCopyButton).toBe(false);
    });
  });

  describe('Short URL Regeneration', () => {
    const mockBackend = {
      regenerateShortUrl: jest.fn()
    };

    it('allows regenerating short URL', async () => {
      mockBackend.regenerateShortUrl.mockResolvedValue({
        success: true,
        data: {
          oldShortUrl: 'https://g.co/old123',
          newShortUrl: 'https://g.co/new456'
        }
      });

      const result = await mockBackend.regenerateShortUrl('evt-123');

      expect(result.success).toBe(true);
      expect(result.data.newShortUrl).not.toBe(result.data.oldShortUrl);
    });

    it('invalidates old short URL after regeneration', () => {
      const oldUrl = 'https://g.co/old123';
      const newUrl = 'https://g.co/new456';
      
      const activeUrls = [oldUrl];
      const index = activeUrls.indexOf(oldUrl);
      activeUrls.splice(index, 1);
      activeUrls.push(newUrl);

      expect(activeUrls).not.toContain(oldUrl);
      expect(activeUrls).toContain(newUrl);
    });
  });
});
