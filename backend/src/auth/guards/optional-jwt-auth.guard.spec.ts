import { ExecutionContext } from '@nestjs/common';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

const makeContext = (authorization?: string) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        headers: authorization ? { authorization } : {},
      }),
    }),
  }) as ExecutionContext;

describe('OptionalJwtAuthGuard', () => {
  it('allows a request with no Authorization header', () => {
    const guard = new OptionalJwtAuthGuard();

    expect(guard.canActivate(makeContext())).toBe(true);
  });

  it('delegates a supplied token to the regular passport JWT guard', () => {
    const guard = new OptionalJwtAuthGuard();
    const parentPrototype = Object.getPrototypeOf(OptionalJwtAuthGuard.prototype);
    const delegate = jest
      .spyOn(parentPrototype, 'canActivate')
      .mockReturnValue(true);

    expect(guard.canActivate(makeContext('Bearer token'))).toBe(true);
    expect(delegate).toHaveBeenCalledTimes(1);

    delegate.mockRestore();
  });
});
