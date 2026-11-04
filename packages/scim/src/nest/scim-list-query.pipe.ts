/**
 * Controller-bound list/query pipe (M2 refactor: typed query on the
 * controller).
 *
 * The `@Query()` wire value is raw, untrusted, `unknown`-shaped — the
 * adapter's `parseListQuery` is the single interpretation point (parse,
 * don't validate: RFC 7644 §3.4.2.4 coercion/clamping, §3.3/§3.9 selection
 * splitting, unsupported-param rejections). This pipe is a *delegating*
 * wrapper, so:
 * - the adapter keeps its direct, unit-tested API (no double sources of
 *   truth for parsing rules),
 * - controllers receive a typed `ParsedListQuery`,
 * - `ScimError`s thrown at parse time (400 invalidFilter / 501 sorting)
 *   bubble through the same §3.12 exception filter unchanged.
 *
 * Instantiated by Nest as a CLASS REFERENCE (`@Query(ScimListQueryPipe)`),
 * which enables the constructor `@Inject(ScimUserAdapter)`.
 */
import { Inject, PipeTransform } from '@nestjs/common';
import { ParsedListQuery, ScimUserAdapter } from './scim-user-adapter';

export class ScimListQueryPipe implements PipeTransform<unknown, ParsedListQuery> {
  constructor(@Inject(ScimUserAdapter) private readonly adapter: ScimUserAdapter<unknown>) {}

  transform(raw: unknown): ParsedListQuery {
    return this.adapter.parseListQuery(raw);
  }
}
