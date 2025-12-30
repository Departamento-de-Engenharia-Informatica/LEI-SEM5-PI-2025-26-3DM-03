import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthenticatedUser } from './types';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (requiredRoles.length === 0) {
      return true;
    }
    const req = context.switchToHttp().getRequest<Request>();
    const user = (req as Request & { user?: AuthenticatedUser }).user;
    if (!user) {
      throw new UnauthorizedException('User context missing');
    }
    const userRoles = new Set(
      (user.roles ?? []).map((role) => role.toString().trim().toLowerCase()).filter((role) => role.length > 0),
    );

    const required = requiredRoles.map((role) => role.trim().toLowerCase()).filter((role) => role.length > 0);

    const hasAnyRequiredRole = required.some((role) => userRoles.has(role));

    if (!hasAnyRequiredRole) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
