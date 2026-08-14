import { Injectable, CanActivate, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { permisosPorDefectoSegunRol } from '../permisos-defaults';

// ── Decoradores ──────────────────────────────────────────────────────────────

export const ROLES_KEY      = 'roles';
export const PERMISO_KEY    = 'permiso_requerido';
export const IS_PUBLIC_KEY  = 'isPublic';
export const PERMISO_ACCION_KEY = 'permiso_accion_requerido';

export const Roles          = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
export const RequierePermiso = (tipo: 'ver' | 'editar') => SetMetadata(PERMISO_KEY, tipo);
export const Public         = () => SetMetadata(IS_PUBLIC_KEY, true);

// Permiso granular de acción por módulo (catálogo PERM_SCHEMA del frontend:
// front4/src/app/shared/models/permisos.model.ts). Reemplaza a @Roles() en los
// endpoints de "acción" (crear/editar/eliminar/subir/...) de cada módulo: la
// decisión pasa a depender de usuario.permisos[seccion][accion], no del rol.
export const RequiereAccion = (seccion: string, accion: string) =>
  SetMetadata(PERMISO_ACCION_KEY, { seccion, accion });

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
// Las rutas marcadas con @Public() quedan exentas (igual criterio que JwtAuthGuard).

@Injectable()
export class EmpresaAccessGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) return false;
    if (user.rol === 'super_admin' || user.rol === 'admin_smartclarity') return true;
    const empresaId = req.params['empresaId'];
    if (!empresaId) return true;
    return String(user.cliente_id) === String(empresaId);
  }
}

// ── PermisoAccionGuard ──────────────────────────────────────────────────────
// Verifica el catálogo granular de permisos por acción (@RequiereAccion).
// super_admin siempre tiene acceso. Si el endpoint no tiene @RequiereAccion(),
// deja pasar (el control de acceso de ese endpoint sigue siendo @Roles()).
// El objeto `permisos` no viaja en el JWT (cambia sin re-login), así que se
// resuelve leyendo el usuario desde la base en cada request y se deja cacheado
// en req.user.permisos por si el controller necesita revisarlo de nuevo
// (ej. usuarios.crearAdmin dentro de UsuariosController.create()).
@Injectable()
export class PermisoAccionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectModel('Usuario') private usuarioModel: Model<{ rol: string; permisos?: Record<string, Record<string, boolean>> }>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<{ seccion: string; accion: string }>(PERMISO_ACCION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!meta) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) return false;
    if (user.rol === 'super_admin') return true;

    const usuario = await this.usuarioModel.findById(user.sub).select('permisos').lean();
    req.user.permisos = usuario?.permisos ?? {};

    // Un valor explícito (true/false) mandó: si el admin configuró la acción a
    // mano, se respeta tal cual. Si la clave NO está en `usuario.permisos`
    // (p. ej. una acción nueva que se agregó al catálogo después de que ese
    // usuario se configuró), se cae al default del rol. Sin este fallback, las
    // acciones nuevas dejarían bloqueadas a todas las cuentas existentes hasta
    // que alguien toque el modal de Permisos.
    const valor = req.user.permisos?.[meta.seccion]?.[meta.accion];
    if (typeof valor === 'boolean') return valor;
    return permisosPorDefectoSegunRol(user.rol)?.[meta.seccion]?.[meta.accion] === true;
  }
}
