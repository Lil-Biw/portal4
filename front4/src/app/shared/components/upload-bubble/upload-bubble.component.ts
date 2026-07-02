import { Component, EventEmitter, Input, Output } from '@angular/core';
import { UploadItem } from '../../upload-queue-state';

@Component({
  selector: 'app-upload-bubble',
  standalone: true,
  template: `
    @if (items.length > 0) {
      <div class="upload-bubble">
        <div class="bubble-head">
          <div class="bubble-head-title">
            Subiendo documentos
            <span class="count">{{ items.length }}</span>
          </div>
          <button class="bubble-close" type="button" aria-label="Cerrar" title="Cerrar" (click)="cerrar.emit()">&times;</button>
        </div>

        <div class="bubble-list">
          @for (item of items; track item.id) {
            <div class="upload-item">
              @if (item.estado === 'subiendo') {
                <div class="item-icon uploading" [style.--pct]="item.progreso"><span>{{ item.progreso }}%</span></div>
                <div class="item-body">
                  <div class="item-name">{{ item.nombre }}</div>
                  <div class="progress-track"><div class="progress-fill" [style.width.%]="item.progreso"></div></div>
                </div>
              } @else if (item.estado === 'listo') {
                <div class="item-icon done">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <div class="item-body">
                  <div class="item-name">{{ item.nombre }}</div>
                  <div class="item-meta">Subido correctamente</div>
                </div>
              } @else {
                <div class="item-icon error">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </div>
                <div class="item-body">
                  <div class="item-name">{{ item.nombre }}</div>
                  <div class="item-meta error-text">{{ item.errorMsg }}</div>
                </div>
                <button class="item-retry" type="button" (click)="reintentar.emit(item.id)">Reintentar</button>
              }
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .upload-bubble {
      position: fixed;
      right: 1.5rem;
      bottom: 1.5rem;
      width: 340px;
      background: #fff;
      border-radius: 14px;
      box-shadow: 0 12px 32px rgba(15,23,42,.16), 0 2px 8px rgba(15,23,42,.08);
      overflow: hidden;
      font-size: .875rem;
      z-index: 1000;
    }
    .bubble-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: .75rem 1rem;
      background: rgba(0,149,214,.06);
      border-bottom: 1px solid rgba(0,149,214,.15);
    }
    .bubble-head-title {
      display: flex;
      align-items: center;
      gap: .5rem;
      font-weight: 700;
      color: #0075a8;
    }
    .bubble-head-title .count {
      font-size: .72rem;
      font-weight: 700;
      color: #0095d6;
      background: rgba(0,149,214,.12);
      padding: .1rem .5rem;
      border-radius: 999px;
    }
    .bubble-close {
      border: none;
      background: transparent;
      color: #6b7280;
      width: 24px;
      height: 24px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 1rem;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background .15s, color .15s;
    }
    .bubble-close:hover { background: rgba(34,33,33,.08); color: #1f2937; }
    .bubble-list {
      display: flex;
      flex-direction: column;
      max-height: 280px;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: rgba(0,0,0,.13) transparent;
    }
    .bubble-list::-webkit-scrollbar { width: 4px; }
    .bubble-list::-webkit-scrollbar-thumb { background: rgba(0,0,0,.15); border-radius: 4px; }
    .upload-item {
      display: flex;
      align-items: center;
      gap: .7rem;
      padding: .7rem 1rem;
      border-bottom: 1px solid rgba(34,33,33,.06);
    }
    .upload-item:last-child { border-bottom: none; }
    .item-icon {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .item-icon svg { width: 17px; height: 17px; }
    .item-icon.uploading {
      background: conic-gradient(#0095d6 calc(var(--pct) * 1%), rgba(0,149,214,.14) 0);
      position: relative;
    }
    .item-icon.uploading::after {
      content: "";
      position: absolute;
      inset: 4px;
      background: #fff;
      border-radius: 50%;
    }
    .item-icon.uploading span {
      position: relative;
      z-index: 1;
      font-size: .62rem;
      font-weight: 800;
      color: #0075a8;
      font-variant-numeric: tabular-nums;
    }
    .item-icon.done { background: rgba(16,185,129,.14); color: #10b981; }
    .item-icon.error { background: rgba(239,68,68,.12); color: #ef4444; }
    .item-body { min-width: 0; flex: 1; }
    .item-name {
      font-weight: 600;
      color: #1f2937;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .item-meta { font-size: .76rem; color: #6b7280; margin-top: .15rem; }
    .item-meta.error-text { color: #ef4444; font-weight: 600; }
    .progress-track {
      margin-top: .35rem;
      height: 4px;
      border-radius: 999px;
      background: rgba(0,149,214,.12);
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, #0095d6, #0075a8);
      transition: width .2s ease;
    }
    .item-retry {
      border: 1px solid rgba(239,68,68,.3);
      background: rgba(239,68,68,.06);
      color: #ef4444;
      font-size: .72rem;
      font-weight: 700;
      padding: .25rem .55rem;
      border-radius: 6px;
      cursor: pointer;
      flex-shrink: 0;
      white-space: nowrap;
    }
    @media (prefers-reduced-motion: reduce) {
      .progress-fill { transition: none; }
    }
  `],
})
export class UploadBubbleComponent {
  @Input() items: UploadItem[] = [];
  @Output() cerrar = new EventEmitter<void>();
  @Output() reintentar = new EventEmitter<string>();
}
