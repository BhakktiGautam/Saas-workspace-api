'use strict';

jest.mock('../utils/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../config', () => ({
  isProduction: false,
  isDevelopment: false,
}));

class MockPrismaClientKnownRequestError extends Error {
  constructor(message, {code, meta}) {
    super(message);
    this.code = code;
    this.meta = meta;
  }
}

class MockPrismaClientValidationError extends Error {}

jest.mock('@prisma/client', () => ({
  Prisma: {
    PrismaClientKnownRequestError: MockPrismaClientKnownRequestError,
    PrismaClientValidationError: MockPrismaClientValidationError,
  },
}));

const {Prisma} = require('@prisma/client');
const errorHandler = require('./errorHandler');
const {ValidationError} = require('../utils/errors');

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

const request = {
  path: '/test',
  method: 'POST',
};

describe('errorHandler', () => {
  it('returns operational error details with the helpful message', () => {
    const details = [{field: 'name', message: 'Name is required'}];
    const error = new ValidationError(undefined, details);
    const response = createResponse();

    errorHandler(error, request, response, jest.fn());

    expect(response.status).toHaveBeenCalledWith(422);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      error: {
        message: 'Request validation failed. Check the highlighted fields and try again.',
        code: 'VALIDATION_ERROR',
        details,
      },
    });
  });

  it('turns Prisma unique constraint errors into actionable conflict messages', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.10.0',
      meta: {target: ['email']},
    });
    const response = createResponse();

    errorHandler(error, request, response, jest.fn());

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      error: {
        message: 'A record with this email already exists. Use a different email and try again.',
        code: 'CONFLICT',
      },
    });
  });
});
