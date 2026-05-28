import { Routes } from '@angular/router';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { authGuard, homeGuard, soloAdminGuard, soloConsumidorGuard } from './features/auth/auth.guard';

export const routes: Routes = [
  // ── Páginas de acceso (sin layout) ────────────────────────────────────────
  {
    path: 'login-admin',
    loadComponent: () =>
      import('./features/auth/pages/login-admin-page.component').then(m => m.LoginAdminPageComponent),
  },
  {
    path: 'login-consumidor',
    loadComponent: () =>
      import('./features/auth/pages/login-consumidor-page.component').then(m => m.LoginConsumidorPageComponent),
  },

  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      // ── Dashboard ─────────────────────────────────────────────────
      {
        path: 'inicio',
        canActivate: [soloConsumidorGuard],
        loadComponent: () =>
          import('./features/dashboard/pages/inicio-page.component').then(m => m.InicioPageComponent),
      },
      {
        path: 'mi-ficha',
        canActivate: [soloConsumidorGuard],
        loadComponent: () =>
          import('./features/dashboard/pages/mi-ficha-page.component').then(m => m.MiFichaPageComponent),
      },
      {
        path: 'resumen',
        canActivate: [soloAdminGuard],
        loadComponent: () =>
          import('./features/dashboard/pages/resumen-page.component').then(m => m.ResumenPageComponent),
      },

      // ── Admin (solo super_admin) ───────────────────────────────────
      {
        path: 'empresa',
        canActivate: [soloAdminGuard],
        loadComponent: () =>
          import('./features/clientes/pages/clientes-page.component').then(m => m.ClientesPageComponent),
      },
      {
        path: 'centros',
        canActivate: [soloAdminGuard],
        loadComponent: () =>
          import('./features/centros/pages/centros-page.component').then(m => m.CentrosPageComponent),
      },
      {
        path: 'proyectos',
        canActivate: [soloAdminGuard],
        loadComponent: () =>
          import('./features/proyectos/pages/proyectos-page.component').then(m => m.ProyectosPageComponent),
      },
      {
        path: 'usuarios',
        canActivate: [soloAdminGuard],
        loadComponent: () =>
          import('./features/usuarios/pages/usuarios-page.component').then(m => m.UsuariosPageComponent),
      },
      {
        path: 'activos',
        canActivate: [soloAdminGuard],
        loadComponent: () =>
          import('./features/activos/pages/activos-page.component').then(m => m.ActivosPageComponent),
      },

      // ── Consumidor (solo admin_cliente / usuario) ──────────────────
      {
        path: 'mis-centros',
        canActivate: [soloConsumidorGuard],
        loadComponent: () =>
          import('./features/centros/pages/mis-centros-page.component').then(m => m.MisCentrosPageComponent),
      },
      {
        path: 'mis-proyectos',
        canActivate: [soloConsumidorGuard],
        loadComponent: () =>
          import('./features/proyectos/pages/mis-proyectos-page.component').then(m => m.MisProyectosPageComponent),
      },
      {
        path: 'mis-proyectos/:id',
        canActivate: [soloConsumidorGuard],
        loadComponent: () =>
          import('./features/proyectos/pages/mi-proyecto-detalle-page.component').then(m => m.MiProyectoDetallePageComponent),
      },
      {
        path: 'mis-mantenciones',
        canActivate: [soloConsumidorGuard],
        loadComponent: () =>
          import('./features/mantenciones/pages/mis-mantenciones-page.component').then(m => m.MisMantencionesPageComponent),
      },

      // ── Compartidas ────────────────────────────────────────────────
      {
        path: 'mantenciones',
        canActivate: [soloAdminGuard],
        loadComponent: () =>
          import('./features/mantenciones/pages/mantenciones-page.component').then(m => m.MantencionesPageComponent),
      },
      {
        path: 'documentos',
        loadComponent: () =>
          import('./features/documentos/pages/documentos-page.component').then(m => m.DocumentosPageComponent),
      },
      {
        path: 'noticias',
        loadComponent: () =>
          import('./features/noticias/pages/noticias-page.component').then(m => m.NoticiasPageComponent),
      },
      {
        path: 'ayuda',
        loadComponent: () =>
          import('./features/ayuda/pages/ayuda-page.component').then(m => m.AyudaPageComponent),
      },

      { path: '', canActivate: [homeGuard], children: [] },
    ],
  },
  { path: '**', redirectTo: '' },
];
