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

export interface DocPendiente { file?: File; linkUrl?: string; nombre: string; }

@Component({
  selector: 'app-activos-form',
  standalone: true,
  imports: [FormsModule, UploadDocumentFormComponent, ActivoIconoComponent],
  styles: [`
    .form-dos-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem 2rem;
      align-items: start;
    }
    .col-params { display: flex; flex-direction: column; gap: .75rem; }
    .col-docs   { display: flex; flex-direction: column; gap: .5rem; }
    .col-docs h4 {
      margin: 0 0 .4rem;
      font-size: .85rem;
      font-weight: 700;
      color: #374151;
    }
    .doc-lista {
      max-height: 180px;
      overflow-y: auto;
      border: 1px solid rgba(34,33,33,.15);
      border-radius: 8px;
      padding: .35rem .6rem;
      margin-bottom: .35rem;
    }
    .doc-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: .4rem;
      padding: .3rem 0;
      border-bottom: 1px solid #f3f4f6;
      font-size: .81rem;
    }
    .doc-item:last-child { border-bottom: none; }
    .doc-nombre {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #1f2937;
    }
    .doc-acciones { display: flex; gap: .3rem; flex-shrink: 0; }
    .doc-empty { font-size: .8rem; color: #9ca3af; padding: .3rem 0; }
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
      border: 1px solid rgba(34,33,33,.15); border-radius: 8px;
      font-size: .875rem; color: #1f2937; font-family: inherit;
      background: #fff; cursor: text; outline: none;
      transition: border-color .15s;
    }
    .tipo-combo-input:focus { border-color: #0095d6; }
    .tipo-combo-input::placeholder { color: #9ca3af; }
    .tipo-combo-arrow {
      position: absolute; right: .65rem; top: 50%; transform: translateY(-50%);
      pointer-events: none; color: #9ca3af; display: flex; align-items: center;
    }
    .tipo-combo-dropdown {
      position: absolute; top: calc(100% + 4px); left: 0; right: 0;
      background: #fff; border: 1px solid rgba(34,33,33,.15); border-radius: 8px;
      box-shadow: 0 8px 24px rgba(15,23,42,.12); z-index: 200;
      max-height: 200px; overflow-y: auto;
    }
    .tipo-combo-option {
      padding: .5rem .75rem; font-size: .875rem; color: #374151;
      cursor: pointer; display: flex; align-items: center; gap: .5rem;
      transition: background .1s;
    }
    .tipo-combo-option:hover, .tipo-combo-option--active { background: #f0f9ff; color: #0095d6; }
    .tipo-combo-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .tipo-combo-empty { padding: .5rem .75rem; font-size: .83rem; color: #9ca3af; }
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
            <!-- Modo creación: lista pendientes -->
            @if (docsPendientes.length > 0) {
              <div class="doc-lista">
                @for (doc of docsPendientes; track $index) {
                  <div class="doc-item">
                    <span class="doc-nombre" [title]="doc.nombre">{{ doc.nombre }}</span>
                    <div class="doc-acciones">
                      <button type="button" class="btn-danger btn-sm" (click)="onQuitarDoc($index)">Quitar</button>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <p class="doc-empty">Sin documentos pendientes.</p>
            }
          } @else {
            <!-- Modo edición: lista existentes -->
            @if (docsExistentes.length > 0) {
              <div class="doc-lista">
                @for (doc of docsExistentes; track doc._id) {
                  <div class="doc-item">
                    <span class="doc-nombre" [title]="doc.nombre_display">{{ doc.nombre_display }}</span>
                    <div class="doc-acciones">
                      @if (doc.tipo_contenido === 'link') {
                        <button type="button" class="btn-ghost btn-sm" (click)="onAbrirDoc(doc.link_url!)">↗</button>
                      } @else {
                        <button type="button" class="btn-ghost btn-sm" (click)="onDescargarDoc(doc._id, doc.nombre_display)">↓</button>
                      }
                      <button type="button" class="btn-danger btn-sm" (click)="onEliminarDoc(doc._id)">✕</button>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <p class="doc-empty">Sin documentos adjuntos.</p>
            }
          }

          <!-- Upload -->
          <app-upload-document-form
            style="display:block"
            [mostrarTipoDocumento]="false"
            [modo]="modo()" (modoChange)="setModo($event)"
            [archivo]="fileSelected" (archivoChange)="onArchivoChange($event)"
            [(link)]="linkInput"
            [(nombre)]="nombreInput"
            [linkInvalido]="linkInvalido()"
            [confirmLabel]="editingId ? 'Adjuntar' : '+ Agregar a la lista'"
            [showCancel]="false"
            [confirmDisabled]="modo()==='archivo' ? !fileSelected : (!linkInput.trim() || linkInvalido())"
            (confirmar)="editingId ? subirExistente() : agregarPendiente()" />
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
  @Input() submitLabel = 'Guardar activo';

  @Output() submitted       = new EventEmitter<CreateActivoDto>();
  @Output() cancelar        = new EventEmitter<void>();
  @Output() docAgregado     = new EventEmitter<DocPendiente>();
  @Output() docQuitado      = new EventEmitter<number>();
  @Output() docSubido       = new EventEmitter<DocPendiente>();
  @Output() docEliminado    = new EventEmitter<string>();
  @Output() docDescargado   = new EventEmitter<{ docId: string; nombreDisplay?: string }>();

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

  fileSelected: File | null = null;
  nombreInput = '';
  linkInput = '';
  modo = signal<'archivo' | 'link'>('archivo');

  setModo(modo: 'archivo' | 'link'): void {
    if (this.modo() === modo) return;
    this.modo.set(modo);
    this.fileSelected = null;
    this.linkInput = '';
    this.nombreInput = '';
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

  onArchivoChange(file: File | null): void {
    this.fileSelected = file;
    if (file && !this.nombreInput) {
      this.nombreInput = file.name.replace(/\.[^/.]+$/, '');
    }
  }

  agregarPendiente(): void {
    if (this.modo() === 'link') {
      const link = this.linkInput.trim();
      if (!link || this.linkInvalido()) return;
      this.docAgregado.emit({ linkUrl: link, nombre: this.nombreInput || link });
    } else {
      if (!this.fileSelected) return;
      this.docAgregado.emit({ file: this.fileSelected, nombre: this.nombreInput || this.fileSelected.name });
    }
    this.fileSelected = null;
    this.nombreInput = '';
    this.linkInput = '';
  }

  subirExistente(): void {
    if (this.modo() === 'link') {
      const link = this.linkInput.trim();
      if (!link || this.linkInvalido()) return;
      this.docSubido.emit({ linkUrl: link, nombre: this.nombreInput || link });
    } else {
      if (!this.fileSelected) return;
      this.docSubido.emit({ file: this.fileSelected, nombre: this.nombreInput || this.fileSelected.name });
    }
    this.fileSelected = null;
    this.nombreInput = '';
    this.linkInput = '';
  }

  onQuitarDoc(index: number): void    { this.docQuitado.emit(index); }
  onEliminarDoc(docId: string): void  { this.docEliminado.emit(docId); }
  onDescargarDoc(docId: string, nombreDisplay: string): void {
    this.docDescargado.emit({ docId, nombreDisplay });
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
