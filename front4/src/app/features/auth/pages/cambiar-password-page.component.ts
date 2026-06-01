import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-cambiar-password-page',
  standalone: true,
  imports: [FormsModule],
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
  `],
  template: `
    <div class="wrapper">
      <div class="card">
        <h2>Cambia tu contraseña</h2>
        <p class="sub">Es tu primer ingreso. Debes establecer una nueva contraseña antes de continuar.</p>

        <form (ngSubmit)="submit()">
          <label>
            Contraseña temporal
            <input type="password" [(ngModel)]="passwordActual" name="actual" required autocomplete="current-password" />
          </label>
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

          <button type="submit" class="btn-primary btn" [disabled]="cargando()">
            {{ cargando() ? 'Guardando...' : 'Guardar contraseña' }}
          </button>
        </form>
      </div>
    </div>
  `,
})
export class CambiarPasswordPageComponent {
  private readonly http   = inject(HttpClient);
  private readonly api    = inject(ApiService);
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);

  passwordActual = '';
  passwordNueva  = '';
  confirmacion   = '';

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

    const id = this.auth.usuarioActual()?.id;
    if (!id) return;

    this.cargando.set(true);
    this.http.patch(this.api.url(`/usuarios/${id}/password`), {
      password_actual: this.passwordActual,
      password_nueva:  this.passwordNueva,
    }).subscribe({
      next: () => {
        this.auth.actualizarUsuario({ debe_cambiar_password: false });
        this.ok.set('Contraseña actualizada correctamente. Redirigiendo...');
        const esSuperAdmin = this.auth.usuarioActual()?.rol === 'super_admin';
        setTimeout(() => {
          this.router.navigate([esSuperAdmin ? '/empresa' : '/inicio']);
        }, 1200);
      },
      error: (err) => {
        const msg = err?.error?.message;
        this.error.set(Array.isArray(msg) ? msg.join('. ') : (msg ?? 'Error al cambiar la contraseña'));
        this.cargando.set(false);
      },
    });
  }
}
