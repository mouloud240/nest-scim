/**
 * Class decorator tagging a mapper class as THE user mapper of a SCIM
 * module — `@ScimUserMapperToken()`.
 *
 * Declared alongside the DI token (`SCIM_USER_MAPPER`) so applications can
 * mark their mapper explicitly even without `forRoot()` passing it
 * (e.g. mapper discovery is a hook explored from M3 on). The marker uses
 * `Reflect.defineMetadata` — requires `reflect-metadata` polyfill, which
 * every NestJS application loads (Nest's own DI depends on it).
 */
import 'reflect-metadata';

/**
 * Registry marker key — `Symbol.for` so duplicated library copies share
 * one marker identity (same rationale as `SCIM_USER_MAPPER` token).
 */
export const SCIM_USER_MAPPER_MARKER: unique symbol = Symbol.for('nest-scim.user-mapper-marker');

/**
 * Marks a class as a SCIM user mapper. Purely declarative metadata today;
 * the `ScimModule` CLI/config validation surfaces in later milestones.
 */
export function ScimUserMapperToken(): ClassDecorator {
  return (target: object) => {
    Reflect.defineMetadata(SCIM_USER_MAPPER_MARKER, true, target);
  };
}

/** Reads the marker off a class (or undefined when untagged). */
export function getScimUserMapperMarker(target: object): unknown {
  return Reflect.getMetadata(SCIM_USER_MAPPER_MARKER, target);
}
