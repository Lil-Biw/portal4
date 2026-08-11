import {
  AfterViewChecked, Component, ElementRef, EventEmitter,
  Input, Output, ViewChild, signal,
} from '@angular/core';
import { DocumentoTarjeta } from '../../models/documento-tarjeta.model';

function extensionDe(nombre: string): string {
  const idx = nombre.lastIndexOf('.');
  return idx > 0 ? nombre.slice(idx) : '';
}

function sinExtension(nombre: string): string {
  const idx = nombre.lastIndexOf('.');
  return idx > 0 ? nombre.slice(0, idx) : nombre;
}

@Component({
  selector: 'app-document-card-list',
  standalone: true,
  styles: [`
    .dcl-grid { display: flex; flex-wrap: wrap; gap: .7rem; }
    .dcl-card {
      position: relative; width: 150px; background: #fff; border: 1px solid #d7e6ee;
      border-radius: 10px; padding: 1.5rem .55rem .55rem; box-shadow: 0 1px 3px rgba(0,0,0,.05);
      display: flex; flex-direction: column; align-items: center; text-align: center;
    }
    .dcl-card--dim { opacity: .55; }
    .dcl-card--error { border-color: #f1c3bb; background: #fef8f7; }
    .dcl-nombre {
      margin: 0; font-size: .74rem; color: #1a2733; line-height: 1.3;
      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
      overflow: hidden; min-height: 2.9em; word-break: break-word;
    }
    .dcl-card--error .dcl-nombre { color: #c0392b; }
    .dcl-tag {
      display: block; margin-top: .2rem; font-size: .6rem; text-transform: uppercase;
      letter-spacing: .04em; color: #0075a8;
    }
    .dcl-categoria-select {
      margin-top: .3rem; width: 96%; font-size: .68rem; border: 1px solid #d7e6ee;
      border-radius: 5px; padding: .2rem .3rem; outline: none; box-sizing: border-box;
      background: #fff; color: #1a2733; font-family: inherit;
    }
    .dcl-retry {
      margin-top: .3rem; width: 96%; font-size: .68rem; border: 1px solid #f1c3bb;
      border-radius: 5px; padding: .25rem .3rem; background: #fef8f7; color: #c0392b;
      cursor: pointer; font-family: inherit;
    }
    .dcl-acciones {
      display: flex; gap: .4rem; margin-top: .5rem; padding-top: .45rem;
      border-top: 1px solid #eef2f5; width: 100%; justify-content: center;
    }
    .dcl-icon-btn {
      width: 24px; height: 24px; border-radius: 5px; border: 1px solid #e2e8f0;
      background: #fbfcfd; display: flex; align-items: center; justify-content: center;
      font-size: .72rem; color: #5b7484; cursor: pointer; padding: 0;
    }
    .dcl-icon-btn--warn { color: #0075a8; }
    .dcl-x {
      position: absolute; top: .4rem; right: .4rem; width: 18px; height: 18px;
      border-radius: 50%; border: none; background: transparent; cursor: pointer; padding: 0;
    }
    .dcl-x::before, .dcl-x::after {
      content: ''; position: absolute; top: 50%; left: 50%; width: 9px; height: 1.6px;
      background: #a94442; border-radius: 1px;
    }
    .dcl-x::before { transform: translate(-50%, -50%) rotate(45deg); }
    .dcl-x::after  { transform: translate(-50%, -50%) rotate(-45deg); }
    .dcl-x:hover { background: #fdecea; }
    .dcl-rename-input {
      margin-top: .2rem; width: 96%; font-size: .72rem; border: 1px solid #0095d6;
      border-radius: 5px; padding: .2rem .3rem; outline: none; box-sizing: border-box; text-align: center;
    }
    .dcl-rename-hint { margin: .15rem 0 0; font-size: .6rem; color: #8697a3; }
    .dcl-spinner {
      display: inline-block; width: 11px; height: 11px; border: 2px solid #eadde0;
      border-top-color: #0095d6; border-radius: 50%; margin-right: .3rem; vertical-align: -1.5px;
      animation: dcl-spin .65s linear infinite;
    }
    @keyframes dcl-spin { to { transform: rotate(360deg); } }
    .dcl-empty { font-size: .8rem; color: #9ca3af; padding: .3rem 0; }
  `],
  template: `
    <div class="dcl-grid">
      @for (doc of documentos; track doc.id) {
        <div class="dcl-card" [class.dcl-card--dim]="doc.estado === 'eliminando'" [class.dcl-card--error]="doc.estado === 'error'">
          @if (doc.estado === 'listo' || doc.estado === 'pendiente' || doc.estado === 'error') {
            <button type="button" class="dcl-x" (click)="eliminar.emit(doc.id)" [attr.aria-label]="'Eliminar ' + doc.nombre"></button>
          }
          @if (renombrandoId() === doc.id) {
            <input #renameInput class="dcl-rename-input" [value]="nombreEditado()" (input)="onRenameInput($event)"
                   (keydown.enter)="confirmarRenombre(doc)" (keydown.escape)="cancelarRenombre()" />
            <p class="dcl-rename-hint">Enter guarda · Esc cancela</p>
          } @else if (doc.estado === 'subiendo') {
            <p class="dcl-nombre"><span class="dcl-spinner"></span>Subiendo...</p>
          } @else if (doc.estado === 'eliminando') {
            <p class="dcl-nombre"><span class="dcl-spinner"></span>Eliminando...</p>
          } @else if (doc.estado === 'error') {
            <p class="dcl-nombre">Error al subir</p>
          } @else {
            <p class="dcl-nombre" [title]="doc.nombre">
              {{ doc.nombre }}
              @if (doc.estado === 'pendiente') { <span class="dcl-tag">pendiente</span> }
            </p>
          }
          @if (mostrarCategoria && (doc.estado === 'subiendo' || doc.estado === 'listo')) {
            <select class="dcl-categoria-select" [value]="doc.categoria"
                    (change)="onCategoriaChange(doc, $event)">
              @for (cat of categorias; track cat) { <option [value]="cat">{{ cat }}</option> }
            </select>
          }
          @if (doc.estado === 'error') {
            <button type="button" class="dcl-retry" (click)="reintentar.emit(doc.id)">↻ Reintentar</button>
          }
          @if (doc.estado === 'listo') {
            <div class="dcl-acciones">
              @if (doc.tipoContenido === 'link') {
                <button type="button" class="dcl-icon-btn" (click)="abrirLink.emit(doc.linkUrl!)" aria-label="Ir al link">↗</button>
              } @else {
                <button type="button" class="dcl-icon-btn" (click)="descargar.emit(doc.id)" aria-label="Descargar">⬇</button>
              }
              <button type="button" class="dcl-icon-btn dcl-icon-btn--warn" (click)="iniciarRenombre(doc)" aria-label="Renombrar">✎</button>
            </div>
          }
        </div>
      } @empty {
        <p class="dcl-empty">Sin documentos.</p>
      }
    </div>
  `,
})
export class DocumentCardListComponent implements AfterViewChecked {
  @Input() documentos: DocumentoTarjeta[] = [];

