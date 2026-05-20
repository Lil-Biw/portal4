import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MantencionesService } from '../mantenciones.service';
import { TiposMantencionService } from '../tipos-mantencion.service';
import { CentrosService } from '../../centros/centros.service';
import { ClientesService } from '../../clientes/clientes.service';
import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';
import { Mantencion, TipoMantencion } from '../../../shared/models/mantencion.model';
import { asId, toDateKey } from '../../../shared/utils';

type CalendarView = 'month' | 'week';

interface DayCell {
  date: Date;
  currentMonth: boolean;
}

interface MantencionForm {
  nombre: string;
  descripcion: string;
  tipo_id: string;
  empresa_id: string;
  centro_costo_id: string;
  fecha: string;
}

interface TipoForm {
  nombre: string;
  color: string;
  descripcion: string;
}

function emptyForm(fecha = ''): MantencionForm {
  return { nombre: '', descripcion: '', tipo_id: '', empresa_id: '', centro_costo_id: '', fecha };
}
function emptyTipoForm(): TipoForm {
  return { nombre: '', color: '#0095d6', descripcion: '' };
}

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

@Component({
  selector: 'app-mantenciones-page',
  standalone: true,
  imports: [FormsModule, StatusBannerComponent],
  templateUrl: './mantenciones-page.component.html',
  styleUrl: './mantenciones-page.component.css',
})
export class MantencionesPageComponent implements OnInit {
  protected readonly service         = inject(MantencionesService);
  protected readonly tiposService    = inject(TiposMantencionService);
  protected readonly centrosService  = inject(CentrosService);
  protected readonly clientesService = inject(ClientesService);

  protected centrosParaEmpresa = computed(() => {
    const empId = this.form().empresa_id;
    if (!empId) return this.centrosService.centros();
    return this.centrosService.centros().filter(c => asId(c.cliente_id) === empId);
  });

  // ── Filtro de empresa para el calendario ────────────────────────────────
  protected filtroEmpresaId = signal<string>('');

  private centroIdsPorEmpresa = computed((): Set<string> => {
    const empId = this.filtroEmpresaId();
    if (!empId) return new Set();
    return new Set(
      this.centrosService.centros()
        .filter(c => asId(c.cliente_id) === empId)
        .map(c => asId(c._id))
    );
  });

  protected mantencionesFiltradas = computed(() => {
    const empId = this.filtroEmpresaId();
    if (!empId) return this.service.mantenciones();
    const ids = this.centroIdsPorEmpresa();
    return this.service.mantenciones().filter(m => ids.has(asId(m.centro_costo_id)));
  });

  readonly days  = DAYS;
  readonly months = MONTHS;

  // ── Calendario ──────────────────────────────────────────────────────────
  protected view      = signal<CalendarView>('month');
  protected reference = signal<Date>(new Date());   // referencia para mes/semana actual

  protected monthLabel = computed(() => {
    const d = this.reference();
    return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  });

