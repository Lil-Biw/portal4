import { Component, OnInit, inject, computed, signal, effect } from '@angular/core';
import { Router } from '@angular/router';
import { ProyectosService } from '../proyectos.service';
import { CentrosService } from '../../centros/centros.service';
import { SolicitudesService } from '../../solicitudes/solicitudes.service';
import { DocumentosService } from '../../documentos/documentos.service';
import { TiposProyectoService } from '../tipos-proyecto.service';
import { ConsumidorContextService } from '../../../profile/consumidor-context.service';
import { DonutArcComponent } from '../../../shared/components/donut-arc/donut-arc.component';
import { ProyectoFormComponent } from '../components/proyecto-form/proyecto-form.component';
import { AuthService } from '../../auth/auth.service';
import { Proyecto, EstadoProyecto, ESTADO_PROYECTO_LABEL, CreateProyectoDto } from '../../../shared/models/proyecto.model';
import { asId, confirmarEliminacion, calcularScoreDocumental } from '../../../shared/utils';

type ProyectoModal = 'crear' | 'editar' | null;

@Component({
  selector: 'app-mis-proyectos-page',
  standalone: true,
  imports: [DonutArcComponent, ProyectoFormComponent],
  templateUrl: './mis-proyectos-page.component.html',
  styles: [`
    .proyecto-card {
      cursor: pointer;
      transition: box-shadow .15s, border-color .15s;
      border: 1px solid var(--border-default);
    }
    .proyecto-card:hover {
      box-shadow: 0 4px 16px rgba(0,174,239,.18);
      border-color: var(--sc-cyan);
    }

    .btn-icon-sq {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border: 1px solid var(--border-default);
      border-radius: 7px;
      background: none;
      cursor: pointer;
      color: var(--fg-4);
      transition: border-color .15s, color .15s, background .15s;
    }
    .btn-icon-sq:hover { border-color: var(--sc-cyan); color: var(--sc-cyan); background: var(--sc-cyan-tint-6); }
    .btn-action-danger { color: var(--danger); }
    .btn-action-danger:hover { color: var(--danger); background: var(--danger-bg); }

    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.25rem;
      flex-wrap: wrap;
    }
    .header-actions { display: flex; gap: .6rem; align-items: center; }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: var(--overlay);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 1rem;
    }
    .modal {
      background: var(--bg-0);
      border-radius: 16px;
      box-shadow: var(--shadow-4);
      width: 100%;
      max-width: 640px;
      max-height: 85vh;
      overflow-y: auto;
      padding: 1.5rem;
    }
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.25rem;
    }
    .modal-header h3 { margin: 0; font-size: 1.1rem; font-weight: 700; }
    .modal-close {
      background: none;
      border: none;
      font-size: 1.4rem;
      line-height: 1;
      cursor: pointer;
      color: var(--fg-4);
      padding: 0 .25rem;
    }
    .modal-close:hover { color: var(--fg-2); }
  `],
})
export class MisProyectosPageComponent implements OnInit {
  private  readonly consumidorContext   = inject(ConsumidorContextService);
  private  readonly router              = inject(Router);
  protected readonly proyectosService   = inject(ProyectosService);
  protected readonly centrosService     = inject(CentrosService);
  protected readonly solicitudesService = inject(SolicitudesService);
  private  readonly documentosService   = inject(DocumentosService);
  protected readonly tiposService       = inject(TiposProyectoService);
  protected readonly authService        = inject(AuthService);

  protected modal            = signal<ProyectoModal>(null);
  protected mostrarBuscar = signal(false);
  protected busqueda      = signal('');

  get empresa() { return this.consumidorContext.empresaSeleccionada(); }

  protected centrosDeLaEmpresa = computed(() => {
    const emp = this.empresa;
    if (!emp) return [];
    return this.centrosService.centros().filter(c => asId(c.cliente_id) === asId(emp._id));
  });

  protected proyectos = computed(() => {
    const emp = this.consumidorContext.empresaSeleccionada();
    if (!emp) return [];
    return this.proyectosService.proyectos().filter(p => asId(p.cliente_id) === asId(emp._id));
  });

