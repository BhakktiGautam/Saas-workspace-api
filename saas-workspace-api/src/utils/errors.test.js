'use strict';

const {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} = require('./errors');

describe('custom API errors', () => {
  it('keeps optional validation details on AppError responses', () => {
    const details = [{field: 'email', message: 'Email must be valid'}];
    const error = new ValidationError(undefined, details);

    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(422);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Request validation failed. Check the highlighted fields and try again.');
    expect(error.details).toEqual(details);
  });

  it('uses helpful default messages for common API errors', () => {
    expect(new AuthenticationError().message).toBe('Please sign in to continue.');
    expect(new AuthorizationError().message).toContain('Contact an organization owner');
    expect(new NotFoundError('Project').message).toBe('The requested project could not be found.');
    expect(new ConflictError().message).toContain('conflicts with an existing record');
    expect(new RateLimitError().message).toBe('Too many requests. Please wait a moment and try again.');
  });
});
