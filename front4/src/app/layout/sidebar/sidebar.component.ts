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

interface NavGroup {
  label: string;
  items: NavItem[];
}

const ICONS: Record<string, string> = {
  home: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  dashboard: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
  user: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`,
  users: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  building: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="9" width="7" height="12"/><path d="M10 3h4v4h-4z"/></svg>`,
  hierarchy: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"/><rect x="1" y="14" width="6" height="4" rx="1"/><rect x="9" y="14" width="6" height="4" rx="1"/><rect x="17" y="14" width="6" height="4" rx="1"/><path d="M4 14v-3h16v3"/><path d="M12 6v5"/></svg>`,
  folder: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  calendar: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  wrench: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
  file: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  monitor: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  megaphone: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>`,
  bell: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  help: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  eclarity: `<img src="/logotipo_eclarity.png" width="16" height="16" style="object-fit:contain;display:block" alt="Eclarity" />`,
  bolt: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M13 2L4.09 12.97A1 1 0 0 0 5 14.5h5.5L11 22l8.91-10.97A1 1 0 0 0 19 9.5h-5.5L13 2z"/></svg>`,
};

const BUILDING_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="9" width="7" height="12"/><path d="M10 3h4v4h-4z"/></svg>`;

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="sidebar" [class.admin]="mode === 'admin'" [class.consumidor]="mode === 'consumidor'">
      <!-- Header -->
      @if (mode === 'admin') {
        <div class="brand-header">
          <img src="/SM_Isotipo_blanco_fondo_cyan.png" alt="Smart Clarity" class="brand-logo-img" />
          <div class="brand-text">
            <span class="brand-name">Smart Clarity</span>
            <span class="brand-sub">Portal de Clientes</span>
          </div>
        </div>
      }
      @if (mode === 'consumidor') {
        <div class="empresa-header">
          @if (logoUrl) {
            <img [src]="logoUrl" alt="logo empresa" class="empresa-logo" />
          } @else {
            <div class="empresa-icon" [innerHTML]="buildingIcon"></div>
          }
          <div class="empresa-text">
            <span class="empresa-nombre">{{ empresa?.razon_social ?? 'Sin empresa' }}</span>
            <span class="empresa-sub">Portal de Clientes</span>
          </div>
        </div>
      }


      <!-- Menú agrupado -->
      <div class="menu">
        @for (group of menuGroups; track group.label) {
          @if (group.label) {
            <span class="section-label">{{ group.label }}</span>
          }
          @for (item of group.items; track item.label) {
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
            <!-- Breadcrumb centro seleccionado -->
            @if (item.route === '/mis-centros' && centroSeleccionado()) {
              <div class="sub-item">
                <span class="sub-icon">↳</span>
                <span class="sub-label">{{ centroSeleccionado()!.nombre }}</span>
              </div>
            }
            <!-- Breadcrumb proyecto seleccionado -->
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
        }
      </div>

      <!-- Footer Eclariti -->
      <a class="eclariti-link" href="https://app.clarityenergy.cl/loginv5/" target="_blank" rel="noopener">
        <img src="/logotipo_eclarity_transparent_upscaled.png" alt="Eclariti" class="eclariti-logo" />
        <span class="eclariti-text">Eclariti</span>
      </a>
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
        gap: 0;
        border-radius: 0;
        border: none;
        background: #18222e;
        box-shadow: none;
        padding: 1rem;
        height: 100%;
        box-sizing: border-box;
      }

      /* --- Header admin --- */
      .brand-header {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0;
        padding: 0 0.25rem 0.75rem;
        margin-top: -1rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.07);
        margin-bottom: 0.75rem;
      }
      .brand-logo-img {
        width: 80px;
        height: 80px;
        border-radius: 16px;
        object-fit: contain;
        flex-shrink: 0;
      }
      .brand-text {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.1rem;
        margin-top: -0.4rem;
      }
      .brand-name {
        font-size: 0.875rem;
        font-weight: 700;
        color: #e2eaf2;
        white-space: nowrap;
      }
      .brand-sub {
        font-size: 0.72rem;
        color: #8aa4b8;
        white-space: nowrap;
      }

      /* --- Header consumidor --- */
      .empresa-header {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 1rem 0.25rem 1rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.07);
        margin-bottom: 0.75rem;
      }
      .empresa-logo {
        width: 52px;
        height: 52px;
        object-fit: contain;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        flex-shrink: 0;
      }
      .empresa-icon {
        width: 52px;
        height: 52px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.06);
        flex-shrink: 0;
      }
      .empresa-text {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.1rem;
      }
      .empresa-nombre {
        font-size: 0.875rem;
        font-weight: 700;
        color: #e2eaf2;
        text-align: center;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
      }
      .empresa-sub {
        font-size: 0.72rem;
        color: #8aa4b8;
        white-space: nowrap;
      }

      /* --- Menú --- */
      .menu {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
        flex: 1;
        overflow-y: auto;
      }
      .section-label {
        display: block;
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        color: #3d5669;
        padding: 0.65rem 0.75rem 0.25rem;
        text-transform: uppercase;
      }
      a.item {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        width: 100%;
        padding: 0.55rem 0.75rem;
        border-radius: 8px;
        color: #8aa4b8;
        font-weight: 500;
        font-size: 0.875rem;
        text-decoration: none;
        transition: all 0.15s;
        border: 1px solid transparent;
      }
      a.item:hover {
        background: rgba(255, 255, 255, 0.06);
        color: #c8daea;
      }
      a.item.active {
        background: rgba(77, 184, 240, 0.15);
        color: #4db8f0;
        font-weight: 600;
      }
      .sidebar.consumidor a.item.active {
        background: rgba(124, 58, 237, 0.15);
        color: #a78bfa;
      }
      .icon {
        display: flex;
        align-items: center;
        flex-shrink: 0;
        opacity: 0.65;
      }
      a.item.active .icon {
        opacity: 1;
      }

      /* --- Sub-items breadcrumb --- */
      .sub-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.35rem 0.75rem 0.35rem 1.75rem;
        font-size: 0.78rem;
        font-weight: 600;
        color: #a78bfa;
        background: rgba(124, 58, 237, 0.1);
        border-radius: 8px;
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
        background: rgba(124, 58, 237, 0.05);
        color: #c4b5fd;
        font-size: 0.74rem;
      }

      /* --- Footer Eclariti --- */
      .eclariti-link {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 1.25rem 0.75rem 0.6rem;
        border-top: 1px solid rgba(255, 255, 255, 0.07);
        text-decoration: none;
        transition: opacity 0.15s;
      }
      .eclariti-link:hover {
        opacity: 0.75;
      }
      .eclariti-logo {
        width: 20px;
        height: 20px;
        object-fit: contain;
        flex-shrink: 0;
      }
      .eclariti-text {
        font-size: 0.82rem;
        font-weight: 600;
        color: #a78bfa;
      }
    `,
  ],
})
export class SidebarComponent implements OnChanges {
  @Input() mode: ProfileMode = 'consumidor';

