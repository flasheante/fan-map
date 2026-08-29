import type { Request } from 'express';
import type { PublicUser } from '../session.service';

// Request enriquecido por SessionAuthGuard (ver session-auth.guard.ts) con
// el User público resuelto de la cookie de sesión.
//
// Se usa una intersección explícita en vez de `declare global { namespace
// Express { interface Request {...} } }`: esa augmentation global solo la
// ve `tsc`/`nest build`, que compila todo `src/`, no ts-node al correr un
// script suelto (scripts/seed-demo.ts, src/cli/sync-setlist-fm.ts) — ahí
// solo se type-checkea el grafo de imports de ese entrypoint, y si nada en
// ese grafo importa este .d.ts explícitamente, `request.user`/`.sessionId`
// quedan sin tipar y rompen esos scripts.
export type AuthenticatedRequest = Request & {
  user?: PublicUser;
  sessionId?: string;
};
