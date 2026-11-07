export interface ParsedPullRequestUrl {
  owner: string;
  repo: string;
  pullNumber: number;
  /** Normalized canonical URL: https://github.com/owner/repo/pull/N */
  normalizedUrl: string;
}

const GITHUB_HOST = 'github.com';
// GitHub owner: alphanumerics and single hyphens, no leading/trailing hyphen, max 39 chars.
const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
// Repo name: alphanumerics, '.', '_', '-'; not '.' or '..'.
const REPO_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;
const MAX_INPUT_LENGTH = 2048;

/**
 * Strictly parses a public GitHub pull request URL. Pure and side-effect free.
 * Rejects other hosts, credentials, ports, clone URLs, and non-PR paths.
 * Returns null on any invalid input (never throws), so callers map it to INVALID_PULL_REQUEST_URL.
 */
export function parsePrUrl(input: unknown): ParsedPullRequestUrl | null {
  if (typeof input !== 'string' || input.length === 0 || input.length > MAX_INPUT_LENGTH) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }

  if (url.protocol !== 'https:') return null;
  if (url.username !== '' || url.password !== '') return null;
  if (url.port !== '') return null;
  if (url.hostname.toLowerCase() !== GITHUB_HOST) return null;
  if (url.search !== '' || url.hash !== '') return null;

  const segments = url.pathname.replace(/\/+$/, '').split('/').slice(1);
  if (segments.length !== 4) return null;
  const [owner, repo, marker, number] = segments as [string, string, string, string];

  if (marker !== 'pull') return null;
  if (!OWNER_PATTERN.test(owner)) return null;
  if (!REPO_PATTERN.test(repo) || repo === '.' || repo === '..') return null;
  if (!/^[1-9][0-9]{0,8}$/.test(number)) return null;

  const pullNumber = Number(number);
  return {
    owner,
    repo,
    pullNumber,
    normalizedUrl: `https://github.com/${owner}/${repo}/pull/${pullNumber}`,
  };
}
