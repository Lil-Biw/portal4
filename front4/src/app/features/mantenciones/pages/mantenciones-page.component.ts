import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MantencionesService } from '../mantenciones.service';
import { TiposMantencionService } from '../tipos-mantencion.service';
import { CentrosService } from '../../centros/centros.service';
import { ClientesService } from '../../clientes/clientes.service';
import { ActivosService } from '../../activos/activos.service';

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
  activo_ids: string[];
  fecha: string;
}

interface TipoForm {
  nombre: string;
  color: string;
  descripcion: string;
}

function emptyForm(fecha = ''): MantencionForm {
  return { nombre: '', descripcion: '', tipo_id: '', empresa_id: '', centro_costo_id: '', activo_ids: [], fecha };
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
  protected readonly activosService  = inject(ActivosService);

  protected centrosParaEmpresa = computed(() => {
    const empId = this.form().empresa_id;
    if (!empId) return this.centrosService.centros();
    return this.centrosService.centros().filter(c => asId(c.cliente_id) === empId);
  });

  protected activosParaCentro = computed(() =>
    this.activosService.activos().filter(a => asId(a.centro_costo_id) === this.form().centro_costo_id)
  );

  // ── Filtros del calendario ───────────────────────────────────────────────
  protected filtroEmpresaId = signal<string>('');
  protected filtroTipoId    = signal<string>('');

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
    const empId  = this.filtroEmpresaId();
    const tipoId = this.filtroTipoId();
    let list = this.service.mantenciones();
    if (empId) {
      const ids = this.centroIdsPorEmpresa();
      list = list.filter(m => ids.has(asId(m.centro_costo_id)));
    }
    if (tipoId) {
      list = list.filter(m => asId(typeof m.tipo_id === 'object' ? (m.tipo_id as TipoMantencion)._id : m.tipo_id as string) === tipoId);
    }
    return list;
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

  // ── Documentos adjuntos ───────────────────────────────────────────────────
  protected docsPendientes: { file: File; nombre: string }[] = [];
  protected docNombreInput   = '';
  protected docFileSelected: File | null = null;
  protected subiendoDocs = false;

  // Para el picker de creación
  protected pendienteFileSelected: File | null = null;
  protected pendienteNombreInput = '';
  protected pendienteInputVisible = signal(true);

  onPendienteFileSelected(ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0] ?? null;
    this.pendienteFileSelected = file;
    if (file && !this.pendienteNombreInput)
      this.pendienteNombreInput = file.name.replace(/\.[^/.]+$/, '');
  }

  agregarDocPendiente(): void {
    if (!this.pendienteFileSelected) return;
    this.docsPendientes.push({ file: this.pendienteFileSelected, nombre: this.pendienteNombreInput || this.pendienteFileSelected.name });
    this.pendienteFileSelected = null;
    this.pendienteNombreInput = '';
    this.pendienteInputVisible.set(false);
    setTimeout(() => this.pendienteInputVisible.set(true), 0);
  }

  quitarDocPendiente(index: number): void {
    this.docsPendientes.splice(index, 1);
  }

  protected docInputVisible = signal(true);

  onDocFileSelected(ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0] ?? null;
    this.docFileSelected = file;
    if (file && !this.docNombreInput) this.docNombreInput = file.name.replace(/\.[^/.]+$/, '');
  }

  subirDocMantencion(): void {
    const id = this.editingId();
    if (!id || !this.docFileSelected) return;
    this.service.subirDocumento(id, this.docFileSelected, this.docNombreInput || undefined);
    this.docFileSelected = null;
    this.docNombreInput = '';
    // Recrea el input de archivo para limpiarlo visualmente
    this.docInputVisible.set(false);
    setTimeout(() => this.docInputVisible.set(true), 0);
  }

  eliminarDocMantencion(nombre: string): void {
    const id = this.editingId();
    if (!id) return;
    this.service.eliminarDocumento(id, nombre);
  }

  descargarDocMantencion(nombre: string, nombreDisplay?: string): void {
    const id = this.editingId();
    if (!id) return;
    this.service.descargarDocumento(id, nombre, nombreDisplay);
  }

  get mantencionEditando() {
    const id = this.editingId();
    return id ? this.service.mantenciones().find(m => m._id === id) ?? null : null;
  }

  private subirDocsPendientesSecuencial(mantencionId: string, index: number): void {
    if (index >= this.docsPendientes.length) {
      this.docsPendientes = [];
      this.subiendoDocs = false;
      this.cerrarModal();
      return;
    }
    const { file, nombre } = this.docsPendientes[index];
    this.service.subirDocumento(mantencionId, file, nombre, () => {
      this.subirDocsPendientesSecuencial(mantencionId, index + 1);
    });
  }

  abrirCrear(fecha = ''): void {
    this.editingId.set(null);
    this.form.set(emptyForm(fecha));
    this.docsPendientes = [];
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
      activo_ids:      m.activo_ids ?? [],
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

  patchForm(field: keyof MantencionForm, value: string | string[]): void {
    if (field === 'centro_costo_id') {
      this.form.update(f => ({ ...f, centro_costo_id: value as string, activo_ids: [] }));
    } else {
      this.form.update(f => ({ ...f, [field]: value }));
    }
  }

  toggleActivo(activoId: string): void {
    this.form.update(f => {
      const ids = f.activo_ids.includes(activoId)
        ? f.activo_ids.filter(id => id !== activoId)
        : [...f.activo_ids, activoId];
      return { ...f, activo_ids: ids };
    });
  }

  guardar(): void {
    const f = this.form();
    if (!f.nombre.trim() || !f.tipo_id || !f.centro_costo_id || !f.fecha) return;
    const dto = {
      nombre:          f.nombre.trim(),
      descripcion:     f.descripcion.trim() || undefined,
      tipo_id:         f.tipo_id,
      centro_costo_id: f.centro_costo_id,
      activo_ids:      f.activo_ids.length > 0 ? f.activo_ids : undefined,
      fecha:           f.fecha,
    };
    const id = this.editingId();
    if (id) {
      this.service.actualizar(id, dto, () => this.cerrarModal());
    } else {
      this.service.crear(dto, (nueva) => {
        if (this.docsPendientes.length === 0) {
          this.cerrarModal();
          return;
        }
        this.subiendoDocs = true;
        this.editingId.set(nueva._id);
        this.subirDocsPendientesSecuencial(nueva._id, 0);
      });
    }
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

  constructor() {}

  ngOnInit(): void {
    this.service.cargar();
    this.tiposService.cargar();
    this.centrosService.cargar();
    this.clientesService.cargar();
    this.activosService.cargar();
  }
}

