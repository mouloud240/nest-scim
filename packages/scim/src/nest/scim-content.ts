/**
 * Response writing, adapter-agnostic.
 *
 * The library ships ZERO HTTP-platform code (platform decision: express,
 * fastify, and the new `@nestjs/platform-node` must all be first-class).
 * Different adapters expose different response surfaces:
 *
 * - express / platform-fastify / platform-node wrappers: `.status()` +
 *   `.json()` express-compatible surface (fastify adds a compat wrapper;
 *   platform-node wires its own),
 * - raw `http.ServerResponse` (unwrapped platform-node): `writeHead`/`end`.
 *
 * Every SCIM response body is `application/scim+json` — RFC 7644 §3.4.2
 * (docs/rfc/rfc7644.txt: ListResponse "SHOULD" + base-content rules; the
 * IdP interop corpora of Okta/Entra demand the real media type, NOT
 * application/json).
 */

/** Media type for every SCIM success AND error response. */
export const SCIM_CONTENT_TYPE = 'application/scim+json';

/**
 * Minimal structural surface we tolerate on the HTTP response. Deliberately
 * loose — one of the two write paths (express-like vs raw node) always fits.
 */
interface ScimResponseLike {
  status?(status: number): unknown;
  json?(body: unknown): unknown;
  setHeader?(name: string, value: string): unknown;
  header?(name: string, value: string): unknown;
  writeHead?(status: number, headers: Record<string, string>): unknown;
  end?(payload?: string): unknown;
  statusCode?: number;
}

/**
 * Serializes a SCIM body to the response regardless of HTTP adapter.
 *
 * - express-like surface: `.setHeader`/`.header` for the media type
 *   (express uses setHeader, fastify's compat wrapper either), then
 *   `.status(n).json(body)`,
 * - raw `http.ServerResponse` (platform-node unwrapped): `writeHead` +
 *   `end(JSON.stringify(body))`,
 * - unknown shape: last-resort `statusCode` assignment + `end` — callers
 *   get a response on every adapter, this pointer is never lost.
 */
export function writeScimJson(response: unknown, status: number, body: unknown): void {
  const res = response as ScimResponseLike;

  if (typeof res.status === 'function' && typeof res.json === 'function') {
    if (typeof res.setHeader === 'function') res.setHeader('Content-Type', SCIM_CONTENT_TYPE);
    else if (typeof res.header === 'function') res.header('Content-Type', SCIM_CONTENT_TYPE);
    res.status(status);
    res.json(body);
    return;
  }

  if (typeof res.writeHead === 'function' && typeof res.end === 'function') {
    res.writeHead(status, { 'Content-Type': SCIM_CONTENT_TYPE });
    res.end(JSON.stringify(body));
    return;
  }

  res.statusCode = status;
  res.end?.(JSON.stringify(body));
}

/**
 * Sets the `Location` response header cross-platform — the same two
 * surfaces as {@link writeScimJson} (express `setHeader`, fastify
 * compat `header`, raw node via writeHead-less `setHeader`).
 *
 * RFC 7644 §3.3: the HTTP response SHOULD include a Location header
 * indicating the resource URI (docs/rfc/rfc7644.txt §3.3).
 */
export function setLocationHeader(response: unknown, location: string): void {
  const res = response as ScimResponseLike;

  if (typeof res.setHeader === 'function') res.setHeader('Location', location);
  else if (typeof res.header === 'function') res.header('Location', location);
  // Raw ServerResponse without setHeader: nothing safe to do — silently
  // skip (HTTP allows omitting Location on 201 creation responses).
}

