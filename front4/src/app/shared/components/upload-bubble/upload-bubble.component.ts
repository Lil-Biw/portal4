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
      background: var(--bg-0);
      border-radius: 14px;
      box-shadow: var(--shadow-4), var(--shadow-2);
      overflow: hidden;
      font-size: .875rem;
      z-index: 1000;
    }
    .bubble-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: .75rem 1rem;
      background: var(--sc-cyan-tint-6);
      border-bottom: 1px solid var(--sc-cyan-tint-12);
    }
    .bubble-head-title {
      display: flex;
      align-items: center;
      gap: .5rem;
      font-weight: 700;
      color: var(--sc-cyan-pressed);
    }
    .bubble-head-title .count {
      font-size: .72rem;
      font-weight: 700;
      color: var(--sc-cyan);
      background: var(--sc-cyan-tint-12);
      padding: .1rem .5rem;
      border-radius: 999px;
    }
    .bubble-close {
      border: none;
      background: transparent;
      color: var(--fg-3);
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
    .bubble-close:hover { background: var(--bg-2); color: var(--fg-1); }
    .bubble-list {
      display: flex;
      flex-direction: column;
      max-height: 280px;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: var(--border-strong) transparent;
    }
    .bubble-list::-webkit-scrollbar { width: 4px; }
    .bubble-list::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 4px; }
    .upload-item {
      display: flex;
      align-items: center;
      gap: .7rem;
      padding: .7rem 1rem;
      border-bottom: 1px solid var(--border-subtle);
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
      background: conic-gradient(var(--sc-cyan) calc(var(--pct) * 1%), var(--sc-cyan-tint-12) 0);
      position: relative;
    }
    .item-icon.uploading::after {
      content: "";
      position: absolute;
      inset: 4px;
      background: var(--bg-0);
      border-radius: 50%;
    }
    .item-icon.uploading span {
      position: relative;
      z-index: 1;
      font-size: .62rem;
      font-weight: 800;
      color: var(--sc-cyan-pressed);
      font-variant-numeric: tabular-nums;
    }
    .item-icon.done { background: var(--ok-bg); color: var(--ok); }
    .item-icon.error { background: var(--danger-bg); color: var(--danger); }
    .item-body { min-width: 0; flex: 1; }
    .item-name {
      font-weight: 600;
      color: var(--fg-1);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .item-meta { font-size: .76rem; color: var(--fg-3); margin-top: .15rem; }
    .item-meta.error-text { color: var(--danger); font-weight: 600; }
    .progress-track {
      margin-top: .35rem;
      height: 4px;
      border-radius: 999px;
      background: var(--sc-cyan-tint-12);
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, var(--sc-cyan), var(--sc-cyan-pressed));
      transition: width .2s ease;
    }
    .item-retry {
      border: 1px solid var(--danger-bg);
      background: var(--danger-bg);
      color: var(--danger);
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
