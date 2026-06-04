import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MantencionesService } from '../mantenciones.service';
import { TiposMantencionService } from '../tipos-mantencion.service';
import { CentrosService } from '../../centros/centros.service';
import { ActivosService } from '../../activos/activos.service';

import { ConsumidorContextService } from '../../../profile/consumidor-context.service';
import { Mantencion, TipoMantencion } from '../../../shared/models/mantencion.model';
import { asId, toDateKey } from '../../../shared/utils';
import { createCalendarState, CalendarView, CALENDAR_DAYS, CALENDAR_MONTHS } from '../../../shared/calendar-state';

@Component({
  selector: 'app-mis-mantenciones-page',
  standalone: true,
  imports: [FormsModule, SlicePipe],
  templateUrl: './mis-mantenciones-page.component.html',
  styleUrl: './mantenciones-page.component.css',
})
export class MisMantencionesPageComponent implements OnInit {
  protected readonly service        = inject(MantencionesService);
  protected readonly tiposService   = inject(TiposMantencionService);
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
        this.service.mantenciones.set([]);
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

  protected filtroTipoId = signal<string>('');

  protected mantencionDetalle = signal<Mantencion | null>(null);

  protected activosDetalle = computed(() => {
    const m = this.mantencionDetalle();
    if (!m || !m.activo_ids?.length) return [];
    const todos = this.activosService.activos();
    return m.activo_ids.map(a => {
      if (typeof a === 'object' && a !== null) return a as import('../../../shared/models/activo.model').Activo;
      return todos.find(x => asId(x._id) === asId(a as string)) ?? null;
    }).filter((a): a is import('../../../shared/models/activo.model').Activo => a !== null);
  });

  protected historialDetalle = computed(() => {
    const m = this.mantencionDetalle();
    if (!m) return [];
    const tipoId   = asId(typeof m.tipo_id === 'object' ? (m.tipo_id as TipoMantencion)._id : m.tipo_id as string);
    const centroId = asId(m.centro_costo_id);
    return this.service.mantenciones()
      .filter(x =>
        x._id !== m._id &&
        asId(typeof x.tipo_id === 'object' ? (x.tipo_id as TipoMantencion)._id : x.tipo_id as string) === tipoId &&
        asId(x.centro_costo_id) === centroId
      )
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, 5);
  });

  protected mantencionesFiltradas = computed(() => {
    const empresa = this.ctx.empresaSeleccionada();
    const tipoId  = this.filtroTipoId();
    let list = this.service.mantenciones();
    if (empresa) {
      const ids = this.centroIdsPorEmpresa();
      list = list.filter(m => ids.has(asId(m.centro_costo_id)));
    }
    if (tipoId) {
      list = list.filter(m => asId(typeof m.tipo_id === 'object' ? (m.tipo_id as TipoMantencion)._id : m.tipo_id as string) === tipoId);
    }
    return list;
  });

  readonly days   = CALENDAR_DAYS;
  readonly months = CALENDAR_MONTHS;

  // ── Calendario (lógica compartida) ──────────────────────────────────────
  private readonly _cal        = createCalendarState();
  protected readonly view       = this._cal.view;
  protected readonly reference  = this._cal.reference;
  protected readonly monthLabel  = this._cal.monthLabel;
  protected readonly weekLabel   = this._cal.weekLabel;
  protected readonly calendarDays = this._cal.calendarDays;
  protected readonly weekStart   = this._cal.weekStart;
  protected readonly weekDays    = this._cal.weekDays;
  navAnterior(): void  { this._cal.navAnterior(); }
  navSiguiente(): void { this._cal.navSiguiente(); }
  irAHoy(): void       { this._cal.irAHoy(); }
  setView(v: CalendarView): void { this._cal.setView(v); }
  isToday(date: Date): boolean   { return this._cal.isToday(date); }

  protected centroNombre(m: Mantencion): string {
    return this.centrosService.centros().find(c => asId(c._id) === asId(m.centro_costo_id))?.nombre ?? '';
  }

  protected tipoDeMantencion(m: Mantencion): TipoMantencion | null {
    if (typeof m.tipo_id === 'object') return m.tipo_id as TipoMantencion;
    return this.tiposService.tipos().find(t => t._id === asId(m.tipo_id as string)) ?? null;
  }

  abrirDetalle(m: Mantencion): void { this.mantencionDetalle.set(m); }
  cerrarDetalle(): void { this.mantencionDetalle.set(null); }

  descargarDocMantencion(mantencionId: string, nombre: string, nombreDisplay?: string): void {
    this.service.descargarDocumento(mantencionId, nombre, nombreDisplay);
  }

  mantencionesEnDia(date: Date): Mantencion[] {
    const key = toDateKey(date);
    return this.mantencionesFiltradas().filter(m => m.fecha.slice(0, 10) === key);
  }

  colorDeMantencion(m: Mantencion): string {
    if (typeof m.tipo_id === 'object') return (m.tipo_id as TipoMantencion).color ?? '#9ca3af';
    return this.tiposService.tipos().find(t => t._id === asId(m.tipo_id as string))?.color ?? '#9ca3af';
  }

  ngOnInit(): void {
    this.tiposService.cargar();
  }
}

