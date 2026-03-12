import { HttpException, HttpStatus } from '@nestjs/common';
import { GlobalExceptionFilter } from '../../../src/core/telemetry/global-exception.filter';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: any;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockRequest = {
      method: 'GET',
      originalUrl: '/api/v1/test',
      correlationId: 'test-corr-id',
      user: { tenantId: 'tenant-1' },
    };
    mockHost = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    };
  });

  it('should handle HttpException and return correct status', () => {
    const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);

    filter.catch(exception, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        message: 'Not Found',
        correlationId: 'test-corr-id',
      }),
    );
  });

  it('should handle unknown errors as 500 with safe message', () => {
    const exception = new Error('database connection lost');

    filter.catch(exception, mockHost as any);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Internal server error', // Safe message, not the original
        correlationId: 'test-corr-id',
      }),
    );
  });

  it('should include timestamp in response', () => {
    filter.catch(new Error('test'), mockHost as any);

    const response = mockResponse.json.mock.calls[0][0];
    expect(response.timestamp).toBeDefined();
    expect(new Date(response.timestamp).getTime()).not.toBeNaN();
  });
});
