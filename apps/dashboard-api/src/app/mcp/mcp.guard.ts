import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { getMcpConfig } from './mcp.config';

@Injectable()
export class McpGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const config = getMcpConfig();

    if (!config.enabled) {
      throw new NotFoundException('MCP server is disabled');
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();

    // 1. Origin verification
    if (config.allowedOrigins && config.allowedOrigins.length > 0) {
      const origin = request.headers['origin'] as string | undefined;
      if (origin && !config.allowedOrigins.includes(origin)) {
        throw new ForbiddenException(
          `Origin '${origin}' is not allowed for MCP requests`
        );
      }
    }

    // 2. Authentication token verification
    if (config.authToken) {
      const authHeader = request.headers['authorization'];
      if (!authHeader || authHeader !== `Bearer ${config.authToken}`) {
        throw new UnauthorizedException(
          'Unauthorized: Invalid or missing MCP bearer token'
        );
      }
    }

    return true;
  }
}
