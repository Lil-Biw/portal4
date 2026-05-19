import { Component, inject, Input, OnChanges } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ProfileMode } from '../../profile/profile.types';
import { ConsumidorContextService } from '../../profile/consumidor-context.service';
import { ApiService } from '../../core/services/api.service';

interface NavItem { label: string; route: string; icon?: string; }

const ICONS: Record<string, string> = {
  home:     `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  user:     `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`,
  building: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="9" width="7" height="12"/><path d="M10 3h4v4h-4z"/></svg>`,
  folder:   `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  wrench:   `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
  file:     `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  bell:     `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  help:     `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
};

const BUILDING_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="9" width="7" height="12"/><path d="M10 3h4v4h-4z"/></svg>`;

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="sidebar">
      <!-- Perfil de empresa (consumidor) o logo admin -->
      <div class="profile-logo" [class.admin]="mode === 'admin'" [class.consumidor]="mode === 'consumidor'">
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
        @for (item of menuItems; track item.route) {
          <a
            class="item"
            [routerLink]="item.route"
            routerLinkActive="active">
            @if (item.icon) {
              <span class="icon" [innerHTML]="getIcon(item.icon)"></span>
            }
            {{ item.label }}
          </a>
          <!-- Breadcrumb de centro seleccionado bajo "Centro de costos" -->
          @if (item.route === '/mis-centros' && centroSeleccionado()) {
            <div class="sub-item">
              <span class="sub-icon">↳</span>
              <span class="sub-label">{{ centroSeleccionado()!.nombre }}</span>
            </div>
          }
        }
      </div>
    </nav>
  `,
  styles: [`
    :host { display:block; height:100%; }
    .sidebar {
      display:flex;
      flex-direction:column;
      gap:.75rem;
      border-radius:14px;
      border:1px solid rgba(34,33,33,.1);
      background:#fff;
      box-shadow:0 2px 12px rgba(15,23,42,.05);
      padding:1rem;
      height:100%;
    }
    .profile-logo {
      display:flex;
      align-items:center;
      justify-content:center;
      padding:.75rem;
      border-radius:12px;
      border:1px solid rgba(34,33,33,.08);
      min-height:72px;
    }
    .profile-logo.admin      { background:#000000; }
    .profile-logo.consumidor { background:#f9fafb; }
    .profile-img { max-width:100%; max-height:56px; object-fit:contain; display:block; }

    .empresa-card {
      display:flex;
      flex-direction:column;
      align-items:center;
      gap:.4rem;
      width:100%;
    }
    .empresa-logo {
      width:56px;
      height:56px;
      object-fit:contain;
      border-radius:8px;
      border:1px solid rgba(34,33,33,.08);
    }
    .empresa-icon {
      width:56px;
      height:56px;
      display:flex;
      align-items:center;
      justify-content:center;
      border-radius:8px;
      border:1px solid rgba(34,33,33,.08);
      background:#fff;
    }
    .empresa-nombre {
      font-size:.75rem;
      font-weight:700;
      color:#374151;
      text-align:center;
      line-height:1.3;
      max-width:100%;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
    }

    .menu { display:flex; flex-direction:column; gap:.3rem; flex:1; }
    a.item {
      display:flex;
      align-items:center;
      gap:.6rem;
      width:100%;
      padding:.75rem 1rem;
      border-radius:10px;
      color:#6b7280;
      font-weight:600;
      font-size:.875rem;
      text-decoration:none;
      transition:all .15s;
      border:1px solid transparent;
    }
    a.item:hover { background:rgba(34,33,33,.04); color:#374151; border-color:rgba(34,33,33,.08); }
    a.item.active { background:rgba(0,149,214,.08); color:#0095d6; border-color:rgba(0,149,214,.18); }
    .icon { display:flex; align-items:center; flex-shrink:0; opacity:.75; }
    a.item.active .icon { opacity:1; }

    .sub-item {
      display:flex;
      align-items:center;
      gap:.5rem;
      padding:.4rem 1rem .4rem 1.75rem;
      font-size:.8rem;
      font-weight:600;
      color:#0095d6;
      background:rgba(0,149,214,.06);
      border-radius:8px;
      margin-top:-.15rem;
      overflow:hidden;
    }
    .sub-icon { opacity:.6; flex-shrink:0; }
    .sub-label { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  `],
})
export class SidebarComponent implements OnChanges {
  @Input() mode: ProfileMode = 'consumidor';

  menuItems: NavItem[] = [];
  readonly buildingIcon: SafeHtml;

  private readonly consumidorContext = inject(ConsumidorContextService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly api = inject(ApiService);

  constructor() {
    this.buildingIcon = this.sanitizer.bypassSecurityTrustHtml(BUILDING_ICON);
  }

  get empresa()           { return this.consumidorContext.empresaSeleccionada(); }
  get centroSeleccionado() { return this.consumidorContext.centroSeleccionado; }

  get logoUrl(): string | null {
    const url = this.empresa?.logo_url;
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${new URL(this.api.base).origin}${url}`;
  }

  private readonly adminItems: NavItem[] = [
    { label: 'Empresas',          route: '/empresa' },
    { label: 'Centro de costos',  route: '/centros' },
    { label: 'Proyectos',         route: '/proyectos' },
    { label: 'Mantenciones',      route: '/mantenciones' },
    { label: 'Documentos',        route: '/documentos' },
    { label: 'Noticias',          route: '/noticias' },
    { label: 'Usuarios',          route: '/usuarios' },
    { label: 'Ayuda',             route: '/ayuda' },
    { label: 'Resumen general',   route: '/resumen' },
  ];

  private readonly consumidorItems: NavItem[] = [
    { label: 'Inicio',            route: '/inicio',           icon: 'home' },
    { label: 'Mi ficha',          route: '/mi-ficha',         icon: 'user' },
    { label: 'Centro de costos',  route: '/mis-centros',      icon: 'building' },
    { label: 'Proyectos',         route: '/mis-proyectos',    icon: 'folder' },
    { label: 'Mantenciones',      route: '/mis-mantenciones', icon: 'wrench' },
    { label: 'Documentos',        route: '/documentos',       icon: 'file' },
    { label: 'Noticias',          route: '/noticias',         icon: 'bell' },
    { label: 'Ayuda',             route: '/ayuda',            icon: 'help' },
  ];

  ngOnChanges(): void {
    this.menuItems = this.mode === 'admin' ? this.adminItems : this.consumidorItems;
  }

  getIcon(name: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(ICONS[name] ?? '');
  }
}
