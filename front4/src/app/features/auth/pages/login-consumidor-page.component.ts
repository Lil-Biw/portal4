import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login-consumidor-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login-consumidor-page.component.html',
  styleUrl: './login-consumidor-page.component.css',
})
export class LoginConsumidorPageComponent {
  email    = '';
  password = '';
  remember = false;
  showPass = signal(false);
  error    = signal('');

  onSubmit(): void {
    this.error.set('');
    if (!this.email || !this.password) return;
    // Endpoint de autenticación pendiente de integrar
    this.error.set('Autenticación no habilitada en esta versión.');
  }
}
