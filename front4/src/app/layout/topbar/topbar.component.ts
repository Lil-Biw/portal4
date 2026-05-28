import { Component, Input, OnInit, inject, signal, computed, effect, untracked } from '@angular/core';
import { AuthService } from '../../features/auth/auth.service';
import { Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ProfileMode } from '../../profile/profile.types';
import { ProfileService } from '../../profile/profile.service';
import { ConsumidorContextService } from '../../profile/consumidor-context.service';
import { ClientesService } from '../../features/clientes/clientes.service';
import { CentrosService } from '../../features/centros/centros.service';
import { MantencionesService } from '../../features/mantenciones/mantenciones.service';
import { TiposMantencionService } from '../../features/mantenciones/tipos-mantencion.service';
import { SolicitudesService } from '../../features/solicitudes/solicitudes.service';
import { Mantencion, TipoMantencion } from '../../shared/models/mantencion.model';
import { asId } from '../../shared/utils';

const BELL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`;

interface Notificacion {
  tipo: 'mantencion' | 'solicitud';
  titulo: string;
  detalle: string;
  color: string;
  urgente: boolean;
}

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [],
  templateUrl: './topbar.component.html',
  styles: [`
    :host { display:block; }
    .topbar {
      height:60px;
      border-radius:14px;
      border:1px solid rgba(34,33,33,.1);
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:1rem;
      padding:0 1.25rem;
      box-shadow:0 2px 12px rgba(15,23,42,.06);
      background:#fff;
    }
    .topbar.admin      { border-left:4px solid #000000; }
    .topbar.consumidor { border-left:4px solid #0095d6; }

    .brand { display:flex; align-items:center; gap:.6rem; flex-shrink:0; }
    .brand-logo { height:36px; width:auto; display:block; border-radius:8px; }
    .brand-name { font-weight:800; font-size:1.05rem; color:#0095d6; letter-spacing:-.5px; }

    .context-slot { display:flex; align-items:center; gap:.6rem; flex:1; }
    .empresa-select {
      padding:.4rem .7rem;
      border-radius:8px;
      border:1px solid rgba(0,149,214,.35);
      font-size:.85rem;
      color:#374151;
      background:#fff;
      cursor:pointer;
      min-width:180px;
      max-width:260px;
    }
    .empresa-select:focus { outline:none; border-color:#0095d6; }

    .icons-slot { display:flex; align-items:center; gap:.5rem; position:relative; z-index:1000; }

    .actions { display:flex; align-items:center; gap:.75rem; flex-shrink:0; }
    .mode-chip {
      background:#0095d6;
      color:#fff;
      padding:.3rem .7rem;
      border-radius:999px;
      font-size:11px;
      font-weight:700;
      letter-spacing:.3px;
    }
    .topbar.consumidor .mode-chip { background:#0095d6; }
    .topbar.admin .mode-chip { background:#000000; }
    .toggle-btn {
      border:1px solid rgba(34,33,33,.18);
      background:transparent;
      color:#374151;
      border-radius:10px;
      padding:.45rem .85rem;
      font-weight:600;
      cursor:pointer;
      font-size:.85rem;
      transition:background .15s;
    }
    .toggle-btn:hover { background:rgba(34,33,33,.06); }
    .topbar.admin .toggle-btn { border-color:#000000; color:#000000; }
    .topbar.consumidor .toggle-btn { border-color:#0095d6; color:#0095d6; }

    /* Notificaciones */
    .notif-btn {
      position: relative;
      background: none;
      border: none;
      cursor: pointer;
      padding: .35rem;
      border-radius: 8px;
      color: #6b7280;
      display: flex;
      align-items: center;
      transition: background .12s, color .12s;
    }
    .notif-btn:hover { background: rgba(34,33,33,.06); color: #374151; }
    .notif-badge {
      position: absolute;
      top: 2px;
      right: 2px;
      background: #ef4444;
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
      right: 0;
      width: 320px;
      background: #fff;
      border-radius: 12px;
      border: 1px solid rgba(34,33,33,.1);
      box-shadow: 0 8px 30px rgba(15,23,42,.15);
      z-index: 1002;
      overflow: hidden;
    }
    .notif-header {
      padding: .65rem 1rem;
      font-size: .8rem;
      font-weight: 700;
      color: #374151;
      border-bottom: 1px solid rgba(34,33,33,.08);
      background: #f9fafb;
    }
    .notif-list { max-height: 320px; overflow-y: auto; }
    .notif-item {
      display: flex;
      gap: .6rem;
      padding: .65rem 1rem;
      border-bottom: 1px solid rgba(34,33,33,.05);
      cursor: default;
    }
    .notif-item:last-child { border-bottom: none; }
    .notif-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-top: .3rem;
      flex-shrink: 0;
    }
    .notif-body { flex: 1; }
    .notif-titulo { font-size: .8rem; font-weight: 600; color: #1f2937; }
    .notif-detalle { font-size: .73rem; color: #6b7280; margin-top: .1rem; }
    .notif-empty {
      padding: 1.25rem 1rem;
      text-align: center;
      font-size: .82rem;
      color: #9ca3af;
    }
    .notif-wrapper { position: relative; }
  `],
})
export class TopbarComponent implements OnInit {
  @Input() mode: ProfileMode = 'consumidor';

  readonly authService                   = inject(AuthService);
  protected readonly profileService      = inject(ProfileService);
  protected readonly clientesService     = inject(ClientesService);
  protected readonly centrosService      = inject(CentrosService);
  protected readonly mantencionesService = inject(MantencionesService);
  protected readonly tiposService        = inject(TiposMantencionService);
  protected readonly solicitudesService  = inject(SolicitudesService);
  readonly consumidorContext             = inject(ConsumidorContextService);
  private readonly router                = inject(Router);
  private readonly sanitizer             = inject(DomSanitizer);

  protected get esSuperAdmin() {
    return this.authService.usuarioActual()?.rol === 'super_admin';
  }

  protected showNotifications = signal(false);
  readonly bellIcon: SafeHtml;

  constructor() {
    this.bellIcon = this.sanitizer.bypassSecurityTrustHtml(BELL_SVG);

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

  // Notificaciones: próximas mantenciones (7 días) + solicitudes urgentes
  protected notificaciones = computed((): Notificacion[] => {
    const result: Notificacion[] = [];
    const hoy    = new Date();
    const limite = new Date(); limite.setDate(limite.getDate() + 7);
    const centroIds = this.centroIdsPorEmpresa();

    // Mantenciones próximas — solo de la empresa seleccionada
    this.mantencionesService.mantenciones()
      .filter(m => {
        if (centroIds.size > 0 && !centroIds.has(asId(m.centro_costo_id))) return false;
        const f = new Date(m.fecha);
        return f >= hoy && f <= limite;
      })

      .forEach(m => {
        const tipo = typeof m.tipo_id === 'object'
          ? (m.tipo_id as TipoMantencion)
          : this.tiposService.tipos().find(t => t._id === asId(m.tipo_id as string));
        const fecha = new Date(m.fecha);
        const diff  = Math.ceil((fecha.getTime() - hoy.getTime()) / 86400000);
        result.push({
          tipo:    'mantencion',
          titulo:  m.nombre,
          detalle: `${tipo?.nombre ?? 'Mantención'} · en ${diff} día${diff !== 1 ? 's' : ''}`,
          color:   tipo?.color ?? '#0095d6',
          urgente: diff <= 2,
        });
      });

    // Solicitudes pendientes, vencidas o rechazadas
    this.solicitudesService.solicitudes()
      .filter(s => s.estado === 'pendiente' || s.estado === 'vencido' || s.estado === 'rechazado')
      .forEach(s => {
        result.push({
          tipo:    'solicitud',
          titulo:  s.nombre,
          detalle: `Solicitud ${s.estado}`,
          color:   s.estado === 'vencido' ? '#f59e0b' : s.estado === 'rechazado' ? '#ef4444' : '#0095d6',
          urgente: s.estado !== 'pendiente',
        });
      });

    return result;
  });

  protected totalNotificaciones = computed(() => this.notificaciones().length);

  toggleNotifications(): void { this.showNotifications.update(v => !v); }
  cerrarNotifications(): void { this.showNotifications.set(false); }

  ngOnInit(): void {
    this.clientesService.cargar();
    this.centrosService.cargar();
  }

  irADocumentos(): void {
    this.router.navigate(['/documentos']);
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
