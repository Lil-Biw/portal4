import { Component, OnInit, inject, computed, effect, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { StatChipComponent, ChipVariant } from '../../../shared/components/stat-chip/stat-chip.component';
import { ConsumidorContextService } from '../../../profile/consumidor-context.service';
import { CentrosService } from '../../centros/centros.service';
import { ProyectosService } from '../../proyectos/proyectos.service';
import { SolicitudesService, Solicitud } from '../../solicitudes/solicitudes.service';
import { DocumentosService } from '../../documentos/documentos.service';
import { ActivosService } from '../../activos/activos.service';
import { ActividadesService } from '../../actividades/actividades.service';
import { TiposActividadService } from '../../actividades/tipos-actividad.service';
import { NoticiasService } from '../../noticias/noticias.service';
import { AuthService } from '../../auth/auth.service';
import { Actividad } from '../../../shared/models/actividad.model';
import { CentroCosto } from '../../../shared/models/centro.model';
import { SeccionNoticia } from '../../../shared/models/noticia.model';
import { asId, calcularScoreDocumental, scoreChipVariantFn, scoreChipLabelFn, porcentajeColorFn } from '../../../shared/utils';

interface ResumenSolicitudes {
  total: number;
  pct: number;
  pendiente: number;
  revision: number;
  aprobado: number;
  rechazado: number;
  vencido: number;
}

@Component({
  selector: 'app-inicio-page',
  standalone: true,
  imports: [StatChipComponent, RouterLink],
  templateUrl: './inicio-page.component.html',
})
export class InicioPageComponent implements OnInit {
  private readonly router                = inject(Router);
  private readonly consumidorContext     = inject(ConsumidorContextService);
  protected readonly centrosService      = inject(CentrosService);
  protected readonly proyectosService    = inject(ProyectosService);
  protected readonly solicitudesService  = inject(SolicitudesService);
  private readonly documentosService     = inject(DocumentosService);
  private readonly activosService        = inject(ActivosService);
  protected readonly actividadesService  = inject(ActividadesService);
  protected readonly tiposActividadService = inject(TiposActividadService);
  protected readonly noticiasService     = inject(NoticiasService);
  private readonly authService            = inject(AuthService);

  readonly fecha = new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  protected readonly saludo = computed(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Buen día' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  });

  protected readonly nombreUsuario = computed(() =>
    this.authService.usuarioActual()?.nombre ?? ''
  );

  protected empresaSeleccionada = computed(() => this.consumidorContext.empresaSeleccionada());

  protected centrosDeEmpresa = computed(() => {
    const empresa = this.consumidorContext.empresaSeleccionada();
    if (!empresa) return [];
    return this.centrosService.centros().filter(c => asId(c.cliente_id) === asId(empresa._id));
  });

  private centroIdsPorEmpresa = computed(() => {
    const empresa = this.consumidorContext.empresaSeleccionada();
    if (!empresa) return new Set<string>();
    return new Set(
      this.centrosService.centros()
        .filter(c => asId(c.cliente_id) === asId(empresa._id))
        .map(c => asId(c._id))
    );
  });

  protected tareasReales = computed(() =>
    this.solicitudesService.solicitudes()
      .filter(s => s.estado === 'pendiente' || s.estado === 'rechazado')
  );

  protected proxActividades = computed(() => {
    const ids = this.centroIdsPorEmpresa();
    if (ids.size === 0) return [];
    const hace30 = new Date();
    hace30.setDate(hace30.getDate() - 30);
    hace30.setHours(0, 0, 0, 0);
    return this.actividadesService.actividades()
      .filter(a => ids.has(asId(a.centro_costo_id)) && this.parseFechaLocal(a.fecha) >= hace30)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, 5);
  });

  protected scoreDocumental = computed(() => {
    const docsActivos =
      this.documentosService.documentosEmpresa().length +
      this.documentosService.documentosPorCentro().reduce((s, g) => s + g.docs.length, 0) +
      this.documentosService.documentosPorProyecto().reduce((s, g) => s + g.docs.length, 0);
    const docsVencidos = this.documentosService.documentosVencidos().length;
    return calcularScoreDocumental(this.solicitudesService.solicitudes(), docsActivos, docsVencidos);
  });

  protected scoreChipVariant = computed((): ChipVariant => scoreChipVariantFn(this.scoreDocumental().pct));

  protected scoreChipLabel = computed((): string => scoreChipLabelFn(this.scoreDocumental().pct));

  protected porcentajeColor(pct: number): string {
    return porcentajeColorFn(pct);
  }

  constructor() {
    effect(() => {
      const empresa = this.consumidorContext.empresaSeleccionada();
      if (empresa) {
        untracked(() => {
          this.centrosService.cargarPorEmpresa(empresa._id);
          this.proyectosService.cargarPorEmpresa(empresa._id);
          this.actividadesService.cargarPorEmpresa(empresa._id);
          this.solicitudesService.cargar(empresa._id);
        });
      } else {
        untracked(() => this.solicitudesService.cargar(''));
      }
    });

    effect(() => {
      const empresa   = this.consumidorContext.empresaSeleccionada();
      const centros   = this.centrosDeEmpresa();
      const proyectos = this.proyectosService.proyectos()
        .filter(p => asId(p.cliente_id) === asId(empresa?._id ?? ''));
      if (!empresa) return;
      untracked(() => {
        this.documentosService.cargarEmpresa(empresa._id);
        this.documentosService.cargarVencidos(empresa._id);
        this.documentosService.cargarTodosCentros(empresa._id, centros);
        this.documentosService.cargarTodosProyectos(empresa._id, proyectos, centros);
      });
    });
  }

  ngOnInit(): void {
    this.noticiasService.cargar();
    this.tiposActividadService.cargar();
  }

  protected tareaColor(estado: string): string {
    if (estado === 'rechazado') return '#ef4444';
    return '#0095d6';
  }

  protected tareaLabel(estado: string): string {
    const map: Record<string, string> = {
      pendiente: 'Pendiente', rechazado: 'Rechazado',
    };
    return map[estado] ?? estado;
  }

  protected proxChip(fecha: string): { label: string; variant: ChipVariant } {
    const dias = Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000);
    if (dias < 0)  return { label: 'Realizada', variant: 'ok' };
    if (dias <= 7) return { label: 'Esta semana', variant: 'warning' };
    return { label: 'Próximo', variant: 'neutral' };
  }

  protected formatFechaShort(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  protected abrirNoticia(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  protected irACentro(centro: CentroCosto): void {
    this.consumidorContext.seleccionarCentro(centro);
    const empresa = this.consumidorContext.empresaSeleccionada();
    if (empresa) {
      this.documentosService.cargar('centro', empresa._id, asId(centro._id));
      this.documentosService.cargarVencidos(empresa._id, asId(centro._id));
      this.activosService.cargarParaConsumidor(empresa._id, asId(centro._id));
      this.proyectosService.cargarParaConsumidor(empresa._id, asId(centro._id));
    }
    this.router.navigate(['/mis-centros']);
  }

  protected irATarea(t: Solicitud): void {
    this.router.navigate(['/documentos'], {
      queryParams: {
        tab: 'solicitudes',
        ...(t.proyecto_id ? { proyectoId: t.proyecto_id } : {}),
        ...(!t.proyecto_id && t.centro_costo_id ? { centroId: t.centro_costo_id } : {}),
      },
    });
  }

  protected irAActividades(): void {
    this.router.navigate(['/mis-actividades']);
  }

  protected irADocumentos(): void {
    this.router.navigate(['/documentos']);
  }

  protected resumenPorCentro = computed((): Map<string, ResumenSolicitudes> => {
    const result = new Map<string, ResumenSolicitudes>();
    for (const centro of this.centrosDeEmpresa()) {
      const centroId = asId(centro._id);
      const sols = this.solicitudesService.solicitudes()
        .filter(s => asId(s.centro_costo_id) === centroId);
      const docsActivos = this.documentosService.documentosPorCentro()
        .find(g => g.centroId === centroId)?.docs.length ?? 0;
      const score = calcularScoreDocumental(sols, docsActivos);
      result.set(centroId, {
        total:     score.total,
        pct:       score.pct,
        pendiente: score.pendiente,
        revision:  score.revision,
        aprobado:  score.aprobados,
        rechazado: score.rechazado,
        vencido:   score.vencido,
      });
    }
    return result;
  });

  resumenCentro(centroId: string): ResumenSolicitudes {
    return this.resumenPorCentro().get(centroId)
      ?? { total: 0, pct: 50, pendiente: 0, revision: 0, aprobado: 0, rechazado: 0, vencido: 0 };
  }

  protected nombreCentroById(id: string | undefined): string {
    if (!id) return '';
    return this.centrosService.centros().find(c => c._id === id)?.nombre ?? '';
  }

  private parseFechaLocal(iso: string): Date {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  protected actividadDia(iso: string): string {
    return this.parseFechaLocal(iso).toLocaleDateString('es-CL', { day: 'numeric' });
  }

  protected actividadMes(iso: string): string {
    return this.parseFechaLocal(iso)
      .toLocaleDateString('es-CL', { month: 'short' })
      .toUpperCase()
      .replace('.', '');
  }

  protected actividadFechaLabel(iso: string): string {
    const d = this.parseFechaLocal(iso);
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - hoy.getTime()) / 86400000);
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Mañana';
    if (diff > 1 && diff <= 7)
      return d.toLocaleDateString('es-CL', { weekday: 'short' })
        .replace('.', '')
        .split('')[0].toUpperCase() +
        d.toLocaleDateString('es-CL', { weekday: 'short' })
        .replace('.', '')
        .slice(1, 3);
    return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }).replace('.', '');
  }

  protected actividadColorTipo(a: Actividad): string {
    if (typeof a.tipo_id === 'object' && a.tipo_id !== null) {
      return (a.tipo_id as { color: string }).color ?? '#9ca3af';
    }
    const tipoId = a.tipo_id as string;
    return this.tiposActividadService.tipos().find(t => t._id === tipoId)?.color ?? '#9ca3af';
  }

  protected noticiaIconConfig(seccion: SeccionNoticia): { bg: string; color: string; tipo: 'carrito' | 'documento' | 'megafono' } {
    const map: Record<SeccionNoticia, { bg: string; color: string; tipo: 'carrito' | 'documento' | 'megafono' }> = {
      novedades:  { bg: '#dbeafe', color: '#1d4ed8', tipo: 'carrito' },
      normativas: { bg: '#fef3c7', color: '#b45309', tipo: 'documento' },
      anuncios:   { bg: '#dcfce7', color: '#15803d', tipo: 'megafono' },
    };
    return map[seccion] ?? { bg: '#f1f5f9', color: '#64748b', tipo: 'carrito' };
  }

}
