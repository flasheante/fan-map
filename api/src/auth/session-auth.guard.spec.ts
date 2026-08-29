import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SessionAuthGuard } from './session-auth.guard';
import { SessionService } from './session.service';
import { SESSION_COOKIE_NAME } from './auth.constants';

function makeContext(signedCookies: Record<string, unknown>): ExecutionContext {
  const request: Record<string, unknown> = { signedCookies };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('SessionAuthGuard', () => {
  let guard: SessionAuthGuard;
  let sessions: { validate: jest.Mock };

  const user = { id: 'user-1', email: 'fan@example.com' };

  beforeEach(() => {
    sessions = { validate: jest.fn() };
    guard = new SessionAuthGuard(sessions as unknown as SessionService);
  });

  it('allows the request and attaches request.user for a valid session cookie', async () => {
    sessions.validate.mockResolvedValue(user);
    const context = makeContext({ [SESSION_COOKIE_NAME]: 'session-1' });

    const allowed = await guard.canActivate(context);

    expect(allowed).toBe(true);
    expect(sessions.validate).toHaveBeenCalledWith('session-1');
    const request = context.switchToHttp().getRequest<{
      user?: unknown;
      sessionId?: string;
    }>();
    expect(request.user).toEqual(user);
    expect(request.sessionId).toBe('session-1');
  });

  it('rejects a request with no session cookie at all', async () => {
    const context = makeContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(sessions.validate).not.toHaveBeenCalled();
  });

  it('rejects a request whose cookie signature failed verification', async () => {
    // cookie-parser sets signedCookies[name] = false (not undefined) when
    // the signature doesn't match — a tampered/forged cookie value.
    const context = makeContext({ [SESSION_COOKIE_NAME]: false });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(sessions.validate).not.toHaveBeenCalled();
  });

  it('rejects a request whose session is invalid or expired', async () => {
    sessions.validate.mockResolvedValue(null);
    const context = makeContext({ [SESSION_COOKIE_NAME]: 'expired-session' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
