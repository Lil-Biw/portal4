import {
  Component, EventEmitter, Input, OnChanges, Output,
  SimpleChanges, computed, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Activo, CreateActivoDto, DocActivo, TipoActivo } from '../../../../shared/models/activo.model';
import { CentroCosto } from '../../../../shared/models/centro.model';
import { Cliente } from '../../../../shared/models/cliente.model';
import { asId } from '../../../../shared/utils';
import { UploadDocumentFormComponent } from '../../../../shared/components/upload-document-form/upload-document-form.component';
import { ActivoIconoComponent } from '../activo-icono/activo-icono.component';
import { DocumentCardListComponent } from '../../../../shared/components/document-card-list/document-card-list.component';
import { DocumentoTarjeta } from '../../../../shared/models/documento-tarjeta.model';

export interface DocPendiente { localId?: string; file?: File; linkUrl?: string; nombre: string; }

@Component({
  selector: 'app-activos-form',
  standalone: true,
  imports: [FormsModule, UploadDocumentFormComponent, ActivoIconoComponent, DocumentCardListComponent],
  styles: [`
    .form-dos-col {
      display: grid;
      grid-template-columns: minmax(300px, 360px) 1fr;
      gap: 1.25rem 2rem;
      align-items: start;
    }
    .col-params { display: flex; flex-direction: column; gap: .75rem; }
    .col-docs   { display: flex; flex-direction: column; gap: .5rem; }
    .col-docs h4 {
      margin: 0 0 .4rem;
      font-size: .85rem;
      font-weight: 700;
      color: var(--fg-2);
    }
    .form-footer {
      display: flex;
      justify-content: flex-end;
      gap: .5rem;
      margin-top: 1.25rem;
      padding-top: 1rem;
      border-top: 1px solid #f3f4f6;
    }
    @media (max-width: 600px) {
      .form-dos-col { grid-template-columns: 1fr; }
    }
    .tipo-combo { position: relative; }
    .tipo-combo-input {
      width: 100%; box-sizing: border-box;
      padding: .55rem .75rem; padding-right: 2rem;
      border: 1px solid var(--border-default); border-radius: 8px;
      font-size: .875rem; color: var(--fg-2); font-family: inherit;
      background: var(--bg-0); cursor: text; outline: none;
      transition: border-color .15s;
    }
    .tipo-combo-input:focus { border-color: var(--sc-cyan); }
    .tipo-combo-input::placeholder { color: var(--fg-5); }
    .tipo-combo-arrow {
      position: absolute; right: .65rem; top: 50%; transform: translateY(-50%);
      pointer-events: none; color: var(--fg-5); display: flex; align-items: center;
    }
    .tipo-combo-dropdown {
      position: absolute; top: calc(100% + 4px); left: 0; right: 0;
      background: var(--bg-0); border: 1px solid var(--border-default); border-radius: 8px;
      box-shadow: var(--shadow-3); z-index: 200;
      max-height: 200px; overflow-y: auto;
    }
    .tipo-combo-option {
      padding: .5rem .75rem; font-size: .875rem; color: var(--fg-2);
      cursor: pointer; display: flex; align-items: center; gap: .5rem;
      transition: background .1s;
    }
    .tipo-combo-option:hover, .tipo-combo-option--active { background: var(--sc-cyan-tint-6); color: var(--sc-cyan); }
    .tipo-combo-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .tipo-combo-empty { padding: .5rem .75rem; font-size: .83rem; color: var(--fg-5); }
  `],
  template: `
    <form (ngSubmit)="enviar()">
      <div class="form-dos-col">

        <!-- ── Columna izquierda: parámetros ── -->
        <div class="col-params">
          @if (!centroFijo) {
            <div class="field">
              <label>Empresa *</label>
              <select [ngModel]="empresaId()" name="empresa_id" (ngModelChange)="onEmpresaChange($event)">
                <option value="">Selecciona una empresa</option>
                @for (e of clientes; track e._id) {
                  <option [value]="e._id">{{ e.razon_social }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label>Centro de costos *</label>
              <select [(ngModel)]="form.centro_costo_id" name="centro_costo_id" [disabled]="!empresaId()" required>
                <option value="">{{ empresaId() ? 'Selecciona un centro' : 'Primero selecciona una empresa' }}</option>
                @for (c of centrosFiltrados(); track c._id) {
                  <option [value]="c._id">{{ c.nombre }}</option>
                }
              </select>
            </div>
          } @else {
            <div class="field">
              <label>Centro de costos</label>
              <input type="text" [value]="centroFijo.nombre" disabled />
            </div>
          }
          <div class="field">
            <label>Nombre *</label>
            <input type="text" [(ngModel)]="form.nombre" name="nombre" required placeholder="Ej: Caldera principal" />
          </div>
          <div class="field">
            <label>Tipo de activo *</label>
            <div class="tipo-combo">
              <input
                class="tipo-combo-input"
                type="text"
                placeholder="Buscar tipo de activo..."
                [ngModel]="tipoQuery()"
                name="tipo_query"
                (ngModelChange)="onTipoInput($event)"
                (focus)="tipoDropdownOpen.set(true)"
                (blur)="onTipoBlur()"
                (keydown.enter)="$event.preventDefault()"
                autocomplete="off" />
              <span class="tipo-combo-arrow">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </span>
              @if (tipoDropdownOpen()) {
                <div class="tipo-combo-dropdown">
                  @for (t of tiposFiltrados(); track t._id) {
                    <div
                      class="tipo-combo-option"
                      [class.tipo-combo-option--active]="form.tipo_activo_id === t._id"
                      (mousedown)="selectTipo(t)">
                      <app-activo-icono [icono]="t.icono" [color]="t.color" [size]="14"></app-activo-icono>
                      {{ t.nombre }}
                    </div>
                  }
                  @if (tiposFiltrados().length === 0) {
                    <div class="tipo-combo-empty">Sin resultados para "{{ tipoQuery() }}"</div>
                  }
                </div>
              }
            </div>
          </div>
          <div class="field">
            <label>Descripción</label>
            <input type="text" [(ngModel)]="form.descripcion" name="descripcion" placeholder="Descripción opcional" />
          </div>
        </div>

        <!-- ── Columna derecha: documentos ── -->
        <div class="col-docs">
          <h4>Documentos adjuntos</h4>

          @if (!editingId) {
            <app-document-card-list
              [documentos]="docsPendientesTarjetas"
              (eliminar)="docQuitado.emit($event)" />
          } @else {
            <app-document-card-list
              [documentos]="docsExistentesTarjetas"
              [puedeEliminar]="puedeEliminarDoc"
              (descargar)="onDescargarDocId($event)"
              (abrirLink)="onAbrirDoc($event)"
              (eliminar)="onEliminarDoc($event)"
              (renombrar)="docRenombrado.emit($event)" />
          }

          <!-- Upload -->
          <app-upload-document-form
            style="display:block"
            [mostrarTipoDocumento]="false"
            [mostrarNombre]="false"
            [ocultarBotonConfirmarArchivo]="true"
            [modo]="modo()" (modoChange)="setModo($event)"
            [archivo]="null" (archivoChange)="onArchivoChange($event)"
            [(link)]="linkInput"
            [linkInvalido]="linkInvalido()"
            [confirmLabel]="editingId ? 'Adjuntar' : '+ Agregar a la lista'"
            [showCancel]="false"
            [confirmDisabled]="!linkInput.trim() || linkInvalido()"
            (confirmar)="editingId ? subirLinkExistente() : agregarLinkPendiente()" />
        </div>

      </div>

      <!-- Footer -->
      <div class="form-footer">
        <button type="button" class="btn-ghost" (click)="cancelar.emit()">Cancelar</button>
        <button type="submit" class="btn-primary"
          [disabled]="!form.nombre || !form.tipo_activo_id || (!centroFijo && !form.centro_costo_id)">
          {{ submitLabel }}
        </button>
      </div>
    </form>
  `,
})
export class ActivosFormComponent implements OnChanges {
  @Input() initial: Activo | null = null;
  @Input() centroFijo: CentroCosto | null = null;
  @Input() centros: CentroCosto[] = [];
  @Input() clientes: Cliente[] = [];
  @Input() tipos: TipoActivo[] = [];
  @Input() editingId: string | null = null;
  @Input() docsPendientes: DocPendiente[] = [];
  @Input() docsExistentes: DocActivo[] = [];
  @Input() subiendoCards: { id: string; nombre: string }[] = [];
  @Input() eliminandoDocIds: Set<string> = new Set();
  @Input() puedeEliminarDoc = true;
  @Input() submitLabel = 'Guardar activo';