  protected proyectosFiltrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    if (!q) return this.proyectos();
    return this.proyectos().filter(p =>
      p.nombre.toLowerCase().includes(q) ||
      p.codigo.toLowerCase().includes(q) ||
      (p.descripcion ?? '').toLowerCase().includes(q)
    );
  });

  protected centrosConProyectos = computed(() => {
    const ps = this.proyectosFiltrados();
    const centros = this.centrosService.centros();
    const grupos = new Map<string, { nombre: string; proyectos: Proyecto[] }>();
    for (const p of ps) {
      for (const rawId of p.centro_costo_ids ?? []) {
        const cId = asId(rawId);
        if (!grupos.has(cId)) {
          const c = centros.find(c => asId(c._id) === cId);
          grupos.set(cId, { nombre: c?.nombre ?? '—', proyectos: [] });
        }
        grupos.get(cId)!.proyectos.push(p);
      }
    }
    return Array.from(grupos.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  private static readonly ESTADO_BADGE_STYLE: Record<string, string> = {
    estancado:            'background:var(--danger-bg);color:var(--danger)',
    nuevo_sin_oc:         'background:rgba(107,114,128,.12);color:var(--fg-4)',
    nuevo_con_oc:         'background:rgba(100,116,139,.12);color:var(--fg-3)',
    en_ejecucion:         'background:var(--ok-bg);color:var(--ok)',
    cierre_pendiente:     'background:rgba(124,58,237,.12);color:#7c3aed',
    finalizado_facturar:  'background:var(--warn-bg);color:var(--warn)',
    finalizado_facturado: 'background:rgba(13,148,136,.12);color:#0d9488',
  };

  protected estadoBadgeStyle(estado: string): string {
    return MisProyectosPageComponent.ESTADO_BADGE_STYLE[estado]
      ?? 'background:var(--border-subtle);color:var(--fg-4)';
  }

  protected estadoLabel(estado: string): string {
    return ESTADO_PROYECTO_LABEL[estado as EstadoProyecto] ?? estado;
  }

  toggleBuscar(): void {
    this.mostrarBuscar.update(v => !v);
    if (!this.mostrarBuscar()) this.busqueda.set('');
  }

  constructor() {
    effect(() => {
      const emp = this.consumidorContext.empresaSeleccionada();
      if (emp) {
        this.proyectosService.cargarPorEmpresa(emp._id);
        this.centrosService.cargarPorEmpresa(emp._id);
        this.solicitudesService.cargar(emp._id);
      }
    });

    effect(() => {
      const emp      = this.consumidorContext.empresaSeleccionada();
      const centros  = this.centrosService.centros()
        .filter(c => asId(c.cliente_id) === asId(emp?._id ?? ''));
      const proyectos = this.proyectos();
      if (!emp) return;
      this.documentosService.cargarTodosProyectos(emp._id, proyectos, centros);
    });

    effect(() => {
      if (this.proyectosService.status()?.type === 'ok' && this.modal() !== null) {
        this.cerrarModal();
      }
    });
  }

  ngOnInit(): void {
    this.tiposService.cargar();
  }


  scoreDeProyecto(proyectoId: string) {
    const sols = this.solicitudesService.solicitudes()
      .filter(s => asId(s.proyecto_id) === proyectoId);
    const grupo = this.documentosService.documentosPorProyecto()
      .find(g => g.proyectoId === proyectoId);
    const docsActivos = grupo?.docs.length ?? 0;
    return calcularScoreDocumental(sols, docsActivos, 0);
  }

  verDetalle(proyecto: Proyecto): void {
    this.consumidorContext.seleccionarProyecto(proyecto);
    this.router.navigate(['/mis-proyectos', proyecto._id]);
  }

  // ── Modal crear/editar ───────────────────────────────────────────────────
  abrirCrear(): void {
    const emp = this.empresa;
    if (!emp) return;
    this.proyectosService.seleccionado.set(null);
    this.proyectosService.centrosSeleccionados.set([]);
    this.proyectosService.clearStatus();
    this.modal.set('crear');
  }

  abrirEditar(proyecto: Proyecto): void {
    this.proyectosService.seleccionar(proyecto);
    this.proyectosService.clearStatus();
    this.modal.set('editar');
  }

  cerrarModal(): void {
    this.modal.set(null);
    this.proyectosService.seleccionado.set(null);
    this.proyectosService.centrosSeleccionados.set([]);
    this.proyectosService.clearStatus();
  }

  crear(dto: CreateProyectoDto): void { this.proyectosService.crear(dto); }

  actualizar(dto: CreateProyectoDto): void {
    const id = this.proyectosService.seleccionado()?._id;
    if (id) this.proyectosService.actualizar(id, dto);
  }

  eliminarProyecto(proyecto: Proyecto): void {
    if (!confirmarEliminacion(proyecto.nombre)) return;
    this.proyectosService.seleccionar(proyecto);
    this.proyectosService.eliminar(proyecto._id);
  }
}
