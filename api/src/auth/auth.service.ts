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
  // email no pueden crear dos filas. Solo se persiste `email` — ni
  // googleId ni ningún otro dato de Google entra al modelo User en esta
  // etapa (ver decisión en el informe final: el email alcanza para
  // encontrar/crear el User que pide esta etapa, y `emailVerified` ya
  // filtra la única cuenta insegura relevante: un email no verificado por
  // Google).
  async findOrCreateFromGoogle(identity: GoogleIdentity): Promise<User> {
    if (!identity.emailVerified) {
      throw new UnauthorizedException('Google account email is not verified');
    }

    return this.prisma.user.upsert({
      where: { email: identity.email },
      update: {},
      create: { email: identity.email },
    });
  }
}
