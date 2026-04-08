/**
 * @jest-environment node
 */
import { checkRateLimit, getClientIp, type RateLimitConfig } from '@/lib/rate-limit';

const config: RateLimitConfig = { limit: 3, windowMs: 60_000 };

describe('checkRateLimit', () => {
  it('should allow the first request', () => {
    const result = checkRateLimit(`test-${Date.now()}`, config);

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('should decrement remaining on each call', () => {
    const key = `test-decrement-${Date.now()}`;

    const r1 = checkRateLimit(key, config);
    const r2 = checkRateLimit(key, config);
    const r3 = checkRateLimit(key, config);

    expect(r1.remaining).toBe(2);
    expect(r2.remaining).toBe(1);
    expect(r3.remaining).toBe(0);
  });

  it('should reject requests over the limit', () => {
    const key = `test-over-${Date.now()}`;

    checkRateLimit(key, config); // 1
    checkRateLimit(key, config); // 2
    checkRateLimit(key, config); // 3
    const r4 = checkRateLimit(key, config); // 4 — over limit

    expect(r4.success).toBe(false);
    expect(r4.remaining).toBe(0);
  });

  it('should reset after window expires', async () => {
    const key = `test-expire-${Date.now()}`;
    const shortConfig: RateLimitConfig = { limit: 1, windowMs: 50 };

    const r1 = checkRateLimit(key, shortConfig);
    expect(r1.success).toBe(true);

    const r2 = checkRateLimit(key, shortConfig);
    expect(r2.success).toBe(false);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 60));

    const r3 = checkRateLimit(key, shortConfig);
    expect(r3.success).toBe(true);
  });

  it('should isolate different identifiers', () => {
    const ts = Date.now();
    const r1 = checkRateLimit(`user-a-${ts}`, config);
    const r2 = checkRateLimit(`user-b-${ts}`, config);

    expect(r1.remaining).toBe(2);
    expect(r2.remaining).toBe(2);
  });

  it('should return correct limit in response', () => {
    const result = checkRateLimit(`test-limit-${Date.now()}`, { limit: 10, windowMs: 60_000 });

    expect(result.limit).toBe(10);
  });

  it('should return a future resetAt timestamp', () => {
    const before = Date.now();
    const result = checkRateLimit(`test-reset-${Date.now()}`, config);

    expect(result.resetAt).toBeGreaterThan(before);
  });
});

describe('getClientIp', () => {
  function makeRequest(headers: Record<string, string> = {}): Request {
    return new Request('http://localhost', { headers });
  }

  it('should extract IP from x-forwarded-for', () => {
    const ip = getClientIp(makeRequest({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }));

    expect(ip).toBe('1.2.3.4');
  });

  it('should extract IP from x-real-ip', () => {
    const ip = getClientIp(makeRequest({ 'x-real-ip': '10.0.0.1' }));

    expect(ip).toBe('10.0.0.1');
  });

  it('should extract IP from x-vercel-forwarded-for', () => {
    const ip = getClientIp(makeRequest({ 'x-vercel-forwarded-for': '192.168.1.1, 10.0.0.1' }));

    expect(ip).toBe('192.168.1.1');
  });

  it('should prefer x-forwarded-for over other headers', () => {
    const ip = getClientIp(
      makeRequest({
        'x-forwarded-for': '1.1.1.1',
        'x-real-ip': '2.2.2.2',
        'x-vercel-forwarded-for': '3.3.3.3',
      }),
    );

    expect(ip).toBe('1.1.1.1');
  });

  it('should return "unknown" when no IP headers present', () => {
    const ip = getClientIp(makeRequest());

    expect(ip).toBe('unknown');
  });
});
