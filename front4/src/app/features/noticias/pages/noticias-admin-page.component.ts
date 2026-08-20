import { Component, inject, effect, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NoticiasService } from '../noticias.service';
import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';
import { SECCIONES, SeccionNoticia, Noticia } from '../../../shared/models/noticia.model';
import { AuthService } from '../../auth/auth.service';
import { confirmarEliminacion } from '../../../shared/utils';

@Component({
  selector: 'app-noticias-admin-page',
  standalone: true,
  imports: [FormsModule, StatusBannerComponent],
  templateUrl: './noticias-admin-page.component.html',
  styleUrl: './noticias-admin-page.component.css',
})
export class NoticiasAdminPageComponent implements OnInit {
  protected readonly service  = inject(NoticiasService);
  protected readonly authService = inject(AuthService);
  protected readonly secciones = SECCIONES;

  protected showModal     = signal(false);
  protected editandoId    = signal<string | null>(null);
  protected imagenPreview = signal<string | null>(null);
  protected imagenFile    = signal<File | null>(null);
  protected form = { titulo: '', enlace: '', resumen: '', seccion: 'novedades' as SeccionNoticia };

  constructor() {
    effect(() => {
      if (this.service.status()?.type === 'ok' && this.showModal()) {
        this.cerrarModal();
      }
    });
  }

  ngOnInit() { this.service.cargar(); }

  get seccionActual() {
    return this.secciones.find(s => s.value === this.service.seccionActiva())!;
  }

  abrirModal() {
    this.service.clearStatus();
    this.form = { titulo: '', enlace: '', resumen: '', seccion: this.service.seccionActiva() };
    this.imagenFile.set(null);
    this.imagenPreview.set(null);
    this.editandoId.set(null);
    this.showModal.set(true);
  }

  abrirEditar(event: MouseEvent, noticia: Noticia): void {
    event.stopPropagation();
    this.service.clearStatus();
    this.form = { titulo: noticia.titulo, enlace: noticia.enlace, resumen: noticia.resumen, seccion: noticia.seccion };
    this.imagenFile.set(null);
    this.imagenPreview.set(null);
    this.editandoId.set(noticia._id);
    this.showModal.set(true);
  }

  cerrarModal() { this.showModal.set(false); this.editandoId.set(null); }

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

  guardar(): void {
    if (!this.formValido()) return;
    const dto = { titulo: this.form.titulo.trim(), enlace: this.form.enlace.trim(), resumen: this.form.resumen.trim(), seccion: this.form.seccion };
    const id = this.editandoId();
    if (id) {
      this.service.actualizar(id, dto);
    } else {
      this.service.crear(dto, this.imagenFile() ?? undefined);
    }
  }

  eliminar(event: MouseEvent, id: string): void {
    event.stopPropagation();
    const noticia = this.service.noticias().find(n => n._id === id);
    if (noticia && !confirmarEliminacion(noticia.titulo)) return;
    this.service.eliminar(id);
  }

  countSeccion(seccion: SeccionNoticia): number {
    return this.service.noticias().filter(n => n.seccion === seccion).length;
  }

  seccionColor(seccion: SeccionNoticia): string {
    return this.secciones.find(s => s.value === seccion)?.color ?? '#00AEEF';
  }

  seccionLabel(seccion: SeccionNoticia): string {
    return this.secciones.find(s => s.value === seccion)?.labelMin ?? seccion;
  }

  abrirEnlace(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  formatFecha(iso: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
}
