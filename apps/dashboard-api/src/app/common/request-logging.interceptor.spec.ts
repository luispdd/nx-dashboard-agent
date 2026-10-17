import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { RequestLoggingInterceptor } from './request-logging.interceptor';

describe('RequestLoggingInterceptor', () => {
  let interceptor: RequestLoggingInterceptor;
  let logSpy: any;
  let errorSpy: any;

  beforeEach(() => {
    interceptor = new RequestLoggingInterceptor();
    logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('should echo x-request-id and log successful requests', async () => {
    const mockRequest = {
      headers: { 'x-request-id': 'test-run-trace-123' },
      method: 'GET',
      url: '/api/metrics',
    };
    const mockResponse = {
      statusCode: 200,
      header: vi.fn(),
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;

    const mockHandler: CallHandler = {
      handle: () => of({ success: true }),
    };

    await new Promise<void>((resolve) => {
      interceptor.intercept(mockContext, mockHandler).subscribe({
        next: (val) => {
          expect(val).toEqual({ success: true });
        },
        complete: () => {
          resolve();
        },
      });
    });

    expect(mockResponse.header).toHaveBeenCalledWith(
      'x-request-id',
      'test-run-trace-123'
    );
    expect(logSpy).toHaveBeenCalled();
    const logCall = logSpy.mock.calls[0][0];
    expect(logCall).toContain('[test-run-trace-123]');
    expect(logCall).toContain('GET /api/metrics 200');
  });

  it('should handle errors and log error with request id', async () => {
    const mockRequest = {
      headers: { 'x-request-id': 'err-trace-456' },
      method: 'POST',
      url: '/api/chat',
    };
    const mockResponse = {
      statusCode: 500,
      header: vi.fn(),
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;

    const mockHandler: CallHandler = {
      handle: () => throwError(() => new Error('Boom')),
    };

    await new Promise<void>((resolve) => {
      interceptor.intercept(mockContext, mockHandler).subscribe({
        error: (err) => {
          expect(err.message).toBe('Boom');
          resolve();
        },
      });
    });

    expect(mockResponse.header).toHaveBeenCalledWith(
      'x-request-id',
      'err-trace-456'
    );
    expect(errorSpy).toHaveBeenCalled();
    const errorCall = errorSpy.mock.calls[0][0];
    expect(errorCall).toContain('[err-trace-456]');
    expect(errorCall).toContain('POST /api/chat 500');
    expect(errorCall).toContain('Boom');
  });
});
