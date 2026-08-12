import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActividadesService } from '../actividades.service';
import { ActividadIconoComponent } from '../components/actividad-icono/actividad-icono.component';
import { TiposActividadService } from '../tipos-actividad.service';
import { CentrosService } from '../../centros/centros.service';
import { ActivosService } from '../../activos/activos.service';

import { ConsumidorContextService } from '../../../profile/consumidor-context.service';
import { Actividad, TipoActividad } from '../../../shared/models/actividad.model';
import { asId, toDateKey, actividadEnDia, posicionActividadEnDia, ordenarMultiDiaPrimero, barrasMultiDiaPorSemana, BarraMultiDia, layoutPorHora, BloqueHorario, rangoHora as formatRangoHora } from '../../../shared/utils';
import { createCalendarState, CalendarView, CALENDAR_DAYS, CALENDAR_MONTHS, DayCell } from '../../../shared/calendar-state';

@Component({
  selector: 'app-mis-actividades-page',
  standalone: true,
  imports: [FormsModule, SlicePipe, ActividadIconoComponent],
  templateUrl: './mis-actividades-page.component.html',
  styleUrl: './actividades-page.component.css',
})
export class MisActividadesPageComponent implements OnInit {
  protected readonly service        = inject(ActividadesService);
  protected readonly tiposService   = inject(TiposActividadService);
  protected readonly centrosService = inject(CentrosService);
  private   readonly ctx            = inject(ConsumidorContextService);
  protected readonly activosService = inject(ActivosService);

  constructor() {
    effect(() => {
      const empresa = this.ctx.empresaSeleccionada();
      if (empresa) {
        const id = empresa._id as string;
        this.centrosService.cargarPorEmpresa(id);
        this.service.cargarPorEmpresa(id);
      } else {
        this.service.actividades.set([]);
      }
    });

    effect(() => {
      const empresa = this.ctx.empresaSeleccionada();
      const centroIds = [...this.centroIdsPorEmpresa()];
      if (empresa && centroIds.length > 0) {
        this.activosService.cargarPorCentros(asId(empresa._id), centroIds);
      }
    });
  }

  private centroIdsPorEmpresa = computed((): Set<string> => {
    const empresa = this.ctx.empresaSeleccionada();
    if (!empresa) return new Set();
    return new Set(
      this.centrosService.centros()
        .filter(c => asId(c.cliente_id) === asId(empresa._id))
        .map(c => asId(c._id))
    );
  });

  protected filtroTiposIds = signal<string[]>([]);

  toggleFiltroTipo(id: string): void {
    this.filtroTiposIds.update(ids =>
      ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
    );
  }

  protected actividadDetalle = signal<Actividad | null>(null);

  protected activosDetalle = computed(() => {
    const a = this.actividadDetalle();
    if (!a || !a.activo_ids?.length) return [];
    const todos = this.activosService.activos();
    return a.activo_ids.map(x => {
      if (typeof x === 'object' && x !== null) return x as import('../../../shared/models/activo.model').Activo;
      return todos.find(y => asId(y._id) === asId(x as string)) ?? null;
    }).filter((x): x is import('../../../shared/models/activo.model').Activo => x !== null);
  });

  private tipoIdDe(a: Actividad): string {
    return asId(typeof a.tipo_id === 'object' ? (a.tipo_id as TipoActividad)._id : a.tipo_id as string);
  }

  protected historialDetalle = computed(() => {
    const a = this.actividadDetalle();
    if (!a) return [];
    const tipoId   = this.tipoIdDe(a);
    const centroId = asId(a.centro_costo_id);
    return this.service.actividades()
      .filter(x =>
        x._id !== a._id &&
        this.tipoIdDe(x) === tipoId &&
        asId(x.centro_costo_id) === centroId
      )
      .sort((x, y) => y.fecha.localeCompare(x.fecha))
      .slice(0, 5);
  });

  protected actividadesFiltradas = computed(() => {
    const empresa = this.ctx.empresaSeleccionada();
    const tipoIds = this.filtroTiposIds();
    let list = this.service.actividades();
    if (empresa) {
      const ids = this.centroIdsPorEmpresa();
      list = list.filter(a => ids.has(asId(a.centro_costo_id)));
    }
    if (tipoIds.length > 0) {
      list = list.filter(a => tipoIds.includes(this.tipoIdDe(a)));
    }
    return list;
  });

  readonly days   = CALENDAR_DAYS;
  readonly months = CALENDAR_MONTHS;

  private readonly _cal            = createCalendarState();
  protected readonly view           = this._cal.view;
  protected readonly reference      = this._cal.reference;
  protected readonly monthLabel     = this._cal.monthLabel;
  protected readonly weekLabel      = this._cal.weekLabel;
  protected readonly dayLabel       = this._cal.dayLabel;
  protected readonly calendarDays   = this._cal.calendarDays;
  protected readonly weekStart      = this._cal.weekStart;
  protected readonly weekDays       = this._cal.weekDays;
  navAnterior(): void  { this._cal.navAnterior(); }
  navSiguiente(): void { this._cal.navSiguiente(); }
  irAHoy(): void       { this._cal.irAHoy(); }
  setView(v: CalendarView): void { this._cal.setView(v); }
  isToday(date: Date): boolean   { return this._cal.isToday(date); }

