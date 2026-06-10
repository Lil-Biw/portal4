import { Component, inject, Input, OnChanges } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ProfileMode } from '../../profile/profile.types';
import { ConsumidorContextService } from '../../profile/consumidor-context.service';
import { CentrosService } from '../../features/centros/centros.service';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../features/auth/auth.service';
import { asId } from '../../shared/utils';

interface NavItem {
  label: string;
  route?: string;
  icon?: string;
  external?: boolean;
  href?: string;
}

const ICONS: Record<string, string> = {
  home: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  user: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`,
  building: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="9" width="7" height="12"/><path d="M10 3h4v4h-4z"/></svg>`,
  folder: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  wrench: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
  file: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  bell: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  help: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  eclarity: `<img src="/logotipo_eclarity.png" width="16" height="16" style="object-fit:contain;display:block" alt="Eclarity" />`,
};

const BUILDING_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="9" width="7" height="12"/><path d="M10 3h4v4h-4z"/></svg>`;

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="sidebar">
      <!-- Perfil de empresa (consumidor) o logo admin -->
      <div
        class="profile-logo"
        [class.admin]="mode === 'admin'"
        [class.consumidor]="mode === 'consumidor'"
      >
        @if (mode === 'admin') {
          <img src="/SM_logo_2líneas_blanco.png" alt="Smart Clarity" class="profile-img" />
        }
        @if (mode === 'consumidor') {
          <div class="empresa-card">
            @if (logoUrl) {
              <img [src]="logoUrl" alt="logo empresa" class="empresa-logo" />
            } @else {
              <div class="empresa-icon" [innerHTML]="buildingIcon"></div>
            }
            <span class="empresa-nombre">{{ empresa?.razon_social ?? 'Sin empresa' }}</span>
          </div>
        }
      </div>

      <!-- Menú -->
      <div class="menu">
        @for (item of menuItems; track item.label) {
          @if (item.external) {
            <a class="item" [href]="item.href" target="_blank" rel="noopener">
              @if (item.icon) {
                <span class="icon" [innerHTML]="getIcon(item.icon)"></span>
              }
              {{ item.label }}
            </a>
          } @else {
            <a class="item" [routerLink]="item.route" routerLinkActive="active">
              @if (item.icon) {
                <span class="icon" [innerHTML]="getIcon(item.icon)"></span>
              }
              {{ item.label }}
            </a>
          }
          <!-- Breadcrumb de centro seleccionado bajo "Centro de costos" -->
          @if (item.route === '/mis-centros' && centroSeleccionado()) {
            <div class="sub-item">
              <span class="sub-icon">↳</span>
              <span class="sub-label">{{ centroSeleccionado()!.nombre }}</span>
            </div>
          }
          <!-- Breadcrumb de proyecto seleccionado bajo "Proyectos" -->
          @if (item.route === '/mis-proyectos' && proyectoSeleccionado()) {
            @if (centroDelProyecto) {
              <div class="sub-item">
                <span class="sub-icon">↳</span>
                <span class="sub-label">{{ centroDelProyecto }}</span>
              </div>
            }
            <div class="sub-item sub-item--project">
              <span class="sub-icon">↳</span>
              <span class="sub-label">{{ proyectoSeleccionado()!.nombre }}</span>
            </div>
          }
        }
      </div>
    </nav>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }
      .sidebar {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        border-radius: 14px;
        border: 1px solid rgba(34, 33, 33, 0.1);
        background: #fff;
        box-shadow: 0 2px 12px rgba(15, 23, 42, 0.05);
        padding: 1rem;
        height: 100%;
      }
      .profile-logo {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.75rem;
        border-radius: 12px;
        border: 1px solid rgba(34, 33, 33, 0.08);
        min-height: 72px;
      }
      .profile-logo.admin {
        background: #000000;
      }
      .profile-logo.consumidor {
        background: #f9fafb;
      }
      .profile-img {
        max-width: 100%;
        max-height: 56px;
        object-fit: contain;
        display: block;
      }

      .empresa-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.4rem;
        width: 100%;
      }
      .empresa-logo {
        width: 56px;
        height: 56px;
        object-fit: contain;
        border-radius: 8px;
        border: 1px solid rgba(34, 33, 33, 0.08);
      }
      .empresa-icon {
        width: 56px;
        height: 56px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        border: 1px solid rgba(34, 33, 33, 0.08);
        background: #fff;
      }
      .empresa-nombre {
        font-size: 0.75rem;
        font-weight: 700;
        color: #374151;
        text-align: center;
        line-height: 1.3;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .menu {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
        flex: 1;
      }
      a.item {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        width: 100%;
        padding: 0.75rem 1rem;
        border-radius: 10px;
        color: #6b7280;
        font-weight: 600;
        font-size: 0.875rem;
        text-decoration: none;
        transition: all 0.15s;
        border: 1px solid transparent;
      }
      a.item:hover {
        background: rgba(34, 33, 33, 0.04);
        color: #374151;
        border-color: rgba(34, 33, 33, 0.08);
      }
      a.item.active {
        background: rgba(0, 149, 214, 0.08);
        color: #0095d6;
        border-color: rgba(0, 149, 214, 0.18);
      }
      .icon {
        display: flex;
        align-items: center;
        flex-shrink: 0;
        opacity: 0.75;
      }
      a.item.active .icon {
        opacity: 1;
      }

      .sub-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.4rem 1rem 0.4rem 1.75rem;
        font-size: 0.8rem;
        font-weight: 600;
        color: #0095d6;
        background: rgba(0, 149, 214, 0.06);
        border-radius: 8px;
        margin-top: -0.15rem;
        overflow: hidden;
      }
      .sub-icon {
        opacity: 0.6;
        flex-shrink: 0;
      }
      .sub-label {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .sub-item--project {
        padding-left: 2.75rem;
        background: rgba(0, 149, 214, 0.03);
        color: #0369a1;
        font-size: 0.76rem;
      }
    `,
  ],
})
export class SidebarComponent implements OnChanges {
  @Input() mode: ProfileMode = 'consumidor';

