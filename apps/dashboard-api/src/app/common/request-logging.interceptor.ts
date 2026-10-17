import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<FastifyRequest>();
    const res = http.getResponse<FastifyReply>();

    const requestId =
      (req.headers['x-request-id'] as string) ||
      (req.headers['x-correlation-id'] as string) ||
      (req as unknown as { id?: string }).id;

    if (requestId && res.header) {
      res.header('x-request-id', requestId);
    }

    const start = Date.now();
    const method = req.method;
    const url = req.url;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          const statusCode = res.statusCode || 200;
          this.logger.log(
            `[${requestId || '-'}] ${method} ${url} ${statusCode} +${duration}ms`
          );
        },
        error: (err) => {
          const duration = Date.now() - start;
          const statusCode = err?.status || err?.statusCode || res.statusCode || 500;
          this.logger.error(
            `[${requestId || '-'}] ${method} ${url} ${statusCode} +${duration}ms - ${err?.message}`
          );
        },
      })
    );
  }
}
