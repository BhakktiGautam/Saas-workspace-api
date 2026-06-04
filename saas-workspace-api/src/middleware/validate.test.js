'use strict';

const validate = require('./validate');
const { paginationSchema } = require('../validators/schemas');

describe('validate middleware', () => {
  function runValidation(query) {
    const req = { query };
    const next = jest.fn();

    validate(paginationSchema, 'query')(req, {}, next);

    return { req, next };
  }

  it('applies pagination defaults and coerces numeric query strings', () => {
    const { req, next } = runValidation({ page: '2', limit: '10' });

    expect(next).toHaveBeenCalledWith();
    expect(req.query).toEqual({ page: 2, limit: 10 });
  });

  it('uses default pagination values when page and limit are omitted', () => {
    const { req, next } = runValidation({});

    expect(next).toHaveBeenCalledWith();
    expect(req.query).toEqual({ page: 1, limit: 20 });
  });

  it('returns a validation error for invalid pagination values', () => {
    const { next } = runValidation({ page: '0', limit: '101' });

    expect(next).toHaveBeenCalledTimes(1);
    const [error] = next.mock.calls[0];
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.statusCode).toBe(422);
    expect(error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'page' }),
        expect.objectContaining({ field: 'limit' }),
      ])
    );
  });
});
