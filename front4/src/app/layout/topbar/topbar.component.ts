import { Component, Input, OnInit, inject, signal, computed, effect, untracked } from '@angular/core';
import { AuthService } from '../../features/auth/auth.service';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ProfileMode } from '../../profile/profile.types';
import { ProfileService } from '../../profile/profile.service';
import { ConsumidorContextService } from '../../profile/consumidor-context.service';
import { ClientesService } from '../../features/clientes/clientes.service';
import { CentrosService } from '../../features/centros/centros.service';
import { ActividadesService } from '../../features/actividades/actividades.service';
import { TiposActividadService } from '../../features/actividades/tipos-actividad.service';
import { SolicitudesService } from '../../features/solicitudes/solicitudes.service';
import { NewslettersService } from '../../features/noticias/newsletters.service';
import { Actividad, TipoActividad } from '../../shared/models/actividad.model';
import { asId } from '../../shared/utils';

const BELL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`;

const NOTIF_ICONS: Record<string, string> = {
  calendar: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  file:     `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
};

interface Notificacion {
  tipo: 'actividad' | 'solicitud';
  titulo: string;
  detalle: string;
  color: string;
  urgente: boolean;
  ruta: string;
  icono: string;
  queryParams?: Record<string, string>;
}

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [],
  templateUrl: './topbar.component.html',
  styles: [`
    :host { display:block; }
    .topbar {
      position: relative;
      z-index: 1003;
      height:60px;
      border-radius:0;
      border:none;
      border-bottom:1px solid rgba(255,255,255,.06);
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:1rem;
      padding:0 1.5rem;
      box-shadow:0 1px 8px rgba(0,0,0,.18);
      background:rgba(11,15,20,.85);
      backdrop-filter:blur(14px);
      -webkit-backdrop-filter:blur(14px);
    }

    .topbar-left  { display:flex; align-items:center; gap:.6rem; flex:1; }
    .topbar-center { display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .actions      { display:flex; align-items:center; gap:.75rem; flex:1; justify-content:flex-end; }

    .empresa-select {
      padding:.4rem .7rem;
      border-radius:8px;
      border:1px solid rgba(124,58,237,.4);
      font-size:.85rem;
      color:var(--fg-inverse);
      background:rgba(255,255,255,.08);
      cursor:pointer;
      min-width:180px;
      max-width:260px;
    }
    .empresa-select:focus { outline:none; border-color:#7c3aed; }
    .empresa-select option { background:var(--bg-dark); color:var(--fg-inverse); }

    .icons-slot { display:flex; align-items:center; gap:.5rem; }
    .mode-chip {
      background:var(--sc-cyan);
      color:#fff;
      padding:.3rem .7rem;
      border-radius:999px;
      font-size:11px;
      font-weight:700;
      letter-spacing:.3px;
    }
    .topbar.consumidor .mode-chip { background:#7c3aed; }
    .topbar.admin .mode-chip { background:var(--bg-dark-2); color:rgba(255,255,255,.55); }
    .toggle-btn {
      display:flex;
      align-items:center;
      gap:.4rem;
      border:1px solid rgba(255,255,255,.18);
      background:transparent;
      color:rgba(255,255,255,.8);
      border-radius:10px;
      padding:.45rem .85rem;
      font-weight:600;
      cursor:pointer;
      font-size:.85rem;
      transition:background .15s;
    }
    .toggle-btn:hover { background:rgba(255,255,255,.08); }

    /* Notificaciones */
    .notif-btn {
      position: relative;
      background: none;
      border: none;
      cursor: pointer;
      padding: .35rem;
      border-radius: 8px;
      color: rgba(255,255,255,.55);
      display: flex;
      align-items: center;
      transition: background .12s, color .12s;
    }
    .notif-btn:hover { background: rgba(255,255,255,.08); color: rgba(255,255,255,.8); }
    .notif-badge {
      position: absolute;
      top: 2px;
      right: 2px;
      background: var(--danger);
      color: #fff;
      font-size: 9px;
      font-weight: 800;
      min-width: 16px;
      height: 16px;
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 3px;
      line-height: 1;
    }
    .notif-dropdown {
      position: absolute;
      top: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      width: 460px;
      background: var(--bg-0);
      border-radius: 12px;
      border: 1px solid var(--border-default);
      box-shadow: var(--shadow-3);
      z-index: 1002;
      overflow: hidden;
    }
    .notif-header {
      padding: .7rem 1.1rem;
      font-size: .88rem;
      font-weight: 700;
      color: var(--fg-2);
      border-bottom: 1px solid var(--border-subtle);
      background: var(--bg-1);
    }
    .notif-list { max-height: 380px; overflow-y: auto; }
    .notif-item {
      display: flex;
      gap: .75rem;
      padding: .75rem 1.1rem;
      border-bottom: 1px solid var(--border-subtle);
      cursor: pointer;
      transition: background .12s;
    }
    .notif-item:hover { background: var(--sc-cyan-tint-6); }
    .notif-item:last-child { border-bottom: none; }
    .notif-dot {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: .15rem;
      opacity: .85;
    }
    .notif-body { flex: 1; }
    .notif-titulo { font-size: .875rem; font-weight: 600; color: var(--fg-2); }
    .notif-detalle { font-size: .8rem; color: var(--fg-4); margin-top: .15rem; }
    .notif-empty {
      padding: 1.25rem 1rem;
      text-align: center;
      font-size: .82rem;
      color: var(--fg-5);
    }
    .notif-wrapper { position: relative; }

    /* Campana newsletters */
    .newsletter-notif-btn {
      position: relative;
      background: none;
      border: none;
      cursor: pointer;
      padding: .35rem;
      border-radius: 8px;
      color: rgba(255,255,255,.55);
      display: flex;
      align-items: center;
      transition: background .12s, color .12s;
    }
    .newsletter-notif-btn:hover { background: rgba(255,255,255,.08); color: rgba(255,255,255,.8); }
    .newsletter-notif-badge {
      position: absolute;
      top: 2px;
      right: 2px;
      background: #f59e0b;
      color: #fff;
      font-size: 9px;
      font-weight: 800;
      min-width: 16px;
      height: 16px;
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 3px;
      line-height: 1;
    }
  `],
})
export class TopbarComponent implements OnInit {
  @Input() mode: ProfileMode = 'consumidor';

