import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { Noticia, CreateNoticiaDto, SeccionNoticia } from '../../shared/models/noticia.model';
import { Status } from '../../shared/models/status.model';

@Injectable({ providedIn: 'root' })
export class NoticiasService {
  readonly noticias  = signal<Noticia[]>([]);
  readonly status    = signal<Status | null>(null);
  readonly loading   = signal(false);
  readonly seccionActiva = signal<SeccionNoticia>('novedades');

  readonly noticiasFiltradas = computed(() =>
    this.noticias().filter(n => n.seccion === this.seccionActiva())
  );

  private readonly http = inject(HttpClient);
  private readonly api  = inject(ApiService);

  private get url() { return `${this.api.base}/noticias`; }

  private setError(err: { error?: { message?: string } }): void {
    this.status.set({ type: 'error', text: err?.error?.message ?? 'Error inesperado' });
  }

  cargar(): void {
    this.loading.set(true);
    this.http.get<Noticia[]>(this.url).subscribe({
      next: res => { this.noticias.set(res); this.loading.set(false); },
      error: err => { this.setError(err); this.loading.set(false); },
    });
  }

  crear(dto: CreateNoticiaDto, imagen?: File): void {
    this.http.post<Noticia>(this.url, dto).subscribe({
      next: noticia => {
        if (imagen) {
          this.subirImagen(noticia._id, imagen, noticia);
        } else {
          this.noticias.update(list => [noticia, ...list]);
          this.status.set({ type: 'ok', text: 'Noticia publicada. Se notificó a todos los usuarios.' });
        }
      },
      error: err => this.setError(err),
    });
  }

  private subirImagen(id: string, file: File, noticia: Noticia): void {
    const form = new FormData();
    form.append('imagen', file);
    this.http.post<Noticia>(`${this.url}/${id}/imagen`, form).subscribe({
      next: updated => {
        this.noticias.update(list => [updated ?? noticia, ...list]);
        this.status.set({ type: 'ok', text: 'Noticia publicada. Se notificó a todos los usuarios.' });
      },
      error: () => {
        this.noticias.update(list => [noticia, ...list]);
        this.status.set({ type: 'ok', text: 'Noticia publicada (sin imagen)' });
      },
    });
  }

  actualizar(id: string, dto: CreateNoticiaDto): void {
    this.http.put<Noticia>(`${this.url}/${id}`, dto).subscribe({
      next: updated => {
        this.noticias.update(list => list.map(n => n._id === id ? updated : n));
        this.status.set({ type: 'ok', text: 'Publicación actualizada.' });
      },
      error: err => this.setError(err),
    });
  }

  eliminar(id: string): void {
    this.http.delete(`${this.url}/${id}`).subscribe({
      next: () => {
        this.noticias.update(list => list.filter(n => n._id !== id));
        this.status.set({ type: 'ok', text: 'Noticia eliminada' });
      },
      error: err => this.setError(err),
    });
  }

  clearStatus(): void { this.status.set(null); }

  imagenUrl(noticia: Noticia): string | null {
    const url = noticia.imagen_url;
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${new URL(this.api.base).origin}${url}`;
  }
}
