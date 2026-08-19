import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-olvide-password-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  styles: [`
    .wrapper {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-1);
      padding: 1rem;
    }
    .card {
      background: var(--bg-0);
      border-radius: 16px;
      box-shadow: var(--shadow-3);
      padding: 2rem;
      width: 100%;
      max-width: 400px;
    }
    h2 { margin: 0 0 .5rem; color: var(--fg-2); font-size: 1.3rem; }
    p.sub { color: var(--fg-4); font-size: .9rem; margin: 0 0 1.5rem; }
    label { display: block; margin-bottom: 1rem; font-size: .875rem; font-weight: 500; color: var(--fg-2); }
    input {
      display: block;
      width: 100%;
      margin-top: .35rem;
      padding: .6rem .8rem;
      border: 1px solid var(--border-default);
      border-radius: 8px;
      font-size: .9rem;
      font-family: inherit;
      box-sizing: border-box;
    }
    input:focus { outline: none; border-color: var(--sc-cyan); }
    .btn { width: 100%; margin-top: .5rem; }
    .error { color: var(--danger); font-size: .85rem; margin: .75rem 0 0; }
    .ok    { color: var(--ok); font-size: .85rem; margin: .75rem 0 0; }
    .volver { display: block; text-align: center; margin-top: 1.25rem; font-size: .85rem; color: var(--sc-cyan); text-decoration: none; }
    .volver:hover { text-decoration: underline; }
  `],
  template: `
    <div class="wrapper">
      <div class="card">
        <h2>¿Olvidaste tu contraseña?</h2>
        <p class="sub">Ingresa tu correo y, si tienes una cuenta activa, te enviaremos un enlace para restablecerla.</p>

        <form (ngSubmit)="submit()">
          <label>
            Correo electrónico
            <input type="email" [(ngModel)]="email" name="email" required autocomplete="email" />
          </label>

          @if (error()) {
            <p class="error">{{ error() }}</p>
          }
          @if (ok()) {
            <p class="ok">{{ ok() }}</p>
          }

          <button type="submit" class="btn-primary btn" [disabled]="cargando() || !!ok()">
            {{ cargando() ? 'Enviando...' : 'Enviar enlace de recuperación' }}
          </button>
        </form>

        <a routerLink="/login-consumidor" class="volver">← Volver al inicio de sesión</a>
      </div>
    </div>
  `,
})
export class OlvidePasswordPageComponent {
  private readonly http = inject(HttpClient);
  private readonly api  = inject(ApiService);

  email = '';

  readonly cargando = signal(false);
  readonly error    = signal('');
  readonly ok       = signal('');

  submit(): void {
    this.error.set('');
    this.ok.set('');
    if (!this.email) return;

    this.cargando.set(true);
    this.http.post(this.api.url('/auth/forgot-password'), { email: this.email }).subscribe({
      next: () => {
        this.cargando.set(false);
        this.ok.set('Si el correo existe, te enviamos un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada.');
      },
      error: (err) => {
        const msg = err?.error?.message;
        this.error.set(Array.isArray(msg) ? msg.join('. ') : (msg ?? 'No se pudo procesar la solicitud'));
        this.cargando.set(false);
      },
    });
  }
}
