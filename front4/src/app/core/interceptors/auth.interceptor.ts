import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../../features/auth/auth.service';

let loggingOut = false;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();

  const request = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError(err => {
      if (err.status === 401 && !loggingOut) {
        loggingOut = true;
        auth.logout();
        // Resetear el flag después de la navegación para no bloquear futuros logins
        setTimeout(() => { loggingOut = false; }, 2000);
      }
      return throwError(() => err);
    }),
  );
};
