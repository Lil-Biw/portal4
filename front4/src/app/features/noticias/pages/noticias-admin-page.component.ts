import { Component, inject, effect, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NoticiasService } from '../noticias.service';
import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';

@Component({
  selector: 'app-noticias-admin-page',
  standalone: true,
  imports: [FormsModule, StatusBannerComponent],
  templateUrl: './noticias-admin-page.component.html',
  styleUrl: './noticias-admin-page.component.css',
})
export class NoticiasAdminPageComponent implements OnInit {
  protected readonly service = inject(NoticiasService);

  protected showModal   = signal(false);
  protected imagenPreview = signal<string | null>(null);
  protected imagenFile  = signal<File | null>(null);
  protected form = { titulo: '', enlace: '', resumen: '' };

  constructor() {
    effect(() => {
      if (this.service.status()?.type === 'ok' && this.showModal()) {
        this.cerrarModal();
      }
    });
  }

  ngOnInit() { this.service.cargar(); }

  abrirModal() {
    this.service.clearStatus();
    this.form = { titulo: '', enlace: '', resumen: '' };
    this.imagenFile.set(null);
    this.imagenPreview.set(null);
    this.showModal.set(true);
  }

  cerrarModal() { this.showModal.set(false); }

  formValido(): boolean {
    return this.form.titulo.trim().length >= 2
      && this.form.enlace.trim().length >= 5
      && this.form.resumen.trim().length >= 5;
  }

  onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.imagenFile.set(file);
    const reader = new FileReader();
    reader.onload = e => this.imagenPreview.set(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  publicar(): void {
    if (!this.formValido()) return;
    this.service.crear(
      { titulo: this.form.titulo.trim(), enlace: this.form.enlace.trim(), resumen: this.form.resumen.trim() },
      this.imagenFile() ?? undefined,
    );
  }

  eliminar(event: MouseEvent, id: string): void {
    event.stopPropagation();
    this.service.eliminar(id);
  }

  abrirEnlace(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  formatFecha(iso: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
}
