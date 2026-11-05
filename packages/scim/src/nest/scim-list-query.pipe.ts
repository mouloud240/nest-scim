/**
 * Controller-bound list/query pipe — a delegating wrapper: the adapter's
 * `parseListQuery` is the single interpretation point, controllers get a
 * typed `ParsedListQuery`, and parse-time ScimErrors bubble through the
 * §3.12 exception filter unchanged. Bound by class reference
 * (`@Query(ScimListQueryPipe)`), which enables the DI constructor.
 */
import { Inject, PipeTransform } from '@nestjs/common';
import { ParsedListQuery, ScimUserAdapter } from './scim-user-adapter';

export class ScimListQueryPipe implements PipeTransform<unknown, ParsedListQuery> {
  constructor(@Inject(ScimUserAdapter) private readonly adapter: ScimUserAdapter<unknown>) {}

  transform(raw: unknown): ParsedListQuery {
    return this.adapter.parseListQuery(raw);
  }
}
