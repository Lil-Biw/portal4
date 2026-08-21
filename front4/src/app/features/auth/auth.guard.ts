import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { ProfileService } from '../../profile/profile.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.estaAutenticado()) {
    return router.createUrlTree(['/login-consumidor']);
  }

  return true;
};

// canActivateChild del layout: a diferencia de canActivate en el padre (que
// solo corre al entrar al layout desde afuera), este vuelve a ejecutarse en
// cada navegación entre rutas hijas — es el punto donde refrescamos
// rol/permisos/centros_asignados por si un admin los cambió mientras esta
// sesión seguía abierta (ver AuthService.refrescarSesion).
export const refrescarSesionGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  await auth.refrescarSesion();
  return true;
};

// Impide que un consumidor acceda a rutas del portal admin
export const soloAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.estaAutenticado()) return router.createUrlTree(['/login-admin']);
  const rol = auth.usuarioActual()?.rol;
  if (rol !== 'super_admin' && rol !== 'admin_smartclarity') return router.createUrlTree(['/inicio']);
  return true;
};

export const usuariosAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const rol = auth.usuarioActual()?.rol;

  if (!auth.estaAutenticado()) return router.createUrlTree(['/login-admin']);
  if (rol !== 'super_admin' && rol !== 'admin_smartclarity') return router.createUrlTree(['/inicio']);
  return true;
};

export const soloSuperAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.estaAutenticado()) return router.createUrlTree(['/login-admin']);
  if (auth.usuarioActual()?.rol !== 'super_admin') return router.createUrlTree(['/inicio']);
  return true;
};

// Redirige la raíz según el rol del usuario
export const homeGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.estaAutenticado()) return router.createUrlTree(['/login-consumidor']);
  const rol = auth.usuarioActual()?.rol;
  if (rol === 'super_admin') return router.createUrlTree(['/empresa']);
  if (rol === 'admin_smartclarity') return router.createUrlTree(['/usuarios']);
  return router.createUrlTree(['/inicio']);
};

// Impide que el super_admin acceda a rutas de consumidor,
// excepto cuando está en modo "Vista consumidor" (profileService.mode() === 'consumidor')
export const soloConsumidorGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const profile = inject(ProfileService);

  if (!auth.estaAutenticado()) return router.createUrlTree(['/login-consumidor']);
  if (auth.usuarioActual()?.rol === 'super_admin' && profile.mode() !== 'consumidor') {
    return router.createUrlTree(['/empresa']);
  }
  return true;
};