  readonly authService                   = inject(AuthService);
  protected readonly profileService      = inject(ProfileService);
  protected readonly clientesService     = inject(ClientesService);
  protected readonly centrosService      = inject(CentrosService);
  protected readonly actividadesService  = inject(ActividadesService);
  protected readonly tiposService        = inject(TiposActividadService);
  protected readonly solicitudesService  = inject(SolicitudesService);
  protected readonly newslettersService  = inject(NewslettersService);
  readonly consumidorContext             = inject(ConsumidorContextService);
  private readonly router                = inject(Router);
  private readonly sanitizer             = inject(DomSanitizer);

  protected get esSuperAdmin() {
    return this.authService.usuarioActual()?.rol === 'super_admin';
  }

  protected get esAdmin() {
    const rol = this.authService.usuarioActual()?.rol;
    return rol === 'super_admin' || rol === 'admin_smartclarity';
  }

  protected showNotifications = signal(false);
  readonly bellIcon: SafeHtml;
  private readonly safeNotifIcons: Map<string, SafeHtml>;

  getNotifIcon(key: string): SafeHtml {
    return this.safeNotifIcons.get(key) ?? this.sanitizer.bypassSecurityTrustHtml('');
  }

  constructor() {
    this.bellIcon = this.sanitizer.bypassSecurityTrustHtml(BELL_SVG);
    this.safeNotifIcons = new Map(
      Object.entries(NOTIF_ICONS).map(([k, v]) => [k, this.sanitizer.bypassSecurityTrustHtml(v)])
    );

    // Recarga solicitudes cuando cambia la empresa seleccionada
    effect(() => {
      const empresa = this.consumidorContext.empresaSeleccionada();
      untracked(() => this.solicitudesService.cargar(empresa?._id ?? ''));
    });

    // Auto-selecciona la empresa del consumidor logueado cuando cargan los clientes
    effect(() => {
      const clientes  = this.clientesService.clientes();
      const usuario   = this.authService.usuarioActual();
      if (!usuario?.cliente_id || clientes.length === 0) return;
      const empresa = clientes.find(c => c._id === usuario.cliente_id) ?? null;
      if (empresa) untracked(() => this.consumidorContext.seleccionar(empresa));
    });

    // Para consumidores (no super_admin): carga centros y actividades de su empresa al seleccionarla
    effect(() => {
      const empresa = this.consumidorContext.empresaSeleccionada();
      if (empresa && !this.esSuperAdmin) {
        untracked(() => {
          this.centrosService.cargarPorEmpresa(empresa._id);
          this.actividadesService.cargarPorEmpresa(empresa._id);
        });
      }
    });
  }

  get modeLabel() { return this.mode === 'admin' ? 'Administrador' : 'Consumidor'; }

  private centroIdsPorEmpresa = computed((): Set<string> => {
    const empresa = this.consumidorContext.empresaSeleccionada();
    if (!empresa) return new Set();
    return new Set(
      this.centrosService.centros()
        .filter(c => asId(c.cliente_id) === asId(empresa._id))
        .map(c => asId(c._id))
    );
  });

