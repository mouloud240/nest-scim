/**
 * SCIM schema-representation types — RFC 7643 §2 ("Schema
 * Representation": attribute types §2.3, mutability/returned/uniqueness
 * characteristics §2.2, complex attributes §2.4), plus the Schema
 * resource shape used by GET /Schemas (§7, exemplified in §8.7.1).
 */

/** Attribute data types — RFC 7643 §2.3. */
export type ScimAttributeType =
  | 'string'
  | 'boolean'
  | 'decimal'
  | 'integer'
  | 'dateTime'
  | 'binary'
  | 'complex'
  | 'reference';

/** MUTABILITY characteristic values — RFC 7643 §2.2. */
export type ScimMutability = 'readOnly' | 'readWrite' | 'immutable' | 'writeOnly';

/** RETURNED characteristic values — RFC 7643 §2.2. */
export type ScimReturned = 'attribute' | 'always' | 'never' | 'default';

/** UNIQUENESS characteristic values — RFC 7643 §2.2. */
export type ScimUniqueness = 'none' | 'server' | 'global';

/**
 * One attribute (or sub-attribute) declaration in a schema resource,
 * RFC 7643 §7 "Attribute descriptors" — optional characteristics are
 * omitted from the JSON exactly where the RFC omits them.
 */
export interface ScimSchemaAttribute {
  name: string;
  type: ScimAttributeType;
  multiValued: boolean;
  description: string;
  required?: boolean;
  caseExact?: boolean;
  mutability?: ScimMutability;
  returned?: ScimReturned;
  uniqueness?: ScimUniqueness;
  /** Reference types for `type: "reference"` (§2.4). */
  referenceTypes?: string[];
  /** Canonical enum values for label-style attributes (§2.3). */
  canonicalValues?: string[];
  /** Sub-attributes of a complex attribute (§2.4). */
  subAttributes?: ScimSchemaAttribute[];
}

/** A full Schema resource as served by GET /Schemas (RFC 7643 §7). */
export interface ScimSchemaDescriptor {
  /** Canonical URN identifier, e.g. urn:ietf:params:scim:schemas:core:2.0:User. */
  id: string;
  /** Human-readable name, e.g. "User". */
  name: string;
  description: string;
  attributes: ScimSchemaAttribute[];
  meta?: {
    resourceType: string;
    location: string;
  };
}
