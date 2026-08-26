import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import {
  Newsletter,
  CreateNewsletterDto,
  UpdateNewsletterDto,
  ImagenSubidaRespuesta,
  SugerenciaNewsletter,
} from '../../shared/models/newsletter.model';
import { Status } from '../../shared/models/status.model';

interface ImagenNueva { bloque: number; files: File[]; }

@Injectable({ providedIn: 'root' })
export class NewslettersService {
  readonly newsletters = signal<Newsletter[]>([]);
  readonly status     = signal<Status | null>(null);
  readonly loading    = signal(false);
  readonly pendientesCount = signal(0);

  private readonly http = inject(HttpClient);
  private readonly api  = inject(ApiService);

  private get url() { return `${this.api.base}/newsletters`; }

  private setError(err: { error?: { message?: string } }): void {
    this.status.set({ type: 'error', text: err?.error?.message ?? 'Error inesperado' });
  }

  cargar(): void {
    this.loading.set(true);
    this.http.get<Newsletter[]>(this.url).subscribe({
      next: res => { this.newsletters.set(res); this.loading.set(false); },
      error: err => { this.setError(err); this.loading.set(false); },
    });
  }

  async obtener(id: string): Promise<Newsletter | null> {
    try {
      return await firstValueFrom(this.http.get<Newsletter>(`${this.url}/${id}`));
    } catch (err) {
      this.setError(err as { error?: { message?: string } });
      return null;
    }
  }

  async cargarPendientesCount(): Promise<void> {
    try {
      const res = await firstValueFrom(this.http.get<{ count: number }>(`${this.url}/pendientes-count`));
      this.pendientesCount.set(res?.count ?? 0);
    } catch {
      this.pendientesCount.set(0);
    }
  }

  async crear(dto: CreateNewsletterDto, imagenesNuevas: ImagenNueva[]): Promise<boolean> {
    try {
      const newsletter = await firstValueFrom(this.http.post<Newsletter>(this.url, dto));
      await this.subirImagenes(newsletter._id, imagenesNuevas);
      await this.cargarAsync();
      this.status.set({ type: 'ok', text: 'Newsletter guardado como borrador.' });
      return true;
    } catch (err) {
      this.setError(err as { error?: { message?: string } });
      return false;
    }
  }

  async actualizar(
    id: string,
    dto: UpdateNewsletterDto,
    imagenesNuevas: ImagenNueva[],
    imagenesAEliminar: string[],
  ): Promise<boolean> {
    try {
      await firstValueFrom(this.http.put<Newsletter>(`${this.url}/${id}`, dto));
      for (const imagenId of imagenesAEliminar) {
        await this.eliminarImagenAsync(id, imagenId);
      }
      await this.subirImagenes(id, imagenesNuevas);
      await this.cargarAsync();
      this.status.set({ type: 'ok', text: 'Newsletter actualizado.' });
      return true;
    } catch (err) {
      this.setError(err as { error?: { message?: string } });
      return false;
    }
  }

  private async subirImagenes(id: string, imagenesNuevas: ImagenNueva[]): Promise<void> {
    for (const { bloque, files } of imagenesNuevas) {
      if (files.length === 0) continue;
      const form = new FormData();
      files.forEach(f => form.append('imagenes', f));
      await firstValueFrom(this.http.post<ImagenSubidaRespuesta[]>(
        `${this.url}/${id}/imagenes?bloque=${bloque}`, form));
    }
  }

  private async eliminarImagenAsync(id: string, imagenId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.url}/${id}/imagenes/${imagenId}`));
  }

  async eliminar(id: string): Promise<boolean> {
    try {
      await firstValueFrom(this.http.delete(`${this.url}/${id}`));
      this.newsletters.update(list => list.filter(n => n._id !== id));
      this.status.set({ type: 'ok', text: 'Newsletter eliminado.' });
      return true;
    } catch (err) {
      this.setError(err as { error?: { message?: string } });
      return false;
    }
  }

  async enviarPrueba(id: string): Promise<void> {
    try {
      const res = await firstValueFrom(this.http.post<{ message: string }>(`${this.url}/${id}/prueba`, {}));
      this.status.set({ type: 'ok', text: res?.message ?? 'Prueba enviada a tu correo.' });
    } catch (err) {
      this.setError(err as { error?: { message?: string } });
    }
  }

  async solicitarAprobacion(id: string): Promise<void> {
    try {
      const res = await firstValueFrom(this.http.post<{ message: string }>(`${this.url}/${id}/solicitar-aprobacion`, {}));
      await this.cargarAsync();
      await this.cargarPendientesCount();
      this.status.set({ type: 'ok', text: res?.message ?? 'Solicitud de aprobación enviada.' });
    } catch (err) {
      this.setError(err as { error?: { message?: string } });
    }
  }

  async aprobar(id: string): Promise<void> {
    try {
      const res = await firstValueFrom(this.http.post<{ message: string }>(`${this.url}/${id}/aprobar`, {}));
      await this.cargarAsync();
      await this.cargarPendientesCount();
      this.status.set({ type: 'ok', text: res?.message ?? 'Newsletter aprobado.' });
    } catch (err) {
      this.setError(err as { error?: { message?: string } });
    }
  }

  async rechazar(id: string, motivo: string): Promise<void> {
    try {
      const res = await firstValueFrom(this.http.post<{ message: string }>(`${this.url}/${id}/rechazar`, { motivo }));
      await this.cargarAsync();
      await this.cargarPendientesCount();
      this.status.set({ type: 'ok', text: res?.message ?? 'Newsletter rechazado.' });
    } catch (err) {
      this.setError(err as { error?: { message?: string } });
    }
  }

  async enviarATodos(id: string): Promise<void> {
    try {
      const res = await firstValueFrom(this.http.post<{ message: string }>(`${this.url}/${id}/enviar`, {}));
      await this.cargarAsync();
      await this.cargarPendientesCount();
      this.status.set({ type: 'ok', text: res?.message ?? 'Newsletter enviado a todos los miembros.' });
    } catch (err) {
      this.setError(err as { error?: { message?: string } });
    }
  }

  // ── Sugerencias ───────────────────────────────────────────────────────────

  async crearSugerencia(mensaje: string, categoria: string): Promise<void> {
    try {
      await firstValueFrom(this.http.post<SugerenciaNewsletter>(`${this.url}/sugerencias`, { mensaje, categoria }));
      await this.cargarSugerencias();
      this.status.set({ type: 'ok', text: 'Sugerencia enviada.' });
    } catch (err) {
      this.setError(err as { error?: { message?: string } });
    }
  }

  readonly sugerencias = signal<SugerenciaNewsletter[]>([]);

  async cargarSugerencias(): Promise<void> {
    try {
      const res = await firstValueFrom(this.http.get<SugerenciaNewsletter[]>(`${this.url}/sugerencias`));
      this.sugerencias.set(res);
    } catch {
      this.sugerencias.set([]);
    }
  }

  async eliminarSugerencia(id: string): Promise<void> {
    try {
      await firstValueFrom(this.http.delete(`${this.url}/sugerencias/${id}`));
      this.sugerencias.update(list => list.filter(s => s._id !== id));
      this.status.set({ type: 'ok', text: 'Sugerencia eliminada.' });
    } catch (err) {
      this.setError(err as { error?: { message?: string } });
    }
  }

  private async cargarAsync(): Promise<void> {
    const res = await firstValueFrom(this.http.get<Newsletter[]>(this.url));
    this.newsletters.set(res);
  }

  clearStatus(): void { this.status.set(null); }

  imagenUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return `${new URL(this.api.base).origin}${url}`;
  }
}
