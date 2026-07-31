import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../../features/auth/auth.service';

let loggingOut = false;

// Endpoints públicos donde un 401 es una respuesta de negocio normal (token de
// recuperación inválido/expirado), no una sesión expirada — no deben disparar
// el logout automático ni la redirección a login.
const RUTAS_AUTH_PUBLICAS = ['/auth/forgot-password', '/auth/reset-password'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();

  const request = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError(err => {
      const esRutaPublica = RUTAS_AUTH_PUBLICAS.some(ruta => req.url.includes(ruta));
      if (err.status === 401 && !loggingOut && !esRutaPublica) {
        loggingOut = true;
        auth.logout();
        // Resetear el flag después de la navegación para no bloquear futuros logins
        setTimeout(() => { loggingOut = false; }, 2000);
      }
      return throwError(() => err);
    }),
  );
};
