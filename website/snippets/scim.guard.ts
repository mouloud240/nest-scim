import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';

@Injectable()
export class ScimBearerGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    // Replace this placeholder with verified token validation. Deny by default.
    return false;
  }
}
