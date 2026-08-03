import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Activo, ActividadHistorialItem, DocActivo, DocActividad, TipoActivo, TipoActividad } from '../../../../shared/models/activo.model';
import { ActivoIconoComponent } from '../activo-icono/activo-icono.component';

export interface DescargarActivoDocEvt  { docId: string; nombreDisplay?: string; }
export interface DescargarActividadDocEvt {
  actividadId: string;
  centroId: string;     // siempre el centro del ACTIVO, no el de la actividad
  docId: string;
  nombreDisplay?: string;
}

@Component({
  selector: 'app-activo-revisar-modal',
  standalone: true,
  imports: [DatePipe, ActivoIconoComponent],
  template: `
    <div class="modal-header">
      <div class="modal-title-group">
        @if (tipoActivo) {
          <app-activo-icono [icono]="tipoActivo.icono" [color]="tipoActivo.color" [size]="20"></app-activo-icono>
        }
        <div>
          <h3>{{ activo?.nombre }}</h3>
          @if (tipoActivo) {
            <span class="tipo-badge" [style.color]="tipoActivo.color">{{ tipoActivo.nombre }}</span>
          }
        </div>
      </div>
      <div class="modal-header-actions">
        <button type="button" class="folder-btn" [class.folder-btn--active]="mostrarDocsActivo()"
          (click)="mostrarDocsActivo.set(!mostrarDocsActivo())"
          title="Documentos del activo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>
          </svg>
          <span class="folder-count">{{ documentosActivo.length }}</span>
        </button>
        <button class="modal-close" (click)="cerrar.emit()">&#x2715;</button>
      </div>
    </div>

    <!-- Documentos del activo -->
    @if (mostrarDocsActivo()) {
      <div class="seccion">
        <p class="sec-label">Documentos del activo</p>
        @if (!documentosActivo.length) {
          <p class="empty-text">Este activo no tiene documentos adjuntos.</p>
        } @else {
          <div class="docs-list">
            @for (doc of documentosActivo; track doc._id) {
              <div class="doc-row">
                <svg class="doc-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
                  <path d="M14 2v6h6"/>
                </svg>
                <div class="doc-info">
                  <span class="doc-nombre">{{ doc.nombre_display || doc.nombre }}</span>
                  <span class="doc-meta">{{ doc.tipo_contenido === 'link' ? 'Link externo' : formatBytes(doc.tamano_bytes) }}</span>
                </div>
                @if (doc.tipo_contenido === 'link') {
                  <button class="btn-ghost btn-sm doc-accion-btn" (click)="abrirDoc(doc.link_url)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <path d="M15 3h6v6"/><path d="M10 14 21 3"/>
                    </svg>
                    Ir a link
                  </button>
                } @else {
                  <button class="btn-ghost btn-sm doc-accion-btn"
                    (click)="descargarActivoDoc.emit({ docId: doc._id, nombreDisplay: doc.nombre_display })">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Descargar
                  </button>
                }
              </div>
            }
          </div>
        }
      </div>
    }

    <!-- Descripción -->
    @if (activo?.descripcion) {
      <div class="seccion">
        <p class="sec-label">Descripción</p>
        <p class="descripcion-texto">{{ activo!.descripcion }}</p>
      </div>
    }

    <!-- Historial de actividades -->
    <div class="seccion">
      <p class="sec-label">Historial de actividades</p>
      @if (loadingHistorial) {
        <p class="empty-text">Cargando historial...</p>
      } @else if (!historial.length) {
        <p class="empty-text">Este activo no ha participado en ninguna actividad.</p>
      } @else {
        <div class="historial-list">
          @for (item of historial; track item._id) {
            <div class="hist-card" role="button" tabindex="0"
              (click)="abrirActividad(item)" (keyup.enter)="abrirActividad(item)">
              <div class="hist-card-header">
                <span class="hist-fecha">{{ item.fecha | date:'dd/MM/yyyy' }}</span>
                <div class="hist-nombre-wrap">
                  <span class="hist-nombre">{{ item.nombre }}</span>
                  @if (item.descripcion) {
                    <span class="hist-desc">{{ item.descripcion }}</span>
                  }
                </div>
                <span class="hist-tipo"
                  [style.color]="tipoActividadColor(item)"
                  [style.background]="tipoActividadColor(item) + '18'">
                  {{ tipoActividadNombre(item) }}
                </span>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- Detalle de actividad -->
    @if (actividadSeleccionada(); as act) {
      <div class="detalle-backdrop" (click)="cerrarActividad()">
        <div class="detalle-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title-group">
              <div>
                <h3>{{ act.nombre }}</h3>
                <span class="tipo-badge" [style.color]="tipoActividadColor(act)">{{ tipoActividadNombre(act) }}</span>
              </div>
            </div>
            <div class="modal-header-actions">
              <button type="button" class="folder-btn" [class.folder-btn--active]="mostrarDocsActividad()"
                (click)="mostrarDocsActividad.set(!mostrarDocsActividad())"
                title="Documentos de la actividad">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>
                </svg>
                <span class="folder-count">{{ documentosActividad.length }}</span>
              </button>
              <button class="modal-close" (click)="cerrarActividad()">&#x2715;</button>
            </div>
          </div>

          <div class="seccion">
            <p class="sec-label">Fecha</p>
            <p class="descripcion-texto">{{ act.fecha | date:'dd/MM/yyyy' }}</p>
          </div>

          @if (act.descripcion) {
            <div class="seccion">
              <p class="sec-label">Descripción</p>
              <p class="descripcion-texto">{{ act.descripcion }}</p>
            </div>
          }

          @if (mostrarDocsActividad()) {
            <div class="seccion">
              <p class="sec-label">Documentos de la actividad</p>
              @if (loadingDocumentosActividad) {
                <p class="empty-text">Cargando documentos...</p>
              } @else if (!documentosActividad.length) {
                <p class="empty-text">Esta actividad no tiene documentos adjuntos.</p>
              } @else {
                <div class="docs-list">
                  @for (doc of documentosActividad; track doc._id) {
                    <div class="doc-row">
                      <svg class="doc-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
                        <path d="M14 2v6h6"/>
                      </svg>
                      <div class="doc-info">
                        <span class="doc-nombre">{{ doc.nombre_display || doc.nombre }}</span>
                        <span class="doc-meta">{{ doc.tipo_contenido === 'link' ? 'Link externo' : formatBytes(doc.tamano_bytes) }}</span>
                      </div>
                      @if (doc.tipo_contenido === 'link') {
                        <button class="btn-ghost btn-sm doc-accion-btn" (click)="abrirDoc(doc.link_url)">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <path d="M15 3h6v6"/><path d="M10 14 21 3"/>
                          </svg>
                          Ir a link
                        </button>
                      } @else {
                        <button class="btn-ghost btn-sm doc-accion-btn"
                          (click)="descargarActividadDoc.emit({ actividadId: act._id, centroId: activo!.centro_costo_id, docId: doc._id, nombreDisplay: doc.nombre_display })">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                          Descargar
                        </button>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .modal-header {
      display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.25rem;
    }
    .modal-title-group { display: flex; align-items: flex-start; gap: .6rem; }
    .modal-title-group h3 { margin: 0; font-size: 1.1rem; font-weight: 700; color: #1f2937; }
    .tipo-badge { font-size: .75rem; font-weight: 600; }
    .modal-header-actions { display: flex; align-items: center; gap: .5rem; flex-shrink: 0; }
    .modal-close {
      background: none; border: none; font-size: 1.4rem; line-height: 1;
      cursor: pointer; color: #6b7280; padding: 0 .25rem; flex-shrink: 0;
    }
    .modal-close:hover { color: #1f2937; }

    .folder-btn {
      display: flex; align-items: center; gap: .3rem; flex-shrink: 0;
      background: #f3f4f6; border: none; border-radius: 8px; cursor: pointer;
      color: #6b7280; padding: .4rem .6rem; transition: background .12s, color .12s;
    }
    .folder-btn:hover { background: #e5e7eb; color: #374151; }
    .folder-btn--active { background: #dbeafe; color: #0095d6; }
    .folder-count { font-size: .75rem; font-weight: 700; }

    .seccion { margin-bottom: 1.5rem; }
    .sec-label {
      font-size: .78rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: .04em; color: #6b7280; margin: 0 0 .6rem;
    }
    .descripcion-texto {
      font-size: .875rem; color: #374151; margin: 0;
      background: #f9fafb; border-radius: 8px; padding: .6rem .8rem;
    }
    .empty-text { font-size: .85rem; color: #9ca3af; margin: 0; }

    .docs-list {
      display: flex; flex-direction: column; gap: 0;
      border: 1px solid rgba(34,33,33,.08); border-radius: 10px; overflow: hidden;
    }
    .doc-row {
      display: flex; align-items: center; gap: .6rem;
      padding: .55rem .8rem; border-bottom: 1px solid rgba(34,33,33,.06);
      background: #fff; transition: background .12s;
    }
    .doc-row:last-child { border-bottom: none; }
    .doc-row:hover { background: #f9fafb; }
    .doc-icon { width: 18px; height: 18px; flex-shrink: 0; color: #6b7280; }
    .doc-info { flex: 1; min-width: 0; }
    .doc-nombre {
      display: block; font-size: .85rem; font-weight: 600; color: #1f2937;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .doc-meta { font-size: .75rem; color: #9ca3af; }
    .doc-accion-btn { display: inline-flex; align-items: center; gap: .35rem; flex-shrink: 0; }

    .historial-list { display: flex; flex-direction: column; gap: .5rem; }
    .hist-card {
      border: 1px solid rgba(34,33,33,.08); border-radius: 10px; overflow: hidden;
      cursor: pointer; transition: box-shadow .12s, border-color .12s;
    }
    .hist-card:hover { border-color: #0095d6; box-shadow: 0 2px 8px rgba(0,149,214,.1); }
    .hist-card-header {
      display: grid; grid-template-columns: 100px 1fr 190px;
      gap: .5rem; align-items: center; padding: .6rem .8rem;
      background: #fff; transition: background .1s;
    }
    .hist-card-header:hover { background: #f9fafb; }
    .hist-fecha { font-size: .82rem; color: #6b7280; }
    .hist-nombre-wrap { min-width: 0; }
    .hist-nombre {
      display: block; font-size: .875rem; font-weight: 600; color: #1f2937;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .hist-desc {
      display: block; font-size: .75rem; color: #9ca3af;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .hist-tipo {
      display: inline-block; font-size: .75rem; font-weight: 600;
      padding: .2rem .6rem; border-radius: 999px; white-space: nowrap;
      justify-self: end;
    }

    .detalle-backdrop {
      position: fixed; inset: 0; background: rgba(15,23,42,.5);
      display: flex; align-items: center; justify-content: center;
      z-index: 300; padding: 1rem;
    }
    .detalle-modal {
      background: #fff; border-radius: 16px; box-shadow: 0 20px 60px rgba(15,23,42,.25);
      width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; padding: 1.5rem;
    }
  `],
})
export class ActivoRevisarModalComponent {
  @Input() activo: Activo | null = null;
  @Input() historial: ActividadHistorialItem[] = [];
  @Input() loadingHistorial = false;
  @Input() documentosActivo: DocActivo[] = [];
  @Input() documentosActividad: DocActividad[] = [];
  @Input() loadingDocumentosActividad = false;

