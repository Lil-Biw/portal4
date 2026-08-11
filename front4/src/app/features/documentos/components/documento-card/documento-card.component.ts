import { Component, EventEmitter, Input, Output, signal } from '@angular/core';

@Component({
  selector: 'app-documento-card',
  standalone: true,
  styles: [`
    .dc-card {
      position: relative; width: 190px; background: #fff; border: 1px solid #e5e7eb;
      border-radius: 10px; padding: .75rem; box-shadow: 0 1px 3px rgba(0,0,0,.05);
      display: flex; flex-direction: column; gap: .5rem;
    }
    .dc-top { display: flex; align-items: flex-start; gap: .5rem; min-width: 0; }
    .dc-info { min-width: 0; overflow: hidden; flex: 1; }
    .dc-nombre {
      margin: 0; font-size: .78rem; color: #1f2937; line-height: 1.3; font-weight: 500;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      overflow: hidden; word-break: break-word;
    }
    .dc-chips { display: flex; align-items: center; gap: .3rem; flex-wrap: wrap; margin-top: .3rem; }
    .dc-categoria {
      font-size: .62rem; font-weight: 600; padding: .15rem .45rem; border-radius: 999px;
      background: #e0e7ff; color: #3730a3; white-space: nowrap;
    }
    .dc-link {
      font-size: .6rem; font-weight: 600; padding: .1rem .4rem; border-radius: 999px;
      background: #ecfdf5; color: #047857;
    }
    .dc-meta { display: flex; flex-direction: column; gap: .2rem; margin-top: .3rem; }
    .dc-badge {
      font-size: .6rem; font-weight: 600; padding: .1rem .4rem; border-radius: 999px;
      background: #f1f5f9; color: #475569; align-self: flex-start;
    }
    .dc-badge--vencido { background: #fef2f2; color: #dc2626; }
    .dc-acciones { display: flex; gap: .35rem; padding-top: .5rem; border-top: 1px solid #eef2f5; }
    .dc-btn {
      width: 26px; height: 26px; border-radius: 6px; border: none; background: #eff6ff;
      color: #0095d6; cursor: pointer; display: flex; align-items: center; justify-content: center;
    }
    .dc-btn--danger { background: #fef2f2; color: #dc2626; }
    .dc-btn--menu { background: #eef2ff; color: #4f46e5; }
    .dc-menu-wrap { position: relative; margin-left: auto; }
    .dc-menu-backdrop { position: fixed; inset: 0; z-index: 60; }
    .dc-menu {
      position: absolute; top: 32px; right: 0; background: #fff; border: 1px solid #e5e7eb;
      border-radius: 8px; box-shadow: 0 8px 24px rgba(15,23,42,.14); z-index: 61;
      min-width: 190px; max-height: 240px; overflow-y: auto; padding: .25rem;
    }
    .dc-menu-label { margin: .3rem .5rem; font-size: .68rem; font-weight: 700; color: #9ca3af; text-transform: uppercase; }
    .dc-menu-item { padding: .4rem .65rem; font-size: .8rem; border-radius: 6px; cursor: pointer; color: #374151; }
    .dc-menu-item:hover { background: #f9fafb; }
    .dc-menu-item--activo { font-weight: 700; color: #3730a3; background: #eef2ff; }
    .dc-menu-item--warn { color: #d97706; }
  `],
  template: `
    <div class="dc-card">
      <div class="dc-top">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:.1rem"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <div class="dc-info">
          <p class="dc-nombre" [title]="nombre">{{ nombre }}</p>
          <div class="dc-chips">
            @if (categoria) { <span class="dc-categoria">{{ categoria }}</span> }
            @if (tipoContenido === 'link') { <span class="dc-link">🔗 Link</span> }
          </div>
          @if (badges.length || fechaSubida || subidoPor || vencidoEn) {
            <div class="dc-meta">
              @for (b of badges; track b) { <span class="dc-badge">{{ b }}</span> }
              @if (fechaSubida) { <span class="dc-badge">Subido: {{ fechaSubida }}</span> }
              @if (subidoPor) { <span class="dc-badge">{{ subidoPor }}</span> }
              @if (vencidoEn) { <span class="dc-badge dc-badge--vencido">Vencido: {{ vencidoEn }}</span> }
            </div>
          }
        </div>
      </div>
      <div class="dc-acciones">
        <button type="button" class="dc-btn" [title]="tipoContenido === 'link' ? 'Abrir enlace' : 'Descargar'" (click)="abrir.emit()">
          @if (tipoContenido === 'link') {
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          } @else {
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          }
        </button>
        @if (mostrarEliminar) {
          <button type="button" class="dc-btn dc-btn--danger" title="Eliminar" (click)="eliminar.emit()">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        }
        @if (mostrarCambiarCategoria || mostrarMarcarVencido) {
          <div class="dc-menu-wrap">
            <button type="button" class="dc-btn dc-btn--menu" title="Más acciones" (click)="menuAbierto.set(!menuAbierto())">⋮</button>
            @if (menuAbierto()) {
              <div class="dc-menu-backdrop" (click)="menuAbierto.set(false)"></div>
              <div class="dc-menu">
                @if (mostrarCambiarCategoria) {
                  <p class="dc-menu-label">Cambiar categoría</p>
                  @for (cat of categorias; track cat) {
                    <div class="dc-menu-item" [class.dc-menu-item--activo]="cat === categoria" (click)="onCambiarCategoria(cat)">{{ cat }}</div>
                  }
                }
                @if (mostrarMarcarVencido) {
                  <div class="dc-menu-item dc-menu-item--warn" (click)="onMarcarVencido()">Marcar vencido</div>
                }
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class DocumentoCardComponent {
  @Input() nombre = '';
  @Input() categoria = '';
  @Input() tipoContenido: 'archivo' | 'link' = 'archivo';
  @Input() fechaSubida = '';
  @Input() subidoPor?: string;
  @Input() badges: string[] = [];
  @Input() vencidoEn?: string;
  @Input() categorias: string[] = [];
  @Input() mostrarCambiarCategoria = false;
  @Input() mostrarMarcarVencido = false;
  @Input() mostrarEliminar = false;

  @Output() abrir = new EventEmitter<void>();
  @Output() cambiarCategoria = new EventEmitter<string>();
  @Output() marcarVencido = new EventEmitter<void>();
  @Output() eliminar = new EventEmitter<void>();

  protected menuAbierto = signal(false);

  onCambiarCategoria(cat: string): void {
    this.menuAbierto.set(false);
    this.cambiarCategoria.emit(cat);
  }

  onMarcarVencido(): void {
    this.menuAbierto.set(false);
    this.marcarVencido.emit();
  }
}