  @Output() submitted       = new EventEmitter<CreateActivoDto>();
  @Output() cancelar        = new EventEmitter<void>();
  @Output() docAgregado     = new EventEmitter<DocPendiente>();
  @Output() docQuitado      = new EventEmitter<string>();
  @Output() docSubido       = new EventEmitter<DocPendiente>();
  @Output() docEliminado    = new EventEmitter<string>();
  @Output() docDescargado   = new EventEmitter<{ docId: string; nombreDisplay?: string }>();
  @Output() docRenombrado   = new EventEmitter<{ id: string; nuevoNombre: string }>();

  empresaId = signal('');
  form: CreateActivoDto = { nombre: '', tipo_activo_id: '', centro_costo_id: '', descripcion: '' };

  tipoQuery         = signal('');
  tipoDropdownOpen  = signal(false);
  private _tipos    = signal<TipoActivo[]>([]);

  tiposFiltrados = computed(() => {
    const q = this.tipoQuery().toLowerCase().trim();
    if (!q) return this._tipos();
    return this._tipos().filter(t => t.nombre.toLowerCase().includes(q));
  });

  linkInput = '';
  modo = signal<'archivo' | 'link'>('archivo');

  setModo(modo: 'archivo' | 'link'): void {
    if (this.modo() === modo) return;
    this.modo.set(modo);
    this.linkInput = '';
  }