  @Output() cerrar             = new EventEmitter<void>();
  @Output() descargarActivoDoc = new EventEmitter<DescargarActivoDocEvt>();
  @Output() descargarActividadDoc = new EventEmitter<DescargarActividadDocEvt>();
  @Output() actividadAbierta   = new EventEmitter<ActividadHistorialItem>();

  // Abierta por defecto: este modal siempre muestra el historial de
  // actividades del activo, así que sus documentos deben verse de entrada.
  protected mostrarDocsActivo     = signal(true);
  protected mostrarDocsActividad  = signal(false);
  protected actividadSeleccionada = signal<ActividadHistorialItem | null>(null);

  get tipoActivo(): TipoActivo | null {
    if (!this.activo) return null;
    if (typeof this.activo.tipo_activo_id === 'object') return this.activo.tipo_activo_id as TipoActivo;
    return null;
  }

  protected abrirActividad(item: ActividadHistorialItem): void {
    this.mostrarDocsActividad.set(true);
    this.actividadSeleccionada.set(item);
    this.actividadAbierta.emit(item);
  }

  protected cerrarActividad(): void {
    this.actividadSeleccionada.set(null);
    this.mostrarDocsActividad.set(false);
  }

  protected tipoActividadNombre(item: ActividadHistorialItem): string {
    if (typeof item.tipo_id === 'object') return (item.tipo_id as TipoActividad).nombre;
    return '';
  }

  protected tipoActividadColor(item: ActividadHistorialItem): string {
    if (typeof item.tipo_id === 'object') return (item.tipo_id as TipoActividad).color ?? '#6b7280';
    return '#6b7280';
  }

  protected formatBytes(bytes?: number): string {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected abrirDoc(url?: string): void {
    if (url) window.open(url, '_blank');
  }
}
