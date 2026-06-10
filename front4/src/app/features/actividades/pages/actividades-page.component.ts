import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActividadesService } from '../actividades.service';
import { TiposActividadService } from '../tipos-actividad.service';
import { CentrosService } from '../../centros/centros.service';
import { ClientesService } from '../../clientes/clientes.service';
import { ActivosService } from '../../activos/activos.service';
import { UsuariosService } from '../../usuarios/usuarios.service';
import { AuthService } from '../../auth/auth.service';

import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';
import { Actividad, TipoActividad } from '../../../shared/models/actividad.model';
import { asId, toDateKey } from '../../../shared/utils';
import { createCalendarState, CalendarView, CALENDAR_DAYS, CALENDAR_MONTHS } from '../../../shared/calendar-state';

interface ActividadForm {
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

function emptyForm(fecha = ''): ActividadForm {
  return { nombre: '', descripcion: '', tipo_id: '', empresa_id: '', centro_costo_id: '', activo_ids: [], fecha };
}
function emptyTipoForm(): TipoForm {
  return { nombre: '', color: '#0095d6', descripcion: '' };
}

@Component({
  selector: 'app-actividades-page',
  standalone: true,
  imports: [FormsModule, StatusBannerComponent],
  templateUrl: './actividades-page.component.html',
  styleUrl: './actividades-page.component.css',
})
export class ActividadesPageComponent implements OnInit {
  protected readonly service          = inject(ActividadesService);
  protected readonly tiposService     = inject(TiposActividadService);
  protected readonly centrosService   = inject(CentrosService);
  protected readonly clientesService  = inject(ClientesService);
  protected readonly activosService   = inject(ActivosService);
  protected readonly usuariosService  = inject(UsuariosService);
  private readonly authService        = inject(AuthService);

  protected puedeGestionarTipos = computed(() =>
    this.authService.usuarioActual()?.rol === 'super_admin'
  );

  protected centrosParaEmpresa = computed(() => {
    const empId = this.form().empresa_id;
    if (!empId) return [];
    return this.centrosService.centros().filter(c => asId(c.cliente_id) === empId);
  });

  protected activosParaCentro = computed(() =>
    this.activosService.activos().filter(a => asId(a.centro_costo_id) === this.form().centro_costo_id)
  );

  protected usuariosParaCentro = computed(() => {
    const centroId = this.form().centro_costo_id;
    if (!centroId) return [];
    return this.usuariosService.usuarios().filter(u =>
      u.rol === 'usuario' && u.centros_asignados.some(c => asId(c) === centroId)
    );
  });

  protected notifNotificar   = signal(true);
  protected notifTab         = signal<'usuarios' | 'admins' | 'super-admins'>('usuarios');
  protected notifUsuariosIds = signal<string[]>([]);
  protected notifAdminsIds   = signal<string[]>([]);
  protected notifSuperAdmins = signal(false);

  protected notifTodosUsuariosSeleccionados = computed(() => {
    const u = this.usuariosParaCentro();
    return u.length > 0 && u.every(x => this.notifUsuariosIds().includes(x._id));
  });

  protected notifTodosAdminsSeleccionados = computed(() => {
    const a = this.adminsParaEmpresa();
    return a.length > 0 && a.every(x => this.notifAdminsIds().includes(x._id));
  });

  protected adminsParaEmpresa = computed(() => {
    const empId = this.form().empresa_id;
    if (!empId) return [];
    return this.usuariosService.usuarios().filter(u =>
      u.rol === 'admin_smartclarity'
    );
  });

  protected superAdminsLista = computed(() =>
    this.usuariosService.usuarios().filter(u => u.rol === 'super_admin')
  );

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

  protected actividadesFiltradas = computed(() => {
    const empId  = this.filtroEmpresaId();
    const tipoId = this.filtroTipoId();
    let list = this.service.actividades();
    if (empId) {
      const ids = this.centroIdsPorEmpresa();
      list = list.filter(a => ids.has(asId(a.centro_costo_id)));
    }
    if (tipoId) {
      list = list.filter(a => asId(typeof a.tipo_id === 'object' ? (a.tipo_id as TipoActividad)._id : a.tipo_id as string) === tipoId);
    }
    return list;
  });

  readonly days   = CALENDAR_DAYS;
  readonly months = CALENDAR_MONTHS;

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

  actividadesEnDia(date: Date): Actividad[] {
    const key = toDateKey(date);
    return this.actividadesFiltradas().filter(a => a.fecha.slice(0, 10) === key);
  }

  tipoDeActividad(a: Actividad): TipoActividad | null {
    if (typeof a.tipo_id === 'object') return a.tipo_id as TipoActividad;
    return this.tiposService.tipos().find(t => t._id === asId(a.tipo_id as string)) ?? null;
  }

  colorDeActividad(a: Actividad): string {
    return this.tipoDeActividad(a)?.color ?? '#9ca3af';
  }

  protected showModal     = signal(false);
  protected editingId     = signal<string | null>(null);
  protected form          = signal<ActividadForm>(emptyForm());
  protected confirmDelete = signal<string | null>(null);

  protected docsPendientes: { file: File; nombre: string }[] = [];
  protected docNombreInput   = '';
  protected docFileSelected: File | null = null;
  protected subiendoDocs = false;

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

  subirDocActividad(): void {
    const id = this.editingId();
    if (!id || !this.docFileSelected) return;
    this.service.subirDocumento(id, this.docFileSelected, this.docNombreInput || undefined);
    this.docFileSelected = null;
    this.docNombreInput = '';
    this.docInputVisible.set(false);
    setTimeout(() => this.docInputVisible.set(true), 0);
  }