  irADetalleDia(date: Date): void {
    this.reference.set(date);
    this.setView('day');
  }

  protected actividadSeleccionadaDia = signal<Actividad | null>(null);
  protected lupaActivosDia = signal(false);

  seleccionarActividadDia(a: Actividad): void {
    this.actividadSeleccionadaDia.set(a);
    this.actividadDetalle.set(a);
    this.lupaActivosDia.set(false);
    this.service.listarDocumentos(a._id);
  }

  protected centroNombre(a: Actividad): string {
    return this.centrosService.centros().find(c => asId(c._id) === asId(a.centro_costo_id))?.nombre ?? '';
  }

  protected tipoDeActividad(a: Actividad): TipoActividad | null {
    // Prioriza el tipo "vivo" del signal sobre el objeto embebido en la
    // actividad: si se edita el color/nombre de un tipo, las actividades ya
    // cargadas no se vuelven a pedir al backend y quedarían con datos viejos.
    const vivo = this.tiposService.tipos().find(t => asId(t._id) === this.tipoIdDe(a));
    if (vivo) return vivo;
    return typeof a.tipo_id === 'object' ? (a.tipo_id as TipoActividad) : null;
  }

  abrirDetalle(a: Actividad): void {
    this.actividadDetalle.set(a);
    this.service.listarDocumentos(a._id);
  }
  cerrarDetalle(): void { this.actividadDetalle.set(null); }

  descargarDocActividad(actividadId: string, docId: string, nombreDisplay?: string): void {
    this.service.descargarDocumento(actividadId, docId, nombreDisplay);
  }

  abrirDocActividad(linkUrl: string): void {
    window.open(linkUrl, '_blank');
  }

  actividadesEnDia(date: Date): Actividad[] {
    const key = toDateKey(date);
    return this.actividadesFiltradas().filter(a => actividadEnDia(a, key));
  }

  // Vista Mes: las multi-día se quedan como un chip más dentro de la celda
  // (sin barra); el detalle de hora/continuidad se ve en Semana o Día. Van
  // primero para no perderse con el tope de "primeras 2" y para que el chip
  // conector (--inicio/--medio/--fin) quede alineado día a día.
  primerasActividadesEnDia(date: Date): Actividad[] {
    return ordenarMultiDiaPrimero(this.actividadesEnDia(date), toDateKey(date)).slice(0, 2);
  }

  posicionEnDia(a: Actividad, date: Date): 'unico' | 'inicio' | 'medio' | 'fin' {
    return posicionActividadEnDia(a, toDateKey(date));
  }

  // Vista Mes agrupada por semana, para la franja zebra (ver .cal-week-row:nth-child(2n)).
  protected readonly semanasDelMes = computed((): DayCell[][] => {
    const dias = this.calendarDays();
    const semanas: DayCell[][] = [];
    for (let i = 0; i < dias.length; i += 7) semanas.push(dias.slice(i, i + 7));
    return semanas;
  });

  barrasSemanaActual(): { barras: BarraMultiDia<Actividad>[]; filas: number } {
    return barrasMultiDiaPorSemana(this.actividadesFiltradas(), this.weekDays());
  }

  // Grilla horaria (Semana): actividades de un solo día sin hora van en la
  // franja "Sin hora"; las multi-día se dibujan aparte como barra (barrasSemanaActual).
  actividadesSinHoraUnicas(date: Date): Actividad[] {
    const key = toDateKey(date);
    return this.actividadesEnDia(date).filter(a => !a.hora && posicionActividadEnDia(a, key) === 'unico');
  }

  // Vista Día: no hay "semana" sobre la cual dibujar una barra, así que la
  // franja "Sin hora" muestra también las multi-día (como un ítem más de la lista).
  actividadesSinHoraDia(date: Date): Actividad[] {
    return this.actividadesEnDia(date).filter(a => !a.hora);
  }

  bloquesHorarios(date: Date): BloqueHorario<Actividad>[] {
    return layoutPorHora(this.actividadesEnDia(date).filter(a => !!a.hora));
  }

  // Grilla horaria (Semana/Día): rango fijo 07:00–21:00, filas de 48px.
  protected readonly horasGrid = Array.from({ length: 15 }, (_, i) => `${String(7 + i).padStart(2, '0')}:00`);
  private readonly ROW_PX = 48;
  private readonly GRID_INICIO_MIN = 7 * 60;

  topPxDeHora(inicioMin: number): number {
    return (inicioMin - this.GRID_INICIO_MIN) * (this.ROW_PX / 60);
  }

  alturaBloquePx(duracionMin: number): number {
    return Math.max(duracionMin, 30) * (this.ROW_PX / 60);
  }

  rangoHora(a: Actividad): string {
    return formatRangoHora(a);
  }

  colorDeActividad(a: Actividad): string {
    if (typeof a.tipo_id === 'object') return (a.tipo_id as TipoActividad).color ?? '#9ca3af';
    return this.tiposService.tipos().find(t => t._id === this.tipoIdDe(a))?.color ?? '#9ca3af';
  }

  ngOnInit(): void {
    this.tiposService.cargar();
  }
}
