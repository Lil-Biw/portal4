import { Injectable, CanActivate, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

// ── Decoradores ──────────────────────────────────────────────────────────────

export const ROLES_KEY      = 'roles';
export const PERMISO_KEY    = 'permiso_requerido';
export const IS_PUBLIC_KEY  = 'isPublic';

export const Roles          = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
export const RequierePermiso = (tipo: 'ver' | 'editar') => SetMetadata(PERMISO_KEY, tipo);
export const Public         = () => SetMetadata(IS_PUBLIC_KEY, true);

// ── JwtAuthGuard ─────────────────────────────────────────────────────────────
// Valida el token JWT del header Authorization: Bearer <token>.
// Las rutas marcadas con @Public() quedan exentas.

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) { super(); }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}

// ── RolesGuard ───────────────────────────────────────────────────────────────
// Verifica que el rol del usuario coincida con los @Roles() del endpoint.
// super_admin siempre tiene acceso. Si no hay @Roles(), permite el acceso.

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;

    const user = context.switchToHttp().getRequest().user;
    if (!user) return false;
    if (user.rol === 'super_admin') return true;
    return roles.includes(user.rol);
  }
}

// ── PermisosGuard ─────────────────────────────────────────────────────────────
// Verifica el nivel de permiso del usuario (@RequierePermiso).
// super_admin siempre tiene acceso. 'ver' permite ambos niveles.

@Injectable()
export class PermisosGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permiso = this.reflector.getAllAndOverride<string>(PERMISO_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permiso) return true;

    const user = context.switchToHttp().getRequest().user;
    if (!user) return false;
    if (user.rol === 'super_admin') return true;
    if (permiso === 'ver') return true;
    return user.permiso_acceso === 'editar';
  }
}

// ── EmpresaAccessGuard ────────────────────────────────────────────────────────────
// Verifica que el usuario tenga acceso al :empresaId del route param.
// super_admin tiene acceso a todo. Usuarios normales solo a su propia empresa.
// Si la ruta no tiene :empresaId el guard deja pasar (para rutas sin contexto).

@Injectable()
export class EmpresaAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) return false;
    if (user.rol === 'super_admin') return true;
    const empresaId = req.params['empresaId'];
    if (!empresaId) return true;
    return String(user.cliente_id) === String(empresaId);
  }
}
