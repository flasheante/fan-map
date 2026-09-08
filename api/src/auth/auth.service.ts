import { Injectable, UnauthorizedException } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { GoogleIdentity } from './interfaces/google-identity.interface';

// Traduce una identidad OAuth (hoy solo Google) a nuestro User. Es la única
// pieza de Auth que toca la tabla `users` — GoogleOAuthClient no sabe que
// Prisma existe, y SessionService no sabe que Google existe.
@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  // Busca el User por email; lo crea si no existe. Usa upsert (no
  // findUnique + create) para que la unicidad de email sea atómica a nivel
  // de base de datos: dos callbacks de login concurrentes con el mismo
  // email no pueden crear dos filas. `googleId` sigue deliberadamente
  // fuera de User (no lo pide ninguna etapa todavía) — `emailVerified` ya
  // filtra la única cuenta insegura relevante: un email no verificado por
  // Google.
  //
  // `googlePhotoUrl` sí se persiste, y se refresca en cada login (a
  // diferencia de email, que nunca cambia acá): una foto de perfil de
  // Google puede cambiar entre logins, así que `update` también la
  // escribe, no solo `create`.
  async findOrCreateFromGoogle(identity: GoogleIdentity): Promise<User> {
    if (!identity.emailVerified) {
      throw new UnauthorizedException('Google account email is not verified');
    }

    return this.prisma.user.upsert({
      where: { email: identity.email },
      update: { googlePhotoUrl: identity.photoUrl },
      create: { email: identity.email, googlePhotoUrl: identity.photoUrl },
    });
  }
}
