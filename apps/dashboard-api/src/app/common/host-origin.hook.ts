import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getSecurityConfig } from './security.config';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerHostOriginHook(fastify: any): void {
  fastify.addHook(
    'onRequest',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const config = getSecurityConfig();

      // 1. Host header validation (protects against DNS rebinding)
      const hostHeader = request.headers['host'];
      if (hostHeader) {
        const hostLower = hostHeader.toLowerCase();
        const hostNameOnly = hostLower.split(':')[0];
        const isHostAllowed = config.allowedHosts.some((allowed) => {
          const allowedLower = allowed.toLowerCase();
          if (allowedLower.includes(':')) {
            return hostLower === allowedLower;
          }
          return hostNameOnly === allowedLower;
        });
        if (!isHostAllowed) {
          return reply.code(403).send({
            statusCode: 403,
            error: 'Forbidden',
            message: `Host '${hostHeader}' is not allowed`,
          });
        }
      }

      // 2. Origin header validation (protects against untrusted web contexts)
      const originHeader = request.headers['origin'];
      if (originHeader) {
        const isOriginAllowed = config.allowedOrigins.some(
          (allowed) => originHeader.toLowerCase() === allowed.toLowerCase()
        );
        if (!isOriginAllowed) {
          return reply.code(403).send({
            statusCode: 403,
            error: 'Forbidden',
            message: `Origin '${originHeader}' is not allowed`,
          });
        }
      }
    }
  );
}
