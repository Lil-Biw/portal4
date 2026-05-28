import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login-admin-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login-admin-page.component.html',
  styleUrl: './login-admin-page.component.css',
})
export class LoginAdminPageComponent {
  readonly auth = inject(AuthService);

  email    = '';
  password = '';
  showPass = signal(false);

  onSubmit(): void {
    if (!this.email || !this.password) return;
    this.auth.login(this.email, this.password, 'admin');
  }
}
