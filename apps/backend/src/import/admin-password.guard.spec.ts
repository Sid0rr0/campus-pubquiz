import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { AdminPasswordGuard } from '@/import/admin-password.guard';

function contextWithHeaders(
  headers: Record<string, unknown>,
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

describe('AdminPasswordGuard', () => {
  const guard = new AdminPasswordGuard();
  const originalPassword = process.env.ADMIN_PASSWORD;

  beforeEach(() => {
    process.env.ADMIN_PASSWORD = 'quizmaster';
  });

  afterAll(() => {
    process.env.ADMIN_PASSWORD = originalPassword;
  });

  it('allows a request with the correct x-admin-password header', () => {
    const context = contextWithHeaders({ 'x-admin-password': 'quizmaster' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects a request with a wrong password', () => {
    const context = contextWithHeaders({ 'x-admin-password': 'nope' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects a request without the header', () => {
    expect(() => guard.canActivate(contextWithHeaders({}))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an empty password even if the server password is empty', () => {
    process.env.ADMIN_PASSWORD = '';
    const context = contextWithHeaders({ 'x-admin-password': '' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects everything when the server has no password configured', () => {
    delete process.env.ADMIN_PASSWORD;
    const context = contextWithHeaders({ 'x-admin-password': 'quizmaster' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
