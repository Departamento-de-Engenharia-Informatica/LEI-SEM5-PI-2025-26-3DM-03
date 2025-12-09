import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from './types';

@Injectable()
export class IamAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const user = this.buildUserFromRequest(req);

    if (!user || (!user.userId && !user.email)) {
      throw new UnauthorizedException('Missing authenticated user context');
    }

    (req as Request & { user: AuthenticatedUser }).user = user;
    return true;
  }

  private buildUserFromRequest(req: Request): AuthenticatedUser | null {
    const header = (key: string) => this.normalizeString(req.headers[key]);

    const body = this.extractBodyAuth(req.body);

    const userId = header('x-app-user-id') ?? body?.userId ?? body?.id;
    const email = header('x-app-email') ?? body?.email;
    const name = header('x-app-name') ?? body?.name;
    const tenantId = header('x-app-tenant-id') ?? body?.tenantId;

    const rolesFromHeader = this.normalizeRoles(req.headers['x-app-roles']);
    const roles = rolesFromHeader.length ? rolesFromHeader : this.normalizeRoles(body?.roles ?? body?.role);

    const attributes: Record<string, unknown> = {};
    const audience = header('x-app-audience') ?? body?.audience;
    if (audience) attributes.audience = audience;
    if (body?.attributes && typeof body.attributes === 'object') {
      Object.assign(attributes, body.attributes as Record<string, unknown>);
    }

    return {
      userId: userId ?? undefined,
      email: email ?? undefined,
      name: name ?? undefined,
      tenantId: tenantId ?? undefined,
      roles,
      attributes: Object.keys(attributes).length ? attributes : undefined,
    };
  }

  private normalizeString(value: unknown): string | undefined {
    if (Array.isArray(value)) {
      const first = value.find((v) => typeof v === 'string' && v.trim().length > 0);
      return typeof first === 'string' ? first.trim() : undefined;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length ? trimmed : undefined;
    }
    return undefined;
  }

  private normalizeRoles(source: unknown): string[] {
    if (!source) return [];

    const fromArray = (arr: unknown[]) =>
      arr
        .map((value) => (typeof value === 'string' ? value.trim() : undefined))
        .filter((role): role is string => !!role);

    if (Array.isArray(source)) {
      return Array.from(new Set(fromArray(source)));
    }

    if (typeof source === 'string') {
      const raw = source.trim();
      if (!raw) return [];

      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return Array.from(new Set(fromArray(parsed)));
        }
      } catch {
        // ignore json parse failures
      }

      return Array.from(
        new Set(
          raw
            .split(/[;,]/)
            .map((part) => part.trim())
            .filter((role) => role.length > 0),
        ),
      );
    }

    if (typeof source === 'object') {
      const candidate = (source as Record<string, unknown>).roles ?? (source as Record<string, unknown>).role;
      return this.normalizeRoles(candidate);
    }

    return [];
  }

  private extractBodyAuth(body: unknown):
    | (Record<string, unknown> & {
        userId?: string;
        id?: string;
        email?: string;
        name?: string;
        tenantId?: string;
        roles?: unknown;
        role?: unknown;
        attributes?: unknown;
        audience?: unknown;
      })
    | undefined {
    if (!body || typeof body !== 'object') {
      return undefined;
    }

    const root = body as Record<string, unknown>;
    const candidate = root.__auth ?? root.auth ?? root.user ?? root.identity;

    if (candidate && typeof candidate === 'object') {
      return candidate as Record<string, unknown>;
    }

    const looksLikeAuth = ['userId', 'id', 'email', 'roles', 'role'].some((key) => key in root);
    return looksLikeAuth ? root : undefined;
  }
}
