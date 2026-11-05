/**
 * Response writing, adapter-agnostic — the library ships ZERO HTTP-platform
 * code, so both express-like surfaces (`.status()`/`.json()`) and raw
 * `http.ServerResponse` (`writeHead`/`end`) are first-class. Every SCIM
 * response body is `application/scim+json` (RFC 7644 §3.4.2 — IdP interop
 * requires the real media type, never application/json).
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
 * Serializes a SCIM body to the response on any supported surface:
 * express-like (`.status`/`.json`), raw node (`writeHead`/`end`), or a
 * last-resort `statusCode` + `end` fallback so the pointer is never lost.
 */
export function writeScimJson(response: unknown, status: number, body?: unknown): void {
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
 * Sets the `Location` response header cross-platform (RFC 7644 §3.3):
 * express `setHeader`, fastify compat `header`; raw surfaces without
 * either silently skip (HTTP allows omitting Location).
 */
export function setLocationHeader(response: unknown, location: string): void {
  const res = response as ScimResponseLike;

  if (typeof res.setHeader === 'function') res.setHeader('Location', location);
  else if (typeof res.header === 'function') res.header('Location', location);
  // Raw ServerResponse without setHeader: nothing safe to do — silently
  // skip (HTTP allows omitting Location on 201 creation responses).
}