  linkInvalido(): boolean {
    const link = this.linkInput.trim();
    if (!link) return false;
    return !/^https?:\/\/.+/i.test(link);
  }

  onAbrirDoc(url: string): void {
    window.open(url, '_blank');
  }

  private _centros = signal<CentroCosto[]>([]);

  centrosFiltrados = computed(() => {
    if (!this.empresaId()) return [];
    return this._centros().filter(c => asId(c.cliente_id) === this.empresaId());
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['centros']) {
      this._centros.set(this.centros);
    }
    if (changes['tipos']) {
      this._tipos.set(this.tipos);
      this.syncTipoQuery();
    }
    if (changes['initial']) {
      if (this.initial) {
        const tipoId = typeof this.initial.tipo_activo_id === 'object'
          ? (this.initial.tipo_activo_id as TipoActivo)._id
          : this.initial.tipo_activo_id as string;
        this.form = {
          nombre:          this.initial.nombre,
          tipo_activo_id:  tipoId,
          centro_costo_id: this.initial.centro_costo_id,
          descripcion:     this.initial.descripcion ?? '',
        };
        const centro = this.centros.find(c => asId(c._id) === asId(this.initial!.centro_costo_id));
        this.empresaId.set(centro ? asId(centro.cliente_id) : '');
      } else {
        this.form = {
          nombre:          '',
          tipo_activo_id:  '',
          centro_costo_id: this.centroFijo?._id ?? '',
          descripcion:     '',
        };
        this.empresaId.set('');
        this.tipoQuery.set('');
      }
      if (this.centroFijo) {
        this.form.centro_costo_id = this.centroFijo._id;
      }
      this.syncTipoQuery();
    }
  }