  @Output() descargar = new EventEmitter<string>();
  @Output() abrirLink = new EventEmitter<string>();
  @Output() eliminar  = new EventEmitter<string>();
  @Output() renombrar = new EventEmitter<{ id: string; nuevoNombre: string }>();

  @Input() mostrarCategoria = false;
  @Input() categorias: readonly string[] = [];
  @Output() categoriaChange = new EventEmitter<{ id: string; categoria: string }>();
  @Output() reintentar = new EventEmitter<string>();

  @ViewChild('renameInput') private renameInputRef?: ElementRef<HTMLInputElement>;
  private renameInputFocused = false;

  protected renombrandoId = signal<string | null>(null);
  protected nombreEditado = signal('');

  ngAfterViewChecked(): void {
    if (this.renombrandoId() && this.renameInputRef && !this.renameInputFocused) {
      const el = this.renameInputRef.nativeElement;
      el.focus();
      el.select();
      this.renameInputFocused = true;
    }
    if (!this.renombrandoId()) this.renameInputFocused = false;
  }

  onRenameInput(event: Event): void {
    this.nombreEditado.set((event.target as HTMLInputElement).value);
  }

  iniciarRenombre(doc: DocumentoTarjeta): void {
    this.renombrandoId.set(doc.id);
    this.nombreEditado.set(sinExtension(doc.nombre));
  }

  confirmarRenombre(doc: DocumentoTarjeta): void {
    const nuevo = this.nombreEditado().trim();
    this.renombrandoId.set(null);
    if (!nuevo) return;
    const nuevoNombre = nuevo + extensionDe(doc.nombre);
    if (nuevoNombre === doc.nombre) return;
    this.renombrar.emit({ id: doc.id, nuevoNombre });
  }

  cancelarRenombre(): void {
    this.renombrandoId.set(null);
  }

  onCategoriaChange(doc: DocumentoTarjeta, event: Event): void {
    const categoria = (event.target as HTMLSelectElement).value;
    this.categoriaChange.emit({ id: doc.id, categoria });
  }
}
