import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { ProfileService } from '../../profile/profile.service';

export interface UsuarioAuth {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  cliente_id: string | null;
  debe_cambiar_password: boolean;
}

const TOKEN_KEY = 'auth_token';
const USER_KEY  = 'auth_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http          = inject(HttpClient);
  private readonly api           = inject(ApiService);
  private readonly router        = inject(Router);
  private readonly platformId    = inject(PLATFORM_ID);
  private readonly profileService = inject(ProfileService);

  readonly usuarioActual   = signal<UsuarioAuth | null>(this.cargarUsuario());
  readonly estaAutenticado = computed(() => this.usuarioActual() !== null);
  readonly cargando        = signal(false);
  readonly error           = signal('');

  login(email: string, password: string, perfil: 'admin' | 'consumidor'): void {
    this.cargando.set(true);
    this.error.set('');
    this.http
      .post<{ access_token: string; usuario: UsuarioAuth }>(
        this.api.url('/auth/login'),
        { email, password },
      )
      .subscribe({
        next: res => {
          const esSuperAdmin = res.usuario.rol === 'super_admin';

          if (perfil === 'admin' && !esSuperAdmin) {
            this.error.set('Solo los administradores pueden acceder a este portal.');
            this.cargando.set(false);
            return;
          }
          if (perfil === 'consumidor' && esSuperAdmin) {
            this.error.set('Los administradores deben ingresar por el portal de administración.');
            this.cargando.set(false);
            return;
          }

          this.guardarSesion(res.access_token, res.usuario);
          this.profileService.setMode(esSuperAdmin ? 'admin' : 'consumidor');
          this.cargando.set(false);
          if (res.usuario.debe_cambiar_password) {
            this.router.navigate(['/cambiar-password']);
          } else {
            this.router.navigate([esSuperAdmin ? '/empresa' : '/inicio']);
          }
        },
        error: err => {
          const msg = err?.error?.message;
          this.error.set(Array.isArray(msg) ? msg.join('. ') : (msg ?? 'Credenciales inválidas'));
          this.cargando.set(false);
        },
      });
  }

  logout(): void {
    const eraAdmin = this.usuarioActual()?.rol === 'super_admin';
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
