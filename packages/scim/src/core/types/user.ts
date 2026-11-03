/**
 * SCIM Core User resource — RFC 7643 §4.1 (docs/rfc/rfc7643.txt §4.1,
 * attribute definitions §4.1.1–§4.1.2, canonical types verified against
 * that section).
 */

import { ScimMeta } from './common';

/** Schema URN constant — RFC 7643 §4.1. */
export const SCIM_USER_SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User' as const;

/* ── Singular attributes (§4.1.1) ──────────────────────────────────────── */

/** Sub-attributes of the `name` complex attribute. */
export interface ScimName {
  formatted?: string;
  familyName?: string;
  givenName?: string;
  middleName?: string;
  honorificPrefix?: string;
  honorificSuffix?: string;
}

/* ── Multi-valued attribute element shapes (§4.1.2) ────────────────────── */

/**
 * Common sub-attributes of multi-valued attributes (RFC 7643 §2.4): value,
 * display, type and primary (at most one primary per attribute, §2.4).
 */
interface ScimMultiValued<TType extends string = string> {
  /** Attribute value. */
  value: string;
  display?: string;
  /** Classification. Canonical values per RFC 7643 §4.1.2; extra values MAY be accepted. */
  type?: TType;
  /** Single selection indicator for end users — at most one true per attribute. */
  primary?: boolean;
}

/** `emails` element — canonical values "work" | "home" | "other" (§4.1.2). */
export type ScimEmailType = 'work' | 'home' | 'other' | (string & Record<never, never>);
export interface ScimEmail extends ScimMultiValued<ScimEmailType> {}

/** `phoneNumbers` element — canonical values "work" | "home" | "mobile" | "fax" | "pager" | "other" (§4.1.2). */
export type ScimPhoneType =
  | 'work'
  | 'home'
  | 'mobile'
  | 'fax'
  | 'pager'
  | 'other'
  | (string & Record<never, never>);
export interface ScimPhoneNumber extends ScimMultiValued<ScimPhoneType> {}

/** `ims` element — canonical values per §4.1.2 (AIM/gtalk/icq/xmpp/msn/skype/qq/yahoo/other). */
export type ScimImType =
  | 'aim'
  | 'gtalk'
  | 'icq'
  | 'xmpp'
  | 'msn'
  | 'skype'
  | 'qq'
  | 'yahoo'
  | 'other'
  | (string & Record<never, never>);
export interface ScimIm extends ScimMultiValued<ScimImType> {}

/** `photos` element — canonical values "photo" | "thumbnail" (§4.1.2). */
export type ScimPhotoType = 'photo' | 'thumbnail' | (string & Record<never, never>);
export interface ScimPhoto extends ScimMultiValued<ScimPhotoType> {}

/** Address element — canonical type values "work" | "home" | "other" (§4.1.2). */
export type ScimAddressType = 'work' | 'home' | 'other' | (string & Record<never, never>);
export interface ScimAddress {
  formatted?: string;
  streetAddress?: string;
  locality?: string;
  region?: string;
  postalCode?: string;
  /** ISO 3166-1 alpha-2 country code (§4.1.2). */
  country?: string;
  type?: ScimAddressType;
  primary?: boolean;
}

/**
 * `groups` element (§4.1.2): `value` is the group id, `$ref` the group's
 * resource URI — server-populated on responses; clients MUST NOT push
 * group membership through a User object (membership is managed on the
 * Groups resource, a v2 milestone).
 */
export interface ScimGroupReference {
  value: string;
  display?: string;
  /** Reference URI of the group (e.g. /Groups/2819c223…, §2.4). */
  $ref?: string;
}

/**
 * `entitlements`/`roles` element — free-form type strings (§4.1.2).
 */
export interface ScimEntitlement extends ScimMultiValued<string> {}

/** `x509Certificates` element — value is base64 DER or PKCS#7 (§4.1.2). */
export interface ScimX509Certificate extends ScimMultiValued<string> {}

/* ── Core User resource shape ──────────────────────────────────────────── */

/**
 * The User resource as the mapper sees it: core attributes + `externalId`,
 * WITHOUT server-managed `id`/`meta` (library-owned).
 */
export interface ScimUser {
  /** Unique identifier for the User — REQUIRED (§4.1.1). */
  userName: string;
  name?: ScimName;
  displayName?: string;
  nickName?: string;
  profileUrl?: string;
  title?: string;
  userType?: string;
  preferredLanguage?: string;
  locale?: string;
  timezone?: string;
  active?: boolean;

  emails?: ScimEmail[];
  phoneNumbers?: ScimPhoneNumber[];
  addresses?: ScimAddress[];
  ims?: ScimIm[];
  photos?: ScimPhoto[];
  /**
   * Read-only membership backing (§4.1.2): ignored when clients provide it;
   * returned in representations from M3+ once Groups exist.
   */
  groups?: ScimGroupReference[];
  entitlements?: ScimEntitlement[];
  roles?: ScimEntitlement[];
  x509Certificates?: ScimX509Certificate[];

  /** User's clear-text password — writeOnly per RFC 7643 §7.2; consumed, never returned. */
  password?: string;

  /** An identifier for the resource as defined by the service consumer (§3.1). */
  externalId?: string;
}

/** Full server representation: core attributes plus server-managed common attributes (§3.1). */
export interface ScimUserResource extends ScimUser {
  id: string;
  meta?: ScimMeta;
}

/** Payload accepted for POST creation: read-only `groups` excluded (§4.1.2). */
export type ScimUserCreate = Omit<ScimUser, 'groups'>;
