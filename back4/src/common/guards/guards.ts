// ─── JwtAuthGuard ────────────────────────────────────────────────────────────
// Protege cualquier endpoint que requiera sesión activa.
// Uso: @UseGuards(JwtAuthGuard)

// Guards neutralizados para pruebas de BD.
// Estas implementaciones permiten el acceso a todos los endpoints
// sin realizar verificación de autenticación ni autorización.

import { Injectable, CanActivate, SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const PERMISO_KEY = 'permiso_requerido';
export const RequierePermiso = (tipo: 'ver' | 'editar') => SetMetadata(PERMISO_KEY, tipo);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}

@Injectable()
export class PermisosGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}
