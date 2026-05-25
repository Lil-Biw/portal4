import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login-admin-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login-admin-page.component.html',
  styleUrl: './login-admin-page.component.css',
})
export class LoginAdminPageComponent {
  email    = '';
  password = '';
  showPass = signal(false);
  error    = signal('');

  onSubmit(): void {
    this.error.set('');
    if (!this.email || !this.password) return;
    // Endpoint de autenticación pendiente de integrar
    this.error.set('Autenticación no habilitada en esta versión.');
  }
}