  protected weekLabel = computed(() => {
    const start = this.weekStart();
    const end   = new Date(start); end.setDate(end.getDate() + 6);
    const fmt   = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()].slice(0,3)}`;
    return `${fmt(start)} – ${fmt(end)} ${end.getFullYear()}`;
  });

  protected calendarDays = computed((): DayCell[] => {
    const d = this.reference();
    const year = d.getFullYear(), month = d.getMonth();
    const firstDay  = new Date(year, month, 1);
    const lastDay   = new Date(year, month + 1, 0);
    // Monday-based: 0=Mon…6=Sun
    let startDow = (firstDay.getDay() + 6) % 7;
    const cells: DayCell[] = [];
    // Padding from prev month
    for (let i = startDow - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      cells.push({ date, currentMonth: false });
    }
    for (let d2 = 1; d2 <= lastDay.getDate(); d2++) {
      cells.push({ date: new Date(year, month, d2), currentMonth: true });
    }
    // Padding to fill last row (always 6 rows = 42 cells)
    while (cells.length < 42) {
      const date = new Date(year, month + 1, cells.length - lastDay.getDate() - startDow + 1);
      cells.push({ date, currentMonth: false });
    }
    return cells;
  });

  protected weekStart = computed((): Date => {
    const d   = new Date(this.reference());
    const dow = (d.getDay() + 6) % 7; // Monday = 0
    d.setDate(d.getDate() - dow);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  protected weekDays = computed((): Date[] => {
    const start = this.weekStart();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(d.getDate() + i); return d;
    });
  });

  // ── Mantenciones en un día ───────────────────────────────────────────────
  mantencionesEnDia(date: Date): Mantencion[] {
    const key = toDateKey(date);
    return this.mantencionesFiltradas().filter(m => m.fecha.slice(0, 10) === key);
  }

  tipoDeMantencion(m: Mantencion): TipoMantencion | null {
    if (typeof m.tipo_id === 'object') return m.tipo_id as TipoMantencion;
    return this.tiposService.tipos().find(t => t._id === asId(m.tipo_id as string)) ?? null;
  }

  colorDeMantencion(m: Mantencion): string {
    return this.tipoDeMantencion(m)?.color ?? '#9ca3af';
  }

  isToday(date: Date): boolean {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }

  // ── Navegación ───────────────────────────────────────────────────────────
  navAnterior(): void {
    this.reference.update(d => {
      const n = new Date(d);
      if (this.view() === 'month') n.setMonth(n.getMonth() - 1);
      else n.setDate(n.getDate() - 7);
      return n;
    });
  }

  navSiguiente(): void {
    this.reference.update(d => {
      const n = new Date(d);
      if (this.view() === 'month') n.setMonth(n.getMonth() + 1);
      else n.setDate(n.getDate() + 7);
      return n;
    });
  }

  irAHoy(): void { this.reference.set(new Date()); }

  setView(v: CalendarView): void { this.view.set(v); }

  // ── Modal mantención ─────────────────────────────────────────────────────
  protected showModal     = signal(false);
  protected editingId     = signal<string | null>(null);
  protected form          = signal<MantencionForm>(emptyForm());
  protected confirmDelete = signal<string | null>(null);

  abrirCrear(fecha = ''): void {
    this.editingId.set(null);
    this.form.set(emptyForm(fecha));
    this.showModal.set(true);
    this.service.clearStatus();
  }

  abrirEditar(m: Mantencion): void {
    this.editingId.set(m._id);
    const centroId = asId(m.centro_costo_id);
    const centro = this.centrosService.centros().find(c => asId(c._id) === centroId);
    this.form.set({
      nombre:          m.nombre,
      descripcion:     m.descripcion ?? '',
      tipo_id:         asId(typeof m.tipo_id === 'object' ? (m.tipo_id as TipoMantencion)._id : m.tipo_id),
      empresa_id:      centro ? asId(centro.cliente_id) : '',
      centro_costo_id: centroId,
      fecha:           m.fecha.slice(0, 10),
    });
    this.showModal.set(true);
    this.service.clearStatus();
  }

  cerrarModal(): void {
    this.showModal.set(false);
    this.editingId.set(null);
    this.confirmDelete.set(null);
  }

  patchForm(field: keyof MantencionForm, value: string): void {
    this.form.update(f => ({ ...f, [field]: value }));
  }

  guardar(): void {
    const f = this.form();
    if (!f.nombre.trim() || !f.tipo_id || !f.centro_costo_id || !f.fecha) return;
    const dto = {
      nombre:          f.nombre.trim(),
      descripcion:     f.descripcion.trim() || undefined,
      tipo_id:         f.tipo_id,
      centro_costo_id: f.centro_costo_id,
      fecha:           f.fecha,
    };
    const id = this.editingId();
    if (id) this.service.actualizar(id, dto);
    else    this.service.crear(dto);
  }

  eliminarMant(id: string): void {
    this.service.eliminar(id);
    this.confirmDelete.set(null);
    this.cerrarModal();
  }

  // ── Gestión de tipos ─────────────────────────────────────────────────────
  protected showTipos      = signal(false);
  protected editingTipoId  = signal<string | null>(null);
  protected tipoForm       = signal<TipoForm>(emptyTipoForm());
  protected showTipoForm   = signal(false);

  toggleTipos(): void { this.showTipos.update(v => !v); }

  abrirNuevoTipo(): void {
    this.editingTipoId.set(null);
    this.tipoForm.set(emptyTipoForm());
    this.showTipoForm.set(true);
    this.tiposService.clearStatus();
  }

  abrirEditarTipo(t: TipoMantencion): void {
    this.editingTipoId.set(t._id);
    this.tipoForm.set({ nombre: t.nombre, color: t.color, descripcion: t.descripcion ?? '' });
    this.showTipoForm.set(true);
    this.tiposService.clearStatus();
  }

  cerrarTipoForm(): void {
    this.showTipoForm.set(false);
    this.editingTipoId.set(null);
  }

  patchTipoForm(field: keyof TipoForm, value: string): void {
    this.tipoForm.update(f => ({ ...f, [field]: value }));
  }

  guardarTipo(): void {
    const f = this.tipoForm();
    if (!f.nombre.trim()) return;
    const dto = { nombre: f.nombre.trim(), color: f.color, descripcion: f.descripcion.trim() || undefined };
    const id = this.editingTipoId();
    if (id) this.tiposService.actualizar(id, dto);
    else     this.tiposService.crear(dto);
    this.cerrarTipoForm();
  }

  eliminarTipo(id: string): void { this.tiposService.eliminar(id); }

  constructor() {
    // Cierra el modal cuando el servidor confirma el guardado
    effect(() => {
      if (this.service.status()?.type === 'ok' && this.showModal()) {
        this.cerrarModal();
      }
    });
  }

  ngOnInit(): void {
    this.service.cargar();
    this.tiposService.cargar();
    this.centrosService.cargar();
    this.clientesService.cargar();
  }
}

