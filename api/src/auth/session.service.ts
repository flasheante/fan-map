import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

// Forma pública mínima de User que puede llegar a request.user / al cuerpo
// de /auth/me — nunca el modelo Prisma completo (ver validate() abajo).
export interface PublicUser {
  id: string;
  email: string;
}

// Sesión server-side persistida en Postgres (tabla `sessions`, ver
// schema.prisma): el id de la fila es el propio token opaco que viaja en
// la cookie httpOnly (SESSION_COOKIE_NAME, ver auth.constants.ts) — no hay
// JWT ni ningún estado de sesión fuera de esta tabla, así que invalidar
// una sesión (logout) es simplemente borrar la fila. `maxAgeMs` se inyecta
// desde AuthModule (que sí lee SESSION_MAX_AGE de env), no se lee acá
// adentro, para que esta clase sea trivial de testear con un valor fijo.
@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly maxAgeMs: number,
  ) {}

  async create(userId: string) {
    return this.prisma.session.create({
      data: {
        userId,
        expiresAt: new Date(Date.now() + this.maxAgeMs),
      },
    });
  }

  // Devuelve el usuario público de una sesión vigente, o null si no existe
  // o ya expiró. Una sesión expirada se borra en el momento en que se la
  // encuentra (limpieza perezosa) en vez de depender de un job aparte.
  async validate(sessionId: string): Promise<PublicUser | null> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session) return null;

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.session.deleteMany({ where: { id: sessionId } });
      return null;
    }

    return { id: session.user.id, email: session.user.email };
  }

  // deleteMany (no delete) para que invalidar una sesión que ya no existe
  // —doble logout, sesión ya expirada y limpiada— sea un no-op en vez de
  // lanzar.
  async invalidate(sessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: sessionId } });
  }
}
