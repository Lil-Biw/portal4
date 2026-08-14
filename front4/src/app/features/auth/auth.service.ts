import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ProfileService } from '../../profile/profile.service';
import { PermisosUsuario, permisosPorDefectoSegunRol } from '../../shared/models/permisos.model';
import type { RolUsuario } from '../../shared/models/usuario.model';

export interface UsuarioAuth {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  cliente_id: string | null;
  debe_cambiar_password: boolean;
  permisos?: PermisosUsuario;
}

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly profileService = inject(ProfileService);

  readonly usuarioActual = signal<UsuarioAuth | null>(this.cargarUsuario());
  readonly estaAutenticado = computed(() => this.usuarioActual() !== null);
  readonly cargando = signal(false);
  readonly error = signal('');

  login(email: string, password: string, perfil: 'admin' | 'consumidor'): void {
    this.cargando.set(true);
    this.error.set('');
    this.http
      .post<{
        access_token: string;
        usuario: UsuarioAuth;
      }>(this.api.url('/auth/login'), { email, password })
      .subscribe({
        next: (res) => {
          const esAdmin = res.usuario.rol === 'super_admin' || res.usuario.rol === 'admin_smartclarity';

          if (perfil === 'admin' && !esAdmin) {
            this.error.set('Solo los administradores pueden acceder a este portal.');
            this.cargando.set(false);
            return;
          }
          if (perfil === 'consumidor' && esAdmin) {
            this.error.set('Los administradores deben ingresar por el portal de administración.');
            this.cargando.set(false);
            return;
          }

          this.guardarSesion(res.access_token, res.usuario);
          this.profileService.setMode(esAdmin ? 'admin' : 'consumidor');
          this.cargando.set(false);
          if (res.usuario.debe_cambiar_password) {
            this.router.navigate(['/cambiar-password']);
          } else {
            const destino =
              res.usuario.rol === 'super_admin'
                ? '/empresa'
                : res.usuario.rol === 'admin_smartclarity'
                  ? '/usuarios'
                  : '/inicio';
            this.router.navigate([destino]);
          }
        },
        error: (err) => {
          const msg = err?.error?.message;
          this.error.set(Array.isArray(msg) ? msg.join('. ') : (msg ?? 'Credenciales inválidas'));
          this.cargando.set(false);
        },
      });
  }

  logout(): void {
    const eraAdmin = ['super_admin', 'admin_smartclarity'].includes(this.usuarioActual()?.rol ?? '');
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    this.usuarioActual.set(null);
    this.router.navigate([eraAdmin ? '/login-admin' : '/login-consumidor']);
  }

  getToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    return localStorage.getItem(TOKEN_KEY);
  }

  // super_admin siempre tiene acceso (mismo criterio que PermisoAccionGuard en
  // el backend). Para el resto, un valor explícito true/false en
  // usuario.permisos manda; si la clave no está configurada, se cae al default
  // del rol — espeja 1:1 el fallback de PermisoAccionGuard.
  tienePermiso(seccion: string, accion: string): boolean {
    const usuario = this.usuarioActual();
    if (!usuario) return false;
    if (usuario.rol === 'super_admin') return true;
    const valor = usuario.permisos?.[seccion]?.[accion];
    if (typeof valor === 'boolean') return valor;
    return permisosPorDefectoSegunRol(usuario.rol as RolUsuario)?.[seccion]?.[accion] === true;
  }

  actualizarUsuario(cambios: Partial<UsuarioAuth>): void {
    const actual = this.usuarioActual();
    if (!actual) return;
    const actualizado = { ...actual, ...cambios };
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(USER_KEY, JSON.stringify(actualizado));
    }
    this.usuarioActual.set(actualizado);
  }

  clearError(): void {
    this.error.set('');
  }

  private guardarSesion(token: string, usuario: UsuarioAuth): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(usuario));
    }
    this.usuarioActual.set(usuario);
  }

  private cargarUsuario(): UsuarioAuth | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as UsuarioAuth) : null;
    } catch {
      return null;
    }
  }
}
