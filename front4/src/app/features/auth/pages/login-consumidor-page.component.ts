import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login-consumidor-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login-consumidor-page.component.html',
  styleUrl: './login-consumidor-page.component.css',
})
export class LoginConsumidorPageComponent {
  readonly auth = inject(AuthService);

  email    = '';
  password = '';
  remember = false;
  showPass = signal(false);

  onSubmit(): void {
    if (!this.email || !this.password) return;
    this.auth.login(this.email, this.password, 'consumidor');
  }
}