  private syncTipoQuery(): void {
    if (!this.form.tipo_activo_id) return;
    const tipo = this.tipos.find(t => t._id === this.form.tipo_activo_id);
    if (tipo) this.tipoQuery.set(tipo.nombre);
  }

  onTipoInput(q: string): void {
    this.tipoQuery.set(q);
    this.form.tipo_activo_id = '';
    this.tipoDropdownOpen.set(true);
  }

  selectTipo(t: TipoActivo): void {
    this.form.tipo_activo_id = t._id;
    this.tipoQuery.set(t.nombre);
    this.tipoDropdownOpen.set(false);
  }

  onTipoBlur(): void {
    setTimeout(() => {
      this.tipoDropdownOpen.set(false);
      if (!this.form.tipo_activo_id) this.tipoQuery.set('');
    }, 150);
  }

  onEmpresaChange(empresaId: string): void {
    this.empresaId.set(empresaId);
    this.form.centro_costo_id = '';
  }

  private nuevoLocalId(): string {
    return `pend-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  protected get docsPendientesTarjetas(): DocumentoTarjeta[] {
    return this.docsPendientes.map(d => ({
      id: d.localId!,
      nombre: d.nombre,
      tipoContenido: d.linkUrl ? 'link' : 'archivo',
      linkUrl: d.linkUrl,
      estado: 'pendiente' as const,
    }));
  }

  protected get docsExistentesTarjetas(): DocumentoTarjeta[] {
    const existentes: DocumentoTarjeta[] = this.docsExistentes.map(doc => ({
      id: doc._id,
      nombre: doc.nombre_display,
      tipoContenido: doc.tipo_contenido ?? 'archivo',
      linkUrl: doc.link_url,
      estado: this.eliminandoDocIds.has(doc._id) ? 'eliminando' as const : 'listo' as const,
    }));
    const subiendo: DocumentoTarjeta[] = this.subiendoCards.map(c => ({
      id: c.id,
      nombre: c.nombre,
      tipoContenido: 'archivo' as const,
      estado: 'subiendo' as const,
    }));
    return [...existentes, ...subiendo];
  }

  onArchivoChange(file: File | null): void {
    if (!file) return;
    if (this.editingId) {
      this.docSubido.emit({ file, nombre: file.name });
    } else {
      this.docAgregado.emit({ localId: this.nuevoLocalId(), file, nombre: file.name });
    }
  }

  agregarLinkPendiente(): void {
    const link = this.linkInput.trim();
    if (!link || this.linkInvalido()) return;
    this.docAgregado.emit({ localId: this.nuevoLocalId(), linkUrl: link, nombre: link });
    this.linkInput = '';
  }

  subirLinkExistente(): void {
    const link = this.linkInput.trim();
    if (!link || this.linkInvalido()) return;
    this.docSubido.emit({ linkUrl: link, nombre: link });
    this.linkInput = '';
  }

  onEliminarDoc(docId: string): void  { this.docEliminado.emit(docId); }
  onDescargarDoc(docId: string, nombreDisplay: string): void {
    this.docDescargado.emit({ docId, nombreDisplay });
  }
  onDescargarDocId(docId: string): void {
    const doc = this.docsExistentes.find(d => d._id === docId);
    this.docDescargado.emit({ docId, nombreDisplay: doc?.nombre_display });
  }

  enviar(): void {
    if (!this.form.nombre || !this.form.tipo_activo_id || !this.form.centro_costo_id) return;
    const dto: CreateActivoDto = {
      nombre:          this.form.nombre.trim(),
      tipo_activo_id:  this.form.tipo_activo_id,
      centro_costo_id: this.form.centro_costo_id,
    };
    if (this.form.descripcion?.trim()) dto.descripcion = this.form.descripcion.trim();
    this.submitted.emit(dto);
  }
}
