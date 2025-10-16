const {
  envelope_,
  ok_,
  notModified_,
  rateLimited_,
  serverError_,
  calculateBackoffSchedule_,
} = require('../../Code.js');

describe('response envelope helpers', () => {
  it('wraps data with status metadata', () => {
    const result = envelope_(202, { data: true }, 'processing', Date.now() - 15);

    expect(result.ok).toBe(true);
    expect(result.status).toBe(202);
    expect(result.phase).toBe('processing');
    expect(result.data).toBe(true);
    expect(typeof result.ms).toBe('number');
  });

  it('builds ok responses', () => {
    const result = ok_({ payload: 1 }, 'complete');
    expect(result.status).toBe(200);
    expect(result.ok).toBe(true);
    expect(result.payload).toBe(1);
  });

  it('builds not modified responses', () => {
    const result = notModified_('etag-123');
    expect(result.status).toBe(304);
    expect(result.notModified).toBe(true);
    expect(result.etag).toBe('etag-123');
  });

  it('builds rate limited responses with backoff schedule', () => {
    const result = rateLimited_(30, 2);
    expect(result.status).toBe(429);
    expect(result.rateLimit.retryAfterSeconds).toBe(30);
    expect(result.rateLimit.attemptNumber).toBe(2);
    expect(Array.isArray(result.rateLimit.backoffSchedule)).toBe(true);
    expect(result.rateLimit.backoffSchedule.length).toBeGreaterThan(0);
  });

  it('builds server error responses', () => {
    const result = serverError_(new Error('boom'), 'phase', Date.now() - 5);
    expect(result.status).toBe(500);
    expect(result.error).toContain('boom');
    expect(result.phase).toBe('phase');
  });
});

describe('backoff schedule', () => {
  it('increases exponentially and caps at 600 seconds', () => {
    const schedule = calculateBackoffSchedule_(3);
    expect(schedule[0]).toBe(30);
    expect(schedule[1]).toBe(60);
    expect(schedule[schedule.length - 1]).toBeLessThanOrEqual(600);
  });
});
