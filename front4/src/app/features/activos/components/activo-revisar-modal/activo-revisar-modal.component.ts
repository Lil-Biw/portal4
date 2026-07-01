import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Activo, ActividadHistorialItem, TipoActivo, TipoActividad } from '../../../../shared/models/activo.model';
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
          <app-activo-icono [color]="tipoActivo.color" [size]="20"></app-activo-icono>
        }
        <div>
          <h3>{{ activo?.nombre }}</h3>
          @if (tipoActivo) {
            <span class="tipo-badge" [style.color]="tipoActivo.color">{{ tipoActivo.nombre }}</span>
          }
        </div>
      </div>
      <button class="modal-close" (click)="cerrar.emit()">&#x2715;</button>
    </div>

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
            <div class="hist-card">

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
  `,
  styles: [`
    .modal-header {
      display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.25rem;
    }
    .modal-title-group { display: flex; align-items: flex-start; gap: .6rem; }
    .modal-title-group h3 { margin: 0; font-size: 1.1rem; font-weight: 700; color: #1f2937; }
    .tipo-badge { font-size: .75rem; font-weight: 600; }
    .modal-close {
      background: none; border: none; font-size: 1.4rem; line-height: 1;
      cursor: pointer; color: #6b7280; padding: 0 .25rem; flex-shrink: 0;
    }
    .modal-close:hover { color: #1f2937; }

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

    .historial-list { display: flex; flex-direction: column; gap: .5rem; }
    .hist-card { border: 1px solid rgba(34,33,33,.08); border-radius: 10px; overflow: hidden; }
    .hist-card-header {
      display: grid; grid-template-columns: 100px 1fr 190px auto;
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
    }
    .hist-docs-toggle {
      display: flex; align-items: center; gap: .25rem; flex-shrink: 0;
      background: #e5e7eb; border: none; border-radius: 6px; cursor: pointer;
      font-size: .73rem; font-weight: 600; color: #6b7280;
      padding: .2rem .45rem; transition: background .12s, color .12s;
    }
    .hist-docs-toggle:hover { background: #d1d5db; color: #374151; }
    .toggle-chevron { transition: transform .18s; }
    .toggle-chevron.open { transform: rotate(180deg); }
    .hist-docs {
      border-top: 1px solid rgba(34,33,33,.08);
      background: #e5e7eb; padding: .3rem .8rem;
    }
    .hist-doc-row {
      display: flex; align-items: center; gap: .45rem;
      padding: .28rem 0; border-bottom: 1px solid rgba(34,33,33,.07);
    }
    .hist-doc-row:last-child { border-bottom: none; }
    .hist-doc-nombre {
      flex: 1; min-width: 0; font-size: .8rem; font-weight: 500; color: #374151;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .hist-doc-meta { font-size: .72rem; color: #9ca3af; flex-shrink: 0; }
  `],
})
export class ActivoRevisarModalComponent {
  @Input() activo: Activo | null = null;
  @Input() historial: ActividadHistorialItem[] = [];
  @Input() loadingHistorial = false;

  @Output() cerrar             = new EventEmitter<void>();
  // TODO: re-implement after doc-list modal is redesigned for new separate-collections API
  @Output() descargarActivoDoc = new EventEmitter<DescargarActivoDocEvt>();
  // TODO: re-implement after doc-list modal is redesigned for new separate-collections API
  @Output() descargarActividadDoc = new EventEmitter<DescargarActividadDocEvt>();

  get tipoActivo(): TipoActivo | null {
    if (!this.activo) return null;
    if (typeof this.activo.tipo_activo_id === 'object') return this.activo.tipo_activo_id as TipoActivo;
    return null;
  }

  protected tipoActividadNombre(item: ActividadHistorialItem): string {
    if (typeof item.tipo_id === 'object') return (item.tipo_id as TipoActividad).nombre;
    return '';
  }

  protected tipoActividadColor(item: ActividadHistorialItem): string {
    if (typeof item.tipo_id === 'object') return (item.tipo_id as TipoActividad).color ?? '#6b7280';
    return '#6b7280';
  }

  protected formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
