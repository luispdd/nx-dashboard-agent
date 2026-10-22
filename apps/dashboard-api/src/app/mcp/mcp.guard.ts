import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { getMcpConfig } from './mcp.config';
import { getSecurityConfig } from '../common/security.config';

@Injectable()
export class McpGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const config = getMcpConfig();

    if (!config.enabled) {
      throw new NotFoundException('MCP server is disabled');
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const securityConfig = getSecurityConfig();

    // 1. Host verification (DNS rebinding protection)
    const host = request.headers['host'];
    if (host) {
      const hostLower = host.toLowerCase();
      const hostNameOnly = hostLower.split(':')[0];
      const isHostAllowed = securityConfig.allowedHosts.some((allowed) => {
        const allowedLower = allowed.toLowerCase();
        if (allowedLower.includes(':')) {
          return hostLower === allowedLower;
        }
        return hostNameOnly === allowedLower;
      });
      if (!isHostAllowed) {
        throw new ForbiddenException(
          `Host '${host}' is not allowed for MCP requests`
        );
      }
    }

    // 2. Origin verification (enforced whenever Origin header is present)
    const origin = request.headers['origin'] as string | undefined;
    if (origin) {
      const effectiveAllowedOrigins =
        config.allowedOrigins && config.allowedOrigins.length > 0
          ? config.allowedOrigins
          : securityConfig.allowedOrigins;

      const isOriginAllowed = effectiveAllowedOrigins.some(
        (allowed) => origin.toLowerCase() === allowed.toLowerCase()
      );

      if (!isOriginAllowed) {
        throw new ForbiddenException(
          `Origin '${origin}' is not allowed for MCP requests`
        );
      }
    }

    // 3. Authentication token verification (constant-time comparison)
    if (config.authToken) {
      const authHeader = request.headers['authorization'];
      const expectedHeader = `Bearer ${config.authToken}`;

      if (
        !authHeader ||
        typeof authHeader !== 'string' ||
        authHeader.length !== expectedHeader.length ||
        !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedHeader))
      ) {
        throw new UnauthorizedException(
          'Unauthorized: Invalid or missing MCP bearer token'
        );
      }
    }

    return true;
  }
}
