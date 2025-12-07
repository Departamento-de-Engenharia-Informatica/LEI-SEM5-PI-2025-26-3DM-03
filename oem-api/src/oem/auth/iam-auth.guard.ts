import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from './types';

@Injectable()
export class IamAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const rolesHeader = req.headers['x-roles'];
    const permissionsHeader = req.headers['x-permissions'];
    const tenantId = req.headers['x-tenant-id'];
    const attributesHeader = req.headers['x-attributes'];

    const user: AuthenticatedUser = {
      token: authHeader.substring(7),
      roles: typeof rolesHeader === 'string' ? rolesHeader.split(',') : [],
      permissions: typeof permissionsHeader === 'string' ? permissionsHeader.split(',') : [],
      tenantId: typeof tenantId === 'string' ? tenantId : undefined,
      attributes: typeof attributesHeader === 'string' ? attributesHeader : undefined,
    };

    (req as Request & { user: AuthenticatedUser }).user = user;
    return true;
  }
}