  eliminarDocActividad(nombre: string): void {
    const id = this.editingId();
    if (!id) return;
    this.service.eliminarDocumento(id, nombre);
  }

  descargarDocActividad(nombre: string, nombreDisplay?: string): void {
    const id = this.editingId();
    if (!id) return;
    this.service.descargarDocumento(id, nombre, nombreDisplay);
  }

  get actividadEditando() {
    const id = this.editingId();
    return id ? this.service.actividades().find(a => a._id === id) ?? null : null;
  }

  private subirDocsPendientesSecuencial(actividadId: string, index: number): void {
    if (index >= this.docsPendientes.length) {
      this.docsPendientes = [];
      this.subiendoDocs = false;
      this.cerrarModal();
      return;
    }
    const { file, nombre } = this.docsPendientes[index];
    this.service.subirDocumento(actividadId, file, nombre,
      () => { this.subirDocsPendientesSecuencial(actividadId, index + 1); },
      () => { this.subiendoDocs = false; },
    );
  }

  toggleNotifNotificar(): void { this.notifNotificar.update(v => !v); }
  toggleSeleccionarTodosUsuarios(): void {
    if (this.notifTodosUsuariosSeleccionados()) {
      this.notifUsuariosIds.set([]);
    } else {
      this.notifUsuariosIds.set(this.usuariosParaCentro().map(u => u._id));
    }
  }
  toggleSeleccionarTodosAdmins(): void {
    if (this.notifTodosAdminsSeleccionados()) {
      this.notifAdminsIds.set([]);
    } else {
      this.notifAdminsIds.set(this.adminsParaEmpresa().map(u => u._id));
    }
  }
  toggleNotifUsuario(id: string): void {
    this.notifUsuariosIds.update(ids =>
      ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
    );
  }
  toggleNotifAdmin(id: string): void {
    this.notifAdminsIds.update(ids =>
      ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
    );
  }

  private resetNotif(): void {
    this.notifNotificar.set(true);
    this.notifTab.set('usuarios');
    this.notifUsuariosIds.set(this.usuariosParaCentro().map(u => u._id));
    this.notifAdminsIds.set(this.adminsParaEmpresa().map(u => u._id));
    this.notifSuperAdmins.set(false);
  }

  abrirCrear(fecha = ''): void {
    this.editingId.set(null);
    this.form.set(emptyForm(fecha));
    this.docsPendientes = [];
    this.resetNotif();
    this.showModal.set(true);
    this.service.clearStatus();
  }

  abrirEditar(a: Actividad): void {
    this.editingId.set(a._id);
    const centroId = asId(a.centro_costo_id);
    const centro = this.centrosService.centros().find(c => asId(c._id) === centroId);
    this.form.set({
      nombre:          a.nombre,
      descripcion:     a.descripcion ?? '',
      tipo_id:         asId(typeof a.tipo_id === 'object' ? (a.tipo_id as TipoActividad)._id : a.tipo_id),
      empresa_id:      centro ? asId(centro.cliente_id) : '',
      centro_costo_id: centroId,
      activo_ids:      (a.activo_ids ?? []).map(x => asId(typeof x === 'object' ? (x as { _id: string })._id : x)),
      fecha:           a.fecha.slice(0, 10),
    });
    this.resetNotif();
    this.showModal.set(true);
    this.service.clearStatus();
  }

  cerrarModal(): void {
    this.showModal.set(false);
    this.editingId.set(null);
    this.confirmDelete.set(null);
  }

  patchForm(field: keyof ActividadForm, value: string | string[]): void {
    if (field === 'centro_costo_id') {
      this.form.update(f => ({ ...f, centro_costo_id: value as string, activo_ids: [] }));
      this.notifUsuariosIds.set(this.usuariosParaCentro().map(u => u._id));
    } else if (field === 'empresa_id') {
      this.form.update(f => ({ ...f, empresa_id: value as string }));
      this.notifAdminsIds.set(this.adminsParaEmpresa().map(u => u._id));
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
    const notif      = this.notifNotificar();
    const todosU     = this.usuariosParaCentro().map(u => u._id);
    const todosA     = this.adminsParaEmpresa().map(u => u._id);
    const selU       = this.notifUsuariosIds();
    const selA       = this.notifAdminsIds();
    const esCompleto = todosU.every(id => selU.includes(id)) && todosA.every(id => selA.includes(id));
    const superAdmins = this.notifSuperAdmins();
    const destinatariosAct = [...selU, ...selA];
    const notificacion = !notif
      ? { notificar: false }
      : esCompleto
        ? { notificar: true, audiencia: 'todos' as const, notificar_super_admins: superAdmins }
        : destinatariosAct.length > 0
          ? { notificar: true, audiencia: 'especificos' as const, destinatarios_ids: destinatariosAct, notificar_super_admins: superAdmins }
          : { notificar: false };
    const dto = {
      nombre:          f.nombre.trim(),
      descripcion:     f.descripcion.trim() || undefined,
      tipo_id:         f.tipo_id,
      centro_costo_id: f.centro_costo_id,
      activo_ids:      f.activo_ids.length > 0 ? f.activo_ids : undefined,
      fecha:           f.fecha,
      notificacion,
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

  eliminarActividad(id: string): void {
    this.service.eliminar(id);
    this.confirmDelete.set(null);
    this.cerrarModal();
  }

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

  abrirEditarTipo(t: TipoActividad): void {
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

  ngOnInit(): void {
    this.service.cargar();
    this.centrosService.cargar();
    this.tiposService.cargar();
    this.clientesService.cargar();
    this.activosService.cargar();
    this.usuariosService.cargar();
  }
}
