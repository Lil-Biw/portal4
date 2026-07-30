import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-restablecer-password-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  styles: [`
    .wrapper {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f9fafb;
      padding: 1rem;
    }
    .card {
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(15,23,42,.1);
      padding: 2rem;
      width: 100%;
      max-width: 400px;
    }
    h2 { margin: 0 0 .5rem; color: #1f2937; font-size: 1.3rem; }
    p.sub { color: #6b7280; font-size: .9rem; margin: 0 0 1.5rem; }
    label { display: block; margin-bottom: 1rem; font-size: .875rem; font-weight: 500; color: #374151; }
    input {
      display: block;
      width: 100%;
      margin-top: .35rem;
      padding: .6rem .8rem;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: .9rem;
      font-family: inherit;
      box-sizing: border-box;
    }
    input:focus { outline: none; border-color: #0095d6; }
    .btn { width: 100%; margin-top: .5rem; }
    .error { color: #dc2626; font-size: .85rem; margin: .75rem 0 0; }
    .ok    { color: #16a34a; font-size: .85rem; margin: .75rem 0 0; }
    .volver { display: block; text-align: center; margin-top: 1.25rem; font-size: .85rem; color: #0095d6; text-decoration: none; }
    .volver:hover { text-decoration: underline; }
  `],
  template: `
    <div class="wrapper">
      <div class="card">
        @if (!token) {
          <h2>Enlace inválido</h2>
          <p class="sub">Este enlace de recuperación no es válido. Solicita uno nuevo.</p>
        } @else {
          <h2>Restablece tu contraseña</h2>
          <p class="sub">Define tu nueva contraseña para continuar.</p>

          <form (ngSubmit)="submit()">
            <label>
              Nueva contraseña <small style="font-weight:400;color:#9ca3af">(mínimo 8 caracteres)</small>
              <input type="password" [(ngModel)]="passwordNueva" name="nueva" required minlength="8" autocomplete="new-password" />
            </label>
            <label>
              Confirmar contraseña
              <input type="password" [(ngModel)]="confirmacion" name="confirmar" required autocomplete="new-password" />
            </label>

            @if (error()) {
              <p class="error">{{ error() }}</p>
            }
            @if (ok()) {
              <p class="ok">{{ ok() }}</p>
            }

            <button type="submit" class="btn-primary btn" [disabled]="cargando() || !!ok()">
              {{ cargando() ? 'Guardando...' : 'Guardar contraseña' }}
            </button>
          </form>
        }

        <a routerLink="/olvide-password" class="volver">Solicitar un nuevo enlace</a>
      </div>
    </div>
  `,
})
export class RestablecerPasswordPageComponent {
  private readonly http  = inject(HttpClient);
  private readonly api   = inject(ApiService);
  private readonly ruta  = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly token = this.ruta.snapshot.queryParamMap.get('token') ?? '';

  passwordNueva = '';
  confirmacion  = '';

  readonly cargando = signal(false);
  readonly error    = signal('');
  readonly ok       = signal('');

  submit(): void {
    this.error.set('');
    this.ok.set('');

    if (this.passwordNueva.length < 8) {
      this.error.set('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (this.passwordNueva !== this.confirmacion) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }

    this.cargando.set(true);
    this.http.post(this.api.url('/auth/reset-password'), {
      token: this.token,
      password_nueva: this.passwordNueva,
    }).subscribe({
      next: () => {
        this.cargando.set(false);
        this.ok.set('Contraseña actualizada correctamente. Redirigiendo al inicio de sesión...');
        setTimeout(() => this.router.navigate(['/login-consumidor']), 1500);
      },
      error: (err) => {
        const msg = err?.error?.message;
        this.error.set(Array.isArray(msg) ? msg.join('. ') : (msg ?? 'No se pudo restablecer la contraseña'));
        this.cargando.set(false);
      },
    });
  }
}
