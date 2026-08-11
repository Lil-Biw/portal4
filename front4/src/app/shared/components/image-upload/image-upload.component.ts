import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';

@Component({
  selector: 'app-image-upload',
  standalone: true,
  template: `
    <div class="image-upload">
      <span class="image-upload-label">{{ titulo }}</span>
      <div class="image-upload-frame" [style.aspect-ratio]="aspectRatio">
        @if (preview) {
          <img [src]="preview" [alt]="titulo" [style.object-fit]="objectFit" />
        } @else {
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        }
      </div>
      <input [id]="inputId" type="file" accept="image/*" (change)="onFileChange($event)" class="image-upload-input" />
      <label class="image-upload-btn" [for]="inputId">Cambiar {{ titulo.toLowerCase() }}</label>
      @if (hint) {
        <p class="image-upload-hint">{{ hint }}</p>
      }
    </div>
  `,
  styles: [`
    .image-upload {
      border: 1px solid rgba(34,33,33,.12);
      border-radius: 10px;
      padding: .85rem;
      display: flex;
      flex-direction: column;
      gap: .65rem;
      background: #f9fafb;
    }
    .image-upload-label {
      font-size: .75rem;
      font-weight: 700;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: .03em;
    }
    .image-upload-frame {
      width: 100%;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid #e5e7eb;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .image-upload-frame img {
      width: 100%;
      height: 100%;
    }
    .image-upload-btn {
      text-align: center;
      font-size: .78rem;
      font-weight: 600;
      color: #0095d6;
      border: 1px solid rgba(0,149,214,.35);
      background: rgba(0,149,214,.06);
      border-radius: 8px;
      padding: .5rem;
      cursor: pointer;
    }
    .image-upload-input:focus-visible + .image-upload-btn {
      outline: 2px solid #0095d6;
      outline-offset: 2px;
    }
    .image-upload-input {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
      border: 0;
    }
    .image-upload-hint {
      margin: 0;
      font-size: .7rem;
      color: #9ca3af;
      text-align: center;
      line-height: 1.4;
    }
  `],
})
export class ImageUploadComponent implements OnChanges {
  private readonly cdr = inject(ChangeDetectorRef);

  private static seq = 0;
  protected readonly inputId = `image-upload-${ImageUploadComponent.seq++}`;

  @Input() titulo = 'Imagen';
  @Input() aspectRatio = '4/3';
  @Input() objectFit: 'cover' | 'contain' = 'cover';
  @Input() hint = '';
  @Input() initialUrl: string | null = null;
  @Output() archivoSeleccionado = new EventEmitter<File | null>();

  preview: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialUrl']) this.preview = this.initialUrl;
  }

  onFileChange(ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0] ?? null;
    this.archivoSeleccionado.emit(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => { this.preview = e.target?.result as string; this.cdr.markForCheck(); };
      reader.readAsDataURL(file);
    } else {
      this.preview = this.initialUrl;
    }
  }
}
