import {
  Component, EventEmitter, Input, OnChanges, Output,
  SimpleChanges, computed, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Activo, CreateActivoDto, DocActivo } from '../../../../shared/models/activo.model';
import { CentroCosto } from '../../../../shared/models/centro.model';
import { Cliente } from '../../../../shared/models/cliente.model';
import { asId } from '../../../../shared/utils';

export interface DocPendiente { file: File; nombre: string; }

@Component({
  selector: 'app-activos-form',
  standalone: true,
  imports: [FormsModule],
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
    .doc-upload { display: flex; flex-direction: column; gap: .35rem; margin-top: .25rem; }
    .doc-file-input {
      font-size: .8rem;
      padding: .25rem;
      border: 1px solid rgba(34,33,33,.2);
      border-radius: .375rem;
      width: 100%;
      box-sizing: border-box;
    }
    .doc-nombre-input {
      font-size: .82rem;
      padding: .35rem .55rem;
      border: 1px solid rgba(34,33,33,.2);
      border-radius: .375rem;
      width: 100%;
      box-sizing: border-box;
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
            <input type="text" [(ngModel)]="form.tipo_activo" name="tipo_activo" required placeholder="Ej: Maquinaria, Vehículo" />
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
                @for (doc of docsExistentes; track doc.nombre) {
                  <div class="doc-item">
                    <span class="doc-nombre" [title]="doc.nombre_display">{{ doc.nombre_display }}</span>
                    <div class="doc-acciones">
                      <button type="button" class="btn-ghost btn-sm" (click)="onDescargarDoc(doc.nombre, doc.nombre_display)">↓</button>
                      <button type="button" class="btn-danger btn-sm" (click)="onEliminarDoc(doc.nombre)">✕</button>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <p class="doc-empty">Sin documentos adjuntos.</p>
            }
          }

          <!-- Upload -->
          <div class="doc-upload">
            @if (fileInputVisible()) {
              <input type="file" class="doc-file-input" (change)="onFileSelected($event)" />
            }
            <input type="text" class="doc-nombre-input"
              [(ngModel)]="nombreInput" name="doc_nombre"
              placeholder="Nombre del documento (opcional)" />
            @if (!editingId) {
              <button type="button" class="btn-ghost btn-sm"
                (click)="agregarPendiente()" [disabled]="!fileSelected">
                + Agregar a la lista
              </button>
            } @else {
              <button type="button" class="btn-primary btn-sm"
                (click)="subirExistente()" [disabled]="!fileSelected">
                Adjuntar
              </button>
            }
          </div>
        </div>

      </div>

      <!-- Footer -->
      <div class="form-footer">
        <button type="button" class="btn-ghost" (click)="cancelar.emit()">Cancelar</button>
        <button type="submit" class="btn-primary"
          [disabled]="!form.nombre || !form.tipo_activo || (!centroFijo && !form.centro_costo_id)">
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
  @Output() docDescargado   = new EventEmitter<{ nombre: string; nombreDisplay?: string }>();

  empresaId = signal('');
  form: CreateActivoDto = { nombre: '', tipo_activo: '', centro_costo_id: '', descripcion: '' };

  fileSelected: File | null = null;
  nombreInput = '';
  fileInputVisible = signal(true);

  private _centros = signal<CentroCosto[]>([]);

  centrosFiltrados = computed(() => {
    if (!this.empresaId()) return [];
    return this._centros().filter(c => asId(c.cliente_id) === this.empresaId());
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['centros']) {
      this._centros.set(this.centros);
    }
    if (changes['initial']) {
      if (this.initial) {
        this.form = {
          nombre:          this.initial.nombre,
          tipo_activo:     this.initial.tipo_activo,
          centro_costo_id: this.initial.centro_costo_id,
          descripcion:     this.initial.descripcion ?? '',
        };
        const centro = this.centros.find(c => asId(c._id) === asId(this.initial!.centro_costo_id));
        this.empresaId.set(centro ? asId(centro.cliente_id) : '');
      } else {
        this.form = {
          nombre:          '',
          tipo_activo:     '',
          centro_costo_id: this.centroFijo?._id ?? '',
          descripcion:     '',
        };
        this.empresaId.set('');
      }
      if (this.centroFijo) {
        this.form.centro_costo_id = this.centroFijo._id;
      }
    }
  }

  onEmpresaChange(empresaId: string): void {
    this.empresaId.set(empresaId);
    this.form.centro_costo_id = '';
  }

  onFileSelected(ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0] ?? null;
    this.fileSelected = file;
    if (file && !this.nombreInput) {
      this.nombreInput = file.name.replace(/\.[^/.]+$/, '');
    }
  }

  agregarPendiente(): void {
    if (!this.fileSelected) return;
    this.docAgregado.emit({
      file: this.fileSelected,
      nombre: this.nombreInput || this.fileSelected.name,
    });
    this.fileSelected = null;
    this.nombreInput = '';
    this.fileInputVisible.set(false);
    setTimeout(() => this.fileInputVisible.set(true), 0);
  }

  subirExistente(): void {
    if (!this.fileSelected) return;
    this.docSubido.emit({
      file: this.fileSelected,
      nombre: this.nombreInput || this.fileSelected.name,
    });
    this.fileSelected = null;
    this.nombreInput = '';
    this.fileInputVisible.set(false);
    setTimeout(() => this.fileInputVisible.set(true), 0);
  }

  onQuitarDoc(index: number): void    { this.docQuitado.emit(index); }
  onEliminarDoc(nombre: string): void { this.docEliminado.emit(nombre); }
  onDescargarDoc(nombre: string, nombreDisplay: string): void {
    this.docDescargado.emit({ nombre, nombreDisplay });
  }

  enviar(): void {
    if (!this.form.nombre || !this.form.tipo_activo || !this.form.centro_costo_id) return;
    const dto: CreateActivoDto = {
      nombre:          this.form.nombre.trim(),
      tipo_activo:     this.form.tipo_activo.trim(),
      centro_costo_id: this.form.centro_costo_id,
    };
    if (this.form.descripcion?.trim()) dto.descripcion = this.form.descripcion.trim();
    this.submitted.emit(dto);
  }
}
