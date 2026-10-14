import { describe, it, expect, vi } from 'vitest';
import { HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';
import { ArgumentsHost } from '@nestjs/common';

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  it('should format HttpException with message and code', () => {
    const mockSend = vi.fn();
    const mockStatus = vi.fn().mockReturnValue({ send: mockSend });
    const mockHost = {
      switchToHttp: () => ({
        getResponse: () => ({
          status: mockStatus,
        }),
      }),
    } as unknown as ArgumentsHost;

    const exception = new BadRequestException('Invalid query parameter');
    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockSend).toHaveBeenCalledWith({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'Invalid query parameter',
    });
  });

  it('should handle validation array errors', () => {
    const mockSend = vi.fn();
    const mockStatus = vi.fn().mockReturnValue({ send: mockSend });
    const mockHost = {
      switchToHttp: () => ({
        getResponse: () => ({
          status: mockStatus,
        }),
      }),
    } as unknown as ArgumentsHost;

    const exception = new BadRequestException(['metric must be a string', 'metric should not be empty']);
    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockSend).toHaveBeenCalledWith({
      statusCode: 400,
      code: 'BAD_REQUEST',
      message: 'Validation failed',
      details: ['metric must be a string', 'metric should not be empty'],
    });
  });

  it('should format generic unhandled errors as INTERNAL_SERVER_ERROR', () => {
    const mockSend = vi.fn();
    const mockStatus = vi.fn().mockReturnValue({ send: mockSend });
    const mockHost = {
      switchToHttp: () => ({
        getResponse: () => ({
          status: mockStatus,
        }),
      }),
    } as unknown as ArgumentsHost;

    const exception = new Error('Disk read failure');
    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockSend).toHaveBeenCalledWith({
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    });
  });
});
