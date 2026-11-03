/**
 * Global SCIM exception mapping — RFC 7644 §3.12
 * (docs/rfc/rfc7644.txt §3.12: implementers MUST return errors in the body
 * in JSON format using the ErrorResponse schema; Table 8 → statuses,
 * Table 9 → detail keywords).
 *
 * Every error leaving the SCIM controllers — including foreign framework
 * errors and bugs — is converted to the §3.12 wire shape here, so IdPs
 * never receive express/fastify HTML error pages under the SCIM base
 * path. Unknown/5xx-level causes are logged server-side but NEVER leak
 * into the response (RFC 7643 §5-sensitive detail discipline).
 */
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { isScimError } from '../core/errors/scim-error';
import { ScimErrorResponse, toErrorBody } from '../core/errors/body';
import { ERROR_SCHEMA_URI } from '../core/errors/body';
import { writeScimJson } from './scim-content';

/** Generic replacement sentence for ANY unhandled non-Scim error. */
export const INTERNAL_ERROR_DETAIL = 'An internal error occurred. The incident has been logged.';

@Catch()
export class ScimExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ScimExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const [status, body] = this.mapToScimError(exception);

    writeScimJson(host.switchToHttp().getResponse(), status, body);
  }

  /**
   * Maps ANY throwable into a §3.12 status + body pair:
   * - `ScimError` → its own status + crafted body (Table 9 shapes),
   * - foreign `HttpException` (framework routing/validation 4xx) → its
   *   HTTP status and message, NO scimType (§3.12: the keyword carries
   *   meaning only for the Table 9 set),
   * - anything else → 500 with a generic detail; the cause is logged and
   *   hidden from the wire.
   */
  private mapToScimError(exception: unknown): [number, ScimErrorResponse] {
    if (isScimError(exception)) {
      return [exception.status, toErrorBody(exception)];
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return [status, { schemas: [ERROR_SCHEMA_URI], status: String(status), detail: exception.message }];
    }

    // Not a ScimError, not an HttpException: a library-filter-external
    // bug. Log loudly (cause preserved server-side), respond generically.
    this.logger.error(
      exception instanceof Error ? exception.stack ?? exception.message : String(exception),
    );
    return [500, { schemas: [ERROR_SCHEMA_URI], status: '500', detail: INTERNAL_ERROR_DETAIL }];
  }
}
