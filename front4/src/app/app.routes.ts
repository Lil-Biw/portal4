import { Routes } from '@angular/router';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';

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
    children: [
      // ── Dashboard ─────────────────────────────────────────────────
      {
        path: 'inicio',
        loadComponent: () =>
          import('./features/dashboard/pages/inicio-page.component').then(m => m.InicioPageComponent),
      },
      {
        path: 'mi-ficha',
        loadComponent: () =>
          import('./features/dashboard/pages/mi-ficha-page.component').then(m => m.MiFichaPageComponent),
      },
      {
        path: 'resumen',
        loadComponent: () =>
          import('./features/dashboard/pages/resumen-page.component').then(m => m.ResumenPageComponent),
      },

      // ── Admin ──────────────────────────────────────────────────────
      {
        path: 'empresa',
        loadComponent: () =>
          import('./features/clientes/pages/clientes-page.component').then(m => m.ClientesPageComponent),
      },
      {
        path: 'centros',
        loadComponent: () =>
          import('./features/centros/pages/centros-page.component').then(m => m.CentrosPageComponent),
      },
      {
        path: 'proyectos',
        loadComponent: () =>
          import('./features/proyectos/pages/proyectos-page.component').then(m => m.ProyectosPageComponent),
      },
      {
        path: 'usuarios',
        loadComponent: () =>
          import('./features/usuarios/pages/usuarios-page.component').then(m => m.UsuariosPageComponent),
      },
      {
        path: 'activos',
        loadComponent: () =>
          import('./features/activos/pages/activos-page.component').then(m => m.ActivosPageComponent),
      },

      // ── Consumidor (solo lectura) ──────────────────────────────────
      {
        path: 'mis-centros',
        loadComponent: () =>
          import('./features/centros/pages/mis-centros-page.component').then(m => m.MisCentrosPageComponent),
      },
      {
        path: 'mis-proyectos',
        loadComponent: () =>
          import('./features/proyectos/pages/mis-proyectos-page.component').then(m => m.MisProyectosPageComponent),
      },
      {
        path: 'mis-proyectos/:id',
        loadComponent: () =>
          import('./features/proyectos/pages/mi-proyecto-detalle-page.component').then(m => m.MiProyectoDetallePageComponent),
      },
      {
        path: 'mis-mantenciones',
        loadComponent: () =>
          import('./features/mantenciones/pages/mis-mantenciones-page.component').then(m => m.MisMantencionesPageComponent),
      },

      // ── Compartidas ────────────────────────────────────────────────
      {
        path: 'mantenciones',
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

      { path: '', redirectTo: 'inicio', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: '' },
];
