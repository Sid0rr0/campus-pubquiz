import { clientIpOf } from '@/config/client-ip';

describe('clientIpOf', () => {
  it.each([
    ['a plain IPv4 address', '203.0.113.7', '203.0.113.7'],
    ['an IPv4 address with a port', '203.0.113.7:51234', '203.0.113.7'],
    ['an IPv6 address', '2001:db8::1', '2001:db8::1'],
    [
      'a bracketed IPv6 address with a port',
      '[2001:db8::1]:443',
      '2001:db8::1',
    ],
    ['an IPv4-mapped IPv6 address', '::ffff:203.0.113.7', '::ffff:203.0.113.7'],
  ])('keeps %s as one client', (_name, ip, expected) => {
    expect(clientIpOf({ ip })).toBe(expected);
  });

  it('gives two connections of one client the same key', () => {
    expect(clientIpOf({ ip: '203.0.113.7:1111' })).toBe(
      clientIpOf({ ip: '203.0.113.7:2222' }),
    );
  });

  it('falls back to an empty key when the request has no address', () => {
    expect(clientIpOf({})).toBe('');
  });
});