  menuGroups: NavGroup[] = [];
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
    const ids = (p.centro_costo_ids ?? []).map(id => asId(id));
    const nombres = this.centrosService.centros()
      .filter((c) => ids.includes(asId(c._id)))
      .map((c) => c.nombre);
    return nombres.length ? nombres.join(', ') : null;
  }

  get logoUrl(): string | null {
    const empresa = this.empresa;
    if (!empresa?._id || !empresa?.logo?.tipo_mime) return null;
    return this.api.url(`/empresas/${empresa._id}/logo`);
  }

  private readonly adminGroups: NavGroup[] = [
    {
      label: 'INICIO',
      items: [{ label: 'Inicio', route: '/resumen', icon: 'dashboard' }],
    },
    {
      label: 'ESTRUCTURA',
      items: [
        { label: 'Empresas', route: '/empresa', icon: 'building' },
        { label: 'Centros de costo', route: '/centros', icon: 'hierarchy' },
        { label: 'Proyectos', route: '/proyectos', icon: 'folder' },
      ],
    },
    {
      label: 'OPERACIÓN',
      items: [
        { label: 'Actividades', route: '/actividades', icon: 'calendar' },
        { label: 'Documentos', route: '/documentos', icon: 'file' },
        { label: 'Activos', route: '/activos', icon: 'monitor' },
      ],
    },
    {
      label: 'GESTIÓN',
      items: [
        { label: 'Usuarios', route: '/usuarios', icon: 'users' },
        { label: 'Noticias', route: '/noticias', icon: 'megaphone' },
        { label: 'Ayuda', route: '/ayuda', icon: 'help' },
      ],
    },
  ];

  private readonly consumidorGroups: NavGroup[] = [
    {
      label: 'INICIO',
      items: [{ label: 'Inicio', route: '/inicio', icon: 'home' }],
    },
    {
      label: 'MI EMPRESA',
      items: [
        { label: 'Mi ficha', route: '/mi-ficha', icon: 'user' },
        { label: 'Centros de costo', route: '/mis-centros', icon: 'hierarchy' },
        { label: 'Proyectos', route: '/mis-proyectos', icon: 'folder' },
      ],
    },
    {
      label: 'OPERACIÓN',
      items: [
        { label: 'Actividades', route: '/mis-actividades', icon: 'calendar' },
        { label: 'Activos', route: '/mis-activos', icon: 'monitor' },
        { label: 'Documentos', route: '/documentos', icon: 'file' },
      ],
    },
    {
      label: 'GESTIÓN',
      items: [
        { label: 'Noticias', route: '/noticias', icon: 'megaphone' },
        { label: 'Ayuda', route: '/ayuda', icon: 'help' },
      ],
    },
  ];

  ngOnChanges(): void {
    this.menuGroups =
      this.mode === 'admin' ? this.groupsAdminVisibles() : this.consumidorGroups;
  }

  private groupsAdminVisibles(): NavGroup[] {
    const rol = this.authService.usuarioActual()?.rol;
    if (rol !== 'admin_smartclarity') return this.adminGroups;
    return this.adminGroups.map((g) => ({
      ...g,
      items: g.items.filter((item) => item.route !== '/noticias'),
    }));
  }

  getIcon(name: string): SafeHtml {
    return this.safeIcons.get(name) ?? this.sanitizer.bypassSecurityTrustHtml('');
  }
}
