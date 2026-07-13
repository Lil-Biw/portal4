import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

/**
 * Panel "subir documento" reutilizado en documentos (admin/consumidor), actividades,
 * activos y adjuntar-solicitud. Componente dumb: toda la validación de negocio
 * (tamaño máximo, categorías, llamada al servicio) la resuelve el padre.
 */
@Component({
  selector: 'app-upload-document-form',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    .udf-card {
      border: 1.5px dashed #bfdbfe;
      border-radius: 10px;
      padding: 1.25rem;
      background: #f0f9ff;
    }
    .udf-aviso {
      display: flex;
      align-items: flex-start;
      gap: .6rem;
      padding: .75rem 1rem;
      margin-bottom: 1rem;
      background: #fef9c3;
      border: 1px solid #fde68a;
      border-radius: 8px;
    }
    .udf-aviso p { margin: 0; font-size: .8rem; color: #92400e; line-height: 1.4; }
    .udf-tabs { display: flex; gap: .4rem; margin-bottom: 1rem; }
    .udf-tab {
      flex: 1;
      padding: .5rem;
      border-radius: 7px;
      font-size: .82rem;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid #d1d5db;
      background: #fff;
      color: #374151;
    }
    .udf-tab--active { background: #0095d6; color: #fff; border-color: #0095d6; }
    .udf-descripcion { margin: 0 0 .5rem; font-size: .78rem; color: #6b7280; }
    .udf-dropzone {
      position: relative;
      border: 1.5px dashed #93c5fd;
      border-radius: 8px;
      background: #fff;
      padding: 2rem 1rem;
      text-align: center;
      cursor: pointer;
      transition: border-color .15s, background-color .15s;
    }
    .udf-dropzone--error { border-color: #f87171; background: #fef2f2; }
    .udf-dropzone-icon { margin: 0 auto .75rem; display: block; }
    .udf-dropzone-text { margin: 0 0 .25rem; font-size: .9rem; color: #374151; }
    .udf-dropzone-link { color: #0095d6; font-weight: 600; cursor: pointer; text-decoration: underline; }
    .udf-filename { margin: .35rem 0 0; font-size: .8rem; color: #6b7280; font-style: italic; }
    .udf-quitar { color: #0095d6; font-weight: 600; cursor: pointer; text-decoration: underline; font-style: normal; }
    .udf-error { margin: .5rem 0 0; font-size: .8rem; color: #dc2626; font-weight: 600; }
    .udf-fields { display: grid; grid-template-columns: 1fr auto; gap: .75rem; margin-top: 1rem; align-items: end; }
    .udf-field { display: flex; flex-direction: column; gap: .3rem; }
    .udf-field--full { margin-top: 1rem; }
    .udf-label { font-size: .7rem; font-weight: 700; color: #6b7280; letter-spacing: .06em; text-transform: uppercase; }
    .udf-input, .udf-select {
      padding: .55rem .75rem;
      border: 1px solid #d1d5db;
      border-radius: 7px;
      font-size: .875rem;
      font-family: inherit;
      outline: none;
      background: #fff;
    }
    .udf-input--error { border-color: #f87171; }
    .udf-select { min-width: 200px; }
    .udf-link-block { display: flex; flex-direction: column; gap: .3rem; }
    .udf-buttons { display: flex; gap: .5rem; margin-top: 1rem; }
    .udf-confirm { display: flex; align-items: center; gap: .4rem; font-size: .85rem; padding: .5rem 1.1rem; }
    .udf-cancel { font-size: .85rem; padding: .5rem 1rem; }
    .udf-spinner {
      width: 12px; height: 12px; flex-shrink: 0;
      border: 2px solid rgba(255,255,255,.35); border-top-color: #fff;
      border-radius: 50%; animation: udf-spin .65s linear infinite; display: inline-block;
    }
    @keyframes udf-spin { to { transform: rotate(360deg); } }
  `],
  template: `
    <div class="udf-card">
      @if (mostrarAviso) {
        <div class="udf-aviso">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <p><strong>Aviso:</strong> {{ avisoTexto }}</p>
        </div>
      }

      <div class="udf-tabs">
        <button type="button" class="udf-tab" [class.udf-tab--active]="modo === 'archivo'"
                (click)="cambiarModo('archivo')">Subir archivo</button>
        <button type="button" class="udf-tab" [class.udf-tab--active]="modo === 'link'"
                (click)="cambiarModo('link')">Adjuntar link</button>
      </div>

      @if (modo === 'archivo') {
        @if (descripcion) { <p class="udf-descripcion">{{ descripcion }}</p> }

        <div class="udf-dropzone" [class.udf-dropzone--error]="archivoInvalido"
             (dragover)="$event.preventDefault()" (drop)="onDrop($event)" (click)="fileInput.click()">
          <input #fileInput type="file" style="display:none" [attr.accept]="accept || null" (change)="onFileSelected($event)" />
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" [attr.stroke]="archivoInvalido ? '#dc2626' : '#0095d6'" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="udf-dropzone-icon">
            <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
          </svg>
          <p class="udf-dropzone-text">
            Arrastra tu archivo aquí o <span class="udf-dropzone-link">selecciona uno</span>
          </p>
          @if (archivo) {
            <p class="udf-filename">
              {{ archivo.name }} ·
              <span class="udf-quitar" (click)="quitarArchivo($event)">Quitar</span>
            </p>
          }
          @if (archivoInvalido) {
            <p class="udf-error">⚠ {{ mensajeArchivoInvalido }}</p>
          }
        </div>

        @if (mostrarTipoDocumento) {
          <div class="udf-fields">
            <label class="udf-field">
              <span class="udf-label">Nombre del archivo</span>
              <input type="text" class="udf-input" [(ngModel)]="nombre" (ngModelChange)="nombreChange.emit($event)" placeholder="Nombre del documento" />
            </label>
            <label class="udf-field">
              <span class="udf-label">Tipo de documento</span>
              <select class="udf-select" [(ngModel)]="categoria" (ngModelChange)="categoriaChange.emit($event)">
                @for (cat of categorias; track cat) { <option [value]="cat">{{ cat }}</option> }
              </select>
            </label>
          </div>
        } @else if (mostrarNombre) {
          <label class="udf-field udf-field--full">
            <span class="udf-label">Nombre del documento (opcional)</span>
            <input type="text" class="udf-input" [(ngModel)]="nombre" (ngModelChange)="nombreChange.emit($event)" placeholder="Nombre del documento" />
          </label>
        }
      } @else {
        <label class="udf-field udf-link-block">
          <span class="udf-label">Link (Google Drive u otro)</span>
          <input type="url" class="udf-input" [class.udf-input--error]="linkInvalido"
                 [(ngModel)]="link" (ngModelChange)="linkChange.emit($event)" placeholder="https://drive.google.com/…" />
          @if (linkInvalido) {
            <span class="udf-error" style="margin-top:0">⚠ {{ mensajeLinkInvalido }}</span>
          }
        </label>

        @if (mostrarTipoDocumento) {
          <div class="udf-fields" style="grid-template-columns:1fr 1fr">
            <label class="udf-field">
              <span class="udf-label">Nombre para mostrar</span>
              <input type="text" class="udf-input" [(ngModel)]="nombre" (ngModelChange)="nombreChange.emit($event)" placeholder="Nombre del documento" />
            </label>
            <label class="udf-field">
              <span class="udf-label">Tipo de documento</span>
              <select class="udf-select" style="width:100%" [(ngModel)]="categoria" (ngModelChange)="categoriaChange.emit($event)">
                @for (cat of categorias; track cat) { <option [value]="cat">{{ cat }}</option> }
              </select>
            </label>
          </div>
        } @else if (mostrarNombre) {
          <label class="udf-field udf-field--full">
            <span class="udf-label">Nombre del documento (opcional)</span>
            <input type="text" class="udf-input" [(ngModel)]="nombre" (ngModelChange)="nombreChange.emit($event)" placeholder="Nombre del documento" />
          </label>
        }
      }

      <div class="udf-buttons">
        <button type="button" class="btn-primary udf-confirm" (click)="confirmar.emit()"
                [disabled]="confirmDisabled || confirmLoading">
          @if (confirmLoading) {
            <span class="udf-spinner"></span> Subiendo...
          } @else {
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            {{ confirmLabel }}
          }
        </button>
        @if (showCancel) {
          <button type="button" class="btn-ghost udf-cancel" [disabled]="confirmLoading" (click)="cancelar.emit()">{{ cancelLabel }}</button>
        }
      </div>
    </div>
  `,
})
export class UploadDocumentFormComponent {
  @Input() modo: 'archivo' | 'link' = 'archivo';
  @Output() modoChange = new EventEmitter<'archivo' | 'link'>();

  @Input() archivo: File | null = null;
  @Output() archivoChange = new EventEmitter<File | null>();

  @Input() link = '';
  @Output() linkChange = new EventEmitter<string>();

  @Input() nombre = '';
  @Output() nombreChange = new EventEmitter<string>();

  @Input() categoria = '';
  @Output() categoriaChange = new EventEmitter<string>();

  @Input() categorias: readonly string[] = [];
  @Input() mostrarTipoDocumento = true;
  @Input() mostrarNombre = true;

  @Input() mostrarAviso = false;
  @Input() avisoTexto = 'Al confirmar la subida, los administradores del portal serán notificados por correo electrónico.';

  @Input() descripcion = '';
  @Input() accept = '';

  @Input() archivoInvalido = false;
  @Input() mensajeArchivoInvalido = '';

  @Input() linkInvalido = false;
  @Input() mensajeLinkInvalido = 'Ingresa una URL válida (debe empezar con http:// o https://)';

  @Input() confirmLabel = 'Confirmar subida';
  @Input() cancelLabel = 'Cancelar';
  @Input() showCancel = true;
  @Input() confirmDisabled = false;
  @Input() confirmLoading = false;

  @Output() confirmar = new EventEmitter<void>();
  @Output() cancelar = new EventEmitter<void>();

  cambiarModo(m: 'archivo' | 'link'): void {
    if (this.modo === m) return;
    this.modo = m;
    this.modoChange.emit(m);
  }

  onFileSelected(ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0] ?? null;
    (ev.target as HTMLInputElement).value = '';
    if (file) this.archivoChange.emit(file);
  }

  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    const file = ev.dataTransfer?.files?.[0] ?? null;
    if (file) this.archivoChange.emit(file);
  }

  quitarArchivo(ev: Event): void {
    ev.stopPropagation();
    this.archivoChange.emit(null);
  }
}
