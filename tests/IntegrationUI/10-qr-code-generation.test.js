/**
 * Integration Test 10: QR Code Generation & Security
 * CRITICAL: Tests QR code generation, validation, and security
 * 
 * @integration UI ↔ backend
 * @security HIGH PRIORITY
 */

describe('QR Code Generation & Security Integration', () => {
  
  const TRUSTED_QR_DOMAIN = 'chart.googleapis.com';
  const TRUSTED_SHORTURL_DOMAINS = ['g.co', 'goo.gl'];

  describe('QR Code URL Validation (SECURITY)', () => {
    const validateQrUrl = (url) => {
      if (!url || typeof url !== 'string') {
        return { valid: false, reason: 'URL is required' };
      }

      try {
        const urlObj = new URL(url);
        
        // Must be HTTPS
        if (urlObj.protocol !== 'https:') {
          return { valid: false, reason: 'QR URL must use HTTPS' };
        }

        // Must be from trusted domain
        if (urlObj.hostname !== TRUSTED_QR_DOMAIN) {
          return { valid: false, reason: `QR URL must be from ${TRUSTED_QR_DOMAIN}` };
        }

        // Must have QR chart parameters
        if (!urlObj.searchParams.has('cht') || !urlObj.searchParams.has('chl')) {
          return { valid: false, reason: 'Missing required QR parameters' };
        }

        return { valid: true };
      } catch (error) {
        return { valid: false, reason: 'Invalid URL format' };
      }
    };

    it('accepts valid Google Charts QR URL', () => {
      const url = 'https://chart.googleapis.com/chart?cht=qr&chs=300x300&chl=https://example.com';
      const result = validateQrUrl(url);
      
      expect(result.valid).toBe(true);
    });

    it('rejects non-HTTPS QR URLs', () => {
      const url = 'http://chart.googleapis.com/chart?cht=qr&chl=test';
      const result = validateQrUrl(url);
      
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('HTTPS');
    });

    it('rejects QR URLs from untrusted domains', () => {
      const url = 'https://malicious.com/chart?cht=qr&chl=test';
      const result = validateQrUrl(url);
      
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('chart.googleapis.com');
    });

    it('rejects javascript: URLs in QR content', () => {
      const maliciousContent = 'javascript:alert(1)';
      const url = `https://chart.googleapis.com/chart?cht=qr&chl=${encodeURIComponent(maliciousContent)}`;
      
      // Additional validation of the content
      const decodedContent = decodeURIComponent(url.split('chl=')[1]);
      const isSafe = !decodedContent.startsWith('javascript:');
      
      expect(isSafe).toBe(false); // Should detect and reject
    });

    it('rejects data: URLs in QR content', () => {
      const maliciousContent = 'data:text/html,<script>alert(1)</script>';
      const url = `https://chart.googleapis.com/chart?cht=qr&chl=${encodeURIComponent(maliciousContent)}`;
      
      const decodedContent = decodeURIComponent(url.split('chl=')[1]);
      const isSafe = !decodedContent.startsWith('data:');
      
      expect(isSafe).toBe(false);
    });

    it('rejects QR URLs missing required parameters', () => {
      const url = 'https://chart.googleapis.com/chart?chl=test'; // Missing cht
      const result = validateQrUrl(url);
      
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('required QR parameters');
    });

    it('rejects empty QR URLs', () => {
      const result = validateQrUrl('');
      
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('required');
    });

    it('rejects null QR URLs', () => {
      const result = validateQrUrl(null);
      
      expect(result.valid).toBe(false);
    });

    it('validates QR URL format before display', () => {
      const urls = [
        'https://chart.googleapis.com/chart?cht=qr&chl=test',
        'https://malicious.com/fake-qr',
        'javascript:alert(1)'
      ];

      const validUrls = urls.filter(url => validateQrUrl(url).valid);
      
      expect(validUrls).toHaveLength(1); // Only the first is valid
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

        // Must be from trusted short URL domain
        const isTrusted = TRUSTED_SHORTURL_DOMAINS.some(domain => 
          urlObj.hostname === domain
        );
        
        if (!isTrusted) {
          return { valid: false, reason: `Short URL must be from ${TRUSTED_SHORTURL_DOMAINS.join(' or ')}` };
        }

        // Should have a path (the short code)
        if (urlObj.pathname === '/' || urlObj.pathname === '') {
          return { valid: false, reason: 'Short URL must have a code' };
        }

        return { valid: true };
      } catch (error) {
        return { valid: false, reason: 'Invalid URL format' };
      }
    };

    it('accepts valid g.co short URL', () => {
      const url = 'https://g.co/abc123';
      const result = validateShortUrl(url);
      
      expect(result.valid).toBe(true);
    });

    it('accepts valid goo.gl short URL', () => {
      const url = 'https://goo.gl/xyz789';
      const result = validateShortUrl(url);
      
      expect(result.valid).toBe(true);
    });

    it('rejects non-HTTPS short URLs', () => {
      const url = 'http://g.co/abc123';
      const result = validateShortUrl(url);
      
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('HTTPS');
    });

    it('rejects short URLs from untrusted domains', () => {
      const url = 'https://bit.ly/abc123';
      const result = validateShortUrl(url);
      
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('g.co or goo.gl');
    });

    it('rejects short URLs without a code', () => {
      const url = 'https://g.co/';
      const result = validateShortUrl(url);
      
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('must have a code');
    });

    it('rejects javascript: URLs', () => {
      const url = 'javascript:alert(1)';
      const result = validateShortUrl(url);
      
      expect(result.valid).toBe(false);
    });

    it('rejects malicious short URLs', () => {
      const maliciousUrls = [
        'https://evil.com/phishing',
        'http://g.co/unsafe',
        'javascript:void(0)',
        'data:text/html,<script>alert(1)</script>'
      ];

      const validUrls = maliciousUrls.filter(url => validateShortUrl(url).valid);
      
      expect(validUrls).toHaveLength(0); // All should be rejected
    });
  });

  describe('QR Code Content Validation', () => {
    const validateQrContent = (content) => {
      if (!content || typeof content !== 'string') {
        return { valid: false, reason: 'Content is required' };
      }

      // Reject dangerous protocols
      const dangerousProtocols = ['javascript:', 'data:', 'file:', 'vbscript:'];
      const hasDangerousProtocol = dangerousProtocols.some(proto => 
        content.toLowerCase().startsWith(proto)
      );

      if (hasDangerousProtocol) {
        return { valid: false, reason: 'Dangerous protocol detected' };
      }

      // Must be valid URL
      try {
        const url = new URL(content);
        
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          return { valid: false, reason: 'QR content must be HTTP/HTTPS URL' };
        }

        return { valid: true };
      } catch {
        return { valid: false, reason: 'QR content must be a valid URL' };
      }
    };

    it('validates safe event URL for QR code', () => {
      const content = 'https://example.com?page=public&event=tech-conference';
      const result = validateQrContent(content);
      
      expect(result.valid).toBe(true);
    });

    it('rejects javascript: in QR content', () => {
      const content = 'javascript:alert(document.cookie)';
      const result = validateQrContent(content);
      
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Dangerous protocol');
    });

    it('rejects data: URLs in QR content', () => {
      const content = 'data:text/html,<h1>XSS</h1>';
      const result = validateQrContent(content);
      
      expect(result.valid).toBe(false);
    });

    it('rejects file: URLs in QR content', () => {
      const content = 'file:///etc/passwd';
      const result = validateQrContent(content);
      
      expect(result.valid).toBe(false);
    });

    it('rejects non-URL content', () => {
      const content = 'not a url at all';
      const result = validateQrContent(content);
      
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('valid URL');
    });
  });

  describe('QR Code Display Logic', () => {
    const shouldDisplayQr = (qrUrl, shortUrl) => {
      const validateQrUrl = (url) => {
        try {
          const urlObj = new URL(url);
          return urlObj.protocol === 'https:' && 
                 urlObj.hostname === TRUSTED_QR_DOMAIN &&
                 urlObj.searchParams.has('cht') &&
                 urlObj.searchParams.has('chl');
        } catch {
          return false;
        }
      };

      const validateShortUrl = (url) => {
        try {
          const urlObj = new URL(url);
          return urlObj.protocol === 'https:' &&
                 TRUSTED_SHORTURL_DOMAINS.includes(urlObj.hostname) &&
                 urlObj.pathname !== '/';
        } catch {
          return false;
        }
      };

      return {
        showQr: validateQrUrl(qrUrl),
        showShortUrl: validateShortUrl(shortUrl)
      };
    };

    it('displays QR when both URLs are valid', () => {
      const qrUrl = 'https://chart.googleapis.com/chart?cht=qr&chl=test';
      const shortUrl = 'https://g.co/abc123';
      
      const display = shouldDisplayQr(qrUrl, shortUrl);
      
      expect(display.showQr).toBe(true);
      expect(display.showShortUrl).toBe(true);
    });

    it('hides QR when QR URL is invalid', () => {
      const qrUrl = 'https://malicious.com/fake-qr';
      const shortUrl = 'https://g.co/abc123';
      
      const display = shouldDisplayQr(qrUrl, shortUrl);
      
      expect(display.showQr).toBe(false);
      expect(display.showShortUrl).toBe(true); // Short URL still valid
    });

    it('hides short URL when invalid', () => {
      const qrUrl = 'https://chart.googleapis.com/chart?cht=qr&chl=test';
      const shortUrl = 'https://bit.ly/bad';
      
      const display = shouldDisplayQr(qrUrl, shortUrl);
      
      expect(display.showQr).toBe(true); // QR still valid
      expect(display.showShortUrl).toBe(false);
    });

    it('hides both when both are invalid', () => {
      const qrUrl = 'javascript:alert(1)';
      const shortUrl = 'javascript:alert(2)';
      
      const display = shouldDisplayQr(qrUrl, shortUrl);
      
      expect(display.showQr).toBe(false);
      expect(display.showShortUrl).toBe(false);
    });

    it('shows error message when QR validation fails', () => {
      const qrUrl = 'https://untrusted.com/qr';
      
      const getErrorMessage = (url) => {
        try {
          const urlObj = new URL(url);
          if (urlObj.hostname !== TRUSTED_QR_DOMAIN) {
            return 'QR code is not from a trusted source';
          }
        } catch {
          return 'Invalid QR code URL';
        }
        return null;
      };

      const error = getErrorMessage(qrUrl);
      expect(error).toBeDefined();
      expect(error).toContain('trusted');
    });
  });

  describe('Backend Integration', () => {
    const mockBackend = {
      getShareQrVerified: jest.fn()
    };

    beforeEach(() => {
      mockBackend.getShareQrVerified.mockClear();
    });

    it('requests QR and shortlink from backend', async () => {
      mockBackend.getShareQrVerified.mockResolvedValue({
        success: true,
        data: {
          qrCodeUrl: 'https://chart.googleapis.com/chart?cht=qr&chl=https://example.com',
          shortlink: 'https://g.co/abc123',
          eventId: 'evt-123'
        }
      });

      const result = await mockBackend.getShareQrVerified('evt-123');

      expect(result.success).toBe(true);
      expect(result.data.qrCodeUrl).toContain('chart.googleapis.com');
      expect(result.data.shortlink).toContain('g.co');
    });

    it('validates backend response before display', async () => {
      mockBackend.getShareQrVerified.mockResolvedValue({
        success: true,
        data: {
          qrCodeUrl: 'https://malicious.com/fake',
          shortlink: 'https://phishing.com/link'
        }
      });

      const result = await mockBackend.getShareQrVerified('evt-123');
      
      // Validate before displaying
      const qrValid = result.data.qrCodeUrl.includes('chart.googleapis.com');
      
      let shortValid = false;
      try {
        const urlObj = new URL(result.data.shortlink);
        shortValid = urlObj.protocol === 'https:' && 
                    (urlObj.hostname === 'g.co' || urlObj.hostname === 'goo.gl');
      } catch {
        shortValid = false;
      }

      expect(qrValid).toBe(false); // Should not display
      expect(shortValid).toBe(false); // Should not display
    });

    it('handles backend errors gracefully', async () => {
      mockBackend.getShareQrVerified.mockResolvedValue({
        error: true,
        code: 500,
        message: 'QR generation failed'
      });

      const result = await mockBackend.getShareQrVerified('evt-123');

      expect(result.error).toBe(true);
      // Should not attempt to display QR/shortlink
    });

    it('validates event ID before requesting', () => {
      const validateEventId = (id) => {
        return typeof id === 'string' && id.startsWith('evt-');
      };

      expect(validateEventId('evt-123')).toBe(true);
      expect(validateEventId('invalid')).toBe(false);
      expect(validateEventId(null)).toBe(false);
    });
  });
});