  private centroPorId(id: string): string {
    return this.centrosService.centros().find(c => asId(c._id) === id)?.nombre ?? '';
  }

  // Notificaciones: próximas actividades (7 días) + solicitudes urgentes
  protected notificaciones = computed((): Notificacion[] => {
    const result: Notificacion[] = [];
    const hoy    = new Date();
    const limite = new Date(); limite.setDate(limite.getDate() + 7);
    const centroIds = this.centroIdsPorEmpresa();

    // Actividades próximas — solo de la empresa seleccionada
    this.actividadesService.actividades()
      .filter(a => {
        if (centroIds.size > 0 && !centroIds.has(asId(a.centro_costo_id))) return false;
        const f = new Date(a.fecha);
        return f >= hoy && f <= limite;
      })
      .forEach(a => {
        const tipo = typeof a.tipo_id === 'object'
          ? (a.tipo_id as TipoActividad)
          : this.tiposService.tipos().find(t => t._id === asId(a.tipo_id as string));
        const fecha  = new Date(a.fecha);
        const diff   = Math.ceil((fecha.getTime() - hoy.getTime()) / 86400000);
        const fechaStr = fecha.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
        const centro = this.centroPorId(asId(a.centro_costo_id));
        const partes = [
          tipo?.nombre ?? 'Actividad',
          centro || null,
          fechaStr,
          diff === 0 ? 'hoy' : `en ${diff} día${diff !== 1 ? 's' : ''}`,
        ].filter(Boolean);
        result.push({
          tipo:    'actividad',
          titulo:  a.nombre,
          detalle: partes.join(' · '),
          color:   tipo?.color ?? '#00AEEF',
          urgente: diff <= 2,
          icono:   'calendar',
          ruta:    '/mis-actividades',
        });
      });

    // Solicitudes pendientes, vencidas o rechazadas
    this.solicitudesService.solicitudes()
      .filter(s => s.estado === 'pendiente' || s.estado === 'rechazado')
      .forEach(s => {
        const centro = s.centro_costo_id ? this.centroPorId(s.centro_costo_id) : null;
        const scope  = centro ?? (s.proyecto_id ? 'Proyecto' : 'Empresa');
        const estadoTexto: Record<string, string> = {
          pendiente: 'Pendiente de entrega',
          rechazado: 'Rechazada',
        };
        let estadoStr = estadoTexto[s.estado] ?? s.estado;
        if (s.estado === 'rechazado' && s.motivo_rechazo) {
          estadoStr += ` — ${s.motivo_rechazo}`;
        }
        const partes = [s.tipo, scope, estadoStr].filter(Boolean);
        const qp: Record<string, string> = { tab: 'solicitudes' };
        if (s.centro_costo_id) qp['centroId'] = s.centro_costo_id;
        if (s.proyecto_id)     qp['proyectoId'] = s.proyecto_id;
        result.push({
          tipo:        'solicitud',
          titulo:      s.nombre,
          detalle:     partes.join(' · '),
          color:       s.estado === 'rechazado' ? '#E5484D' : '#00AEEF',
          urgente:     s.estado !== 'pendiente',
          icono:       'file',
          ruta:        '/documentos',
          queryParams: qp,
        });
      });

    return result;
  });

  protected totalNotificaciones = computed(() => this.notificaciones().length);

  toggleNotifications(): void { this.showNotifications.update(v => !v); }
  cerrarNotifications(): void { this.showNotifications.set(false); }

  navegarNotificacion(n: Notificacion): void {
    this.cerrarNotifications();
    const qp = n.queryParams ?? {};
    // Fuerza re-navegación aunque ya estemos en la misma ruta+params
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() =>
      this.router.navigate([n.ruta], { queryParams: qp })
    );
  }

  ngOnInit(): void {
    this.clientesService.cargar();
    if (this.esSuperAdmin) {
      this.centrosService.cargar();
      this.newslettersService.cargarPendientesCount();
    }
  }

  irADocumentos(): void {
    this.router.navigate(['/documentos']);
  }

  irANoticiasNewsletters(): void {
    this.router.navigate(['/noticias'], { queryParams: { tab: 'newsletters' } });
  }

  activarVistaConsumidor(): void {
    this.profileService.setMode('consumidor');
    this.router.navigate(['/inicio']);
  }

  volverAAdmin(): void {
    this.consumidorContext.seleccionar(null as never);
    this.profileService.setMode('admin');
    this.router.navigate(['/empresa']);
  }

  seleccionarEmpresaVista(empresaId: string): void {
    const empresa = this.clientesService.clientes().find(c => c._id === empresaId) ?? null;
    if (empresa) this.consumidorContext.seleccionar(empresa);
  }
}