  menuItems: NavItem[] = [];
  readonly buildingIcon: SafeHtml;

  private readonly consumidorContext = inject(ConsumidorContextService);
  private readonly centrosService = inject(CentrosService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly api = inject(ApiService);
  private readonly authService = inject(AuthService);

  // Pre-compilados para evitar que bypassSecurityTrustHtml() en cada change-detection
  // recree el <img> del ícono Eclarity y cancele su request en loop.
  private readonly safeIcons: Map<string, SafeHtml>;

  constructor() {
    this.buildingIcon = this.sanitizer.bypassSecurityTrustHtml(BUILDING_ICON);
    this.safeIcons = new Map(
      Object.entries(ICONS).map(([k, v]) => [k, this.sanitizer.bypassSecurityTrustHtml(v)]),
    );
  }

  get empresa() {
    return this.consumidorContext.empresaSeleccionada();
  }
  get centroSeleccionado() {
    return this.consumidorContext.centroSeleccionado;
  }
  get proyectoSeleccionado() {
    return this.consumidorContext.proyectoSeleccionado;
  }

  get centroDelProyecto(): string | null {
    const p = this.consumidorContext.proyectoSeleccionado();
    if (!p) return null;
    const c = this.centrosService.centros().find((c) => asId(c._id) === asId(p.centro_costo_id));
    return c?.nombre ?? null;
  }

  get logoUrl(): string | null {
    const empresa = this.empresa;
    if (!empresa?._id || !empresa?.logo?.tipo_mime) return null;
    return this.api.url(`/empresas/${empresa._id}/logo`);
  }

  private readonly adminItems: NavItem[] = [
    { label: 'Empresas', route: '/empresa' },
    { label: 'Centro de costos', route: '/centros' },
    { label: 'Proyectos', route: '/proyectos' },
    { label: 'Actividades', route: '/actividades' },
    { label: 'Documentos', route: '/documentos' },
    { label: 'Noticias', route: '/noticias' },
    { label: 'Usuarios', route: '/usuarios' },
    { label: 'Activos', route: '/activos' },
    { label: 'Ayuda', route: '/ayuda' },
    { label: 'Resumen general', route: '/resumen' },
    {
      label: 'Eclariti',
      href: 'https://app.clarityenergy.cl/loginv5/',
      external: true,
      icon: 'eclarity',
    },
  ];

  private readonly consumidorItems: NavItem[] = [
    { label: 'Inicio', route: '/inicio', icon: 'home' },
    { label: 'Mi ficha', route: '/mi-ficha', icon: 'user' },
    { label: 'Centro de costos', route: '/mis-centros', icon: 'building' },
    { label: 'Proyectos', route: '/mis-proyectos', icon: 'folder' },
    { label: 'Actividades', route: '/mis-actividades', icon: 'wrench' },
    { label: 'Documentos', route: '/documentos', icon: 'file' },
    { label: 'Noticias', route: '/noticias', icon: 'bell' },
    { label: 'Ayuda', route: '/ayuda', icon: 'help' },
    {
      label: 'Eclariti',
      href: 'https://app.clarityenergy.cl/loginv5/',
      external: true,
      icon: 'eclarity',
    },
  ];

  ngOnChanges(): void {
    this.menuItems = this.mode === 'admin' ? this.itemsAdminVisibles() : this.consumidorItems;
  }

  private itemsAdminVisibles(): NavItem[] {
    const rol = this.authService.usuarioActual()?.rol;
    return rol === 'admin_smartclarity'
      ? this.adminItems.filter((item) => item.route !== '/noticias')
      : this.adminItems;
  }

  getIcon(name: string): SafeHtml {
    return this.safeIcons.get(name) ?? this.sanitizer.bypassSecurityTrustHtml('');
  }
}
