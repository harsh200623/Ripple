import { describe, expect, it } from 'vitest';
import { parsePrUrl } from './parsePrUrl';

describe('parsePrUrl', () => {
  it('accepts a canonical public PR URL and normalizes it', () => {
    expect(parsePrUrl('https://github.com/owner/repository/pull/123')).toEqual({
      owner: 'owner',
      repo: 'repository',
      pullNumber: 123,
      normalizedUrl: 'https://github.com/owner/repository/pull/123',
    });
  });

  it('accepts a trailing slash and surrounding whitespace', () => {
    expect(parsePrUrl('  https://github.com/owner/repo/pull/7/  ')?.normalizedUrl).toBe(
      'https://github.com/owner/repo/pull/7',
    );
  });

  it('accepts uppercase host', () => {
    expect(parsePrUrl('https://GITHUB.com/owner/repo/pull/1')).not.toBeNull();
  });

  it.each([
    ['non-string', 123],
    ['undefined', undefined],
    ['empty', ''],
    ['too long', `https://github.com/o/r/pull/1${'a'.repeat(3000)}`],
    ['http scheme', 'http://github.com/owner/repo/pull/1'],
    ['other host', 'https://gitlab.com/owner/repo/pull/1'],
    ['lookalike host', 'https://github.com.evil.com/owner/repo/pull/1'],
    ['credentials', 'https://user:pass@github.com/owner/repo/pull/1'],
    ['custom port', 'https://github.com:8443/owner/repo/pull/1'],
    ['clone url', 'https://github.com/owner/repo.git'],
    ['issue url', 'https://github.com/owner/repo/issues/1'],
    ['files tab', 'https://github.com/owner/repo/pull/1/files'],
    ['query string', 'https://github.com/owner/repo/pull/1?diff=split'],
    ['fragment', 'https://github.com/owner/repo/pull/1#discussion'],
    ['zero PR number', 'https://github.com/owner/repo/pull/0'],
    ['leading-zero PR number', 'https://github.com/owner/repo/pull/01'],
    ['non-numeric PR number', 'https://github.com/owner/repo/pull/abc'],
    ['owner with leading hyphen', 'https://github.com/-owner/repo/pull/1'],
    ['owner with underscore', 'https://github.com/own_er/repo/pull/1'],
    ['repo dot-dot', 'https://github.com/owner/../pull/1'],
    ['missing number', 'https://github.com/owner/repo/pull/'],
    ['not a URL', 'github.com/owner/repo/pull/1'],
  ])('rejects %s', (_label, value) => {
    expect(parsePrUrl(value)).toBeNull();
  });
});
