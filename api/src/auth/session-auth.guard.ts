import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SessionService } from './session.service';
import { SESSION_COOKIE_NAME } from './auth.constants';
import type { AuthenticatedRequest } from './interfaces/authenticated-request.interface';

// Guard reutilizable (@UseGuards(SessionAuthGuard)) que resuelve
// request.user a partir de la cookie de sesión firmada — el resto de la
// app trabaja con nuestro User (id, email), nunca con Google ni con el id
// de sesión crudo. cookie-parser deja `false` en signedCookies[name]
// cuando la firma no matchea (cookie manipulada): `!sessionId` cubre tanto
// "no vino cookie" como "vino pero es inválida", sin distinguir el motivo
// al cliente (401 en ambos casos).
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const sessionId = request.signedCookies?.[SESSION_COOKIE_NAME] as
      | string
      | false
      | undefined;

    if (!sessionId) {
      throw new UnauthorizedException();
    }

    const user = await this.sessions.validate(sessionId);
    if (!user) {
      throw new UnauthorizedException();
    }

    request.user = user;
    request.sessionId = sessionId;
    return true;
  }
}
