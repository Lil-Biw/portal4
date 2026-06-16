import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { Activo, CreateActivoDto, UpdateActivoDto } from '../../shared/models/activo.model';
import { Status } from '../../shared/models/status.model';
import { CentrosService } from '../centros/centros.service';
import { asId } from '../../shared/utils';

@Injectable({ providedIn: 'root' })
export class ActivosService {
  private readonly http = inject(HttpClient);
  private readonly api  = inject(ApiService);
  private readonly centrosService = inject(CentrosService);

  readonly activos      = signal<Activo[]>([]);
  readonly seleccionado = signal<Activo | null>(null);
  readonly status       = signal<Status | null>(null);
  readonly loading      = signal(false);
  readonly saving       = signal(false);

  cargar(centroCostoId?: string): void {
    this.loading.set(true);
    const url = centroCostoId
      ? this.api.url(`/activos?centro_costo_id=${centroCostoId}`)
      : this.api.url('/activos');
    this.http.get<Activo[]>(url).subscribe({
      next: (res) => { this.activos.set(res); this.loading.set(false); },
      error: (err) => { this.setError(err); this.loading.set(false); },
    });
  }

  cargarParaConsumidor(empresaId: string, centroId: string): void {
    this.loading.set(true);
    this.http.get<Activo[]>(this.api.url(`/empresas/${empresaId}/centros/${centroId}/activos`)).subscribe({
      next: (res) => { this.activos.set(res); this.loading.set(false); },
      error: (err) => { this.setError(err); this.loading.set(false); },
    });
  }

  cargarPorCentros(empresaId: string, centroIds: string[]): void {
    if (!centroIds.length) { this.activos.set([]); this.loading.set(false); return; }
    this.loading.set(true);
    const reqs = centroIds.map(id =>
      this.http.get<Activo[]>(this.api.url(`/empresas/${empresaId}/centros/${id}/activos`))
        .pipe(catchError(() => of([] as Activo[])))
    );
    forkJoin(reqs).subscribe(resultados => {
      this.activos.set(resultados.flat());
      this.loading.set(false);
    });
  }

  crear(dto: CreateActivoDto, onSuccess?: (activo: Activo) => void): void {
    const { empresaId, centroId } = this.resolverIds(dto.centro_costo_id);
    if (!empresaId || !centroId) { this.setError({ error: { message: 'Centro no encontrado' } }); return; }
    this.saving.set(true);
    this.http.post<Activo>(
      this.api.url(`/empresas/${empresaId}/centros/${centroId}/activos`),
      dto
    ).subscribe({
      next: (activo) => {
        this.status.set({ type: 'ok', text: 'Activo creado correctamente' });
        this.cargar();
        this.saving.set(false);
        onSuccess?.(activo);
      },
      error: (err) => { this.setError(err); this.saving.set(false); },
    });
  }

  actualizar(id: string, dto: UpdateActivoDto): void {
    const centroId = dto.centro_costo_id ?? this.seleccionado()?.centro_costo_id;
    const { empresaId } = this.resolverIds(centroId ?? '');
    if (!empresaId || !centroId) { this.setError({ error: { message: 'Centro no encontrado' } }); return; }
    this.saving.set(true);
    this.http.put<Activo>(
      this.api.url(`/empresas/${empresaId}/centros/${centroId}/activos/${id}`),
      dto
    ).subscribe({
      next: () => {
        this.status.set({ type: 'ok', text: 'Activo actualizado' });
        this.seleccionado.set(null);
        this.cargar();
        this.saving.set(false);
      },
      error: (err) => { this.setError(err); this.saving.set(false); },
    });
  }

  eliminar(id: string): void {
    const centroId = this.seleccionado()?.centro_costo_id;
    const { empresaId } = this.resolverIds(centroId ?? '');
    if (!empresaId || !centroId) { this.setError({ error: { message: 'Centro no encontrado' } }); return; }
    this.http.delete(this.api.url(`/empresas/${empresaId}/centros/${centroId}/activos/${id}`)).subscribe({
      next: () => {
        this.status.set({ type: 'ok', text: 'Activo desactivado correctamente' });
        this.seleccionado.set(null);
        this.cargar();
      },
      error: (err) => this.setError(err),
    });
  }

  subirDocumento(
    activoId: string,
    centroId: string,
    archivo: File,
    nombreDisplay?: string,
    onSuccess?: () => void,
    onError?: () => void,
  ): void {
    const { empresaId } = this.resolverIds(centroId);
    if (!empresaId) { this.setError({ error: { message: 'Centro no encontrado' } }); return; }
    const form = new FormData();
    form.append('archivo', archivo);
    if (nombreDisplay) form.append('nombre_display', nombreDisplay);
    this.http.post<Activo>(
      this.api.url(`/empresas/${empresaId}/centros/${centroId}/activos/${activoId}/documentos`),
      form
    ).subscribe({
      next: (updated) => {
        this.activos.update(list => list.map(a => a._id === activoId ? updated : a));
        if (this.seleccionado()?._id === activoId) this.seleccionado.set(updated);
        this.status.set({ type: 'ok', text: 'Documento adjuntado correctamente' });
        onSuccess?.();
      },
      error: (err) => { this.setError(err); onError?.(); },
    });
  }

  eliminarDocumento(activoId: string, centroId: string, nombre: string): void {
    const { empresaId } = this.resolverIds(centroId);
    if (!empresaId) { this.setError({ error: { message: 'Centro no encontrado' } }); return; }
    const encoded = encodeURIComponent(nombre);
    this.http.delete<Activo>(
      this.api.url(`/empresas/${empresaId}/centros/${centroId}/activos/${activoId}/documentos/${encoded}`)
    ).subscribe({
      next: (updated) => {
        this.activos.update(list => list.map(a => a._id === activoId ? updated : a));
        if (this.seleccionado()?._id === activoId) this.seleccionado.set(updated);
        this.status.set({ type: 'ok', text: 'Documento eliminado' });
      },
      error: (err) => this.setError(err),
    });
  }

  descargarDocumento(activoId: string, centroId: string, nombre: string, nombreDisplay?: string): void {
    const { empresaId } = this.resolverIds(centroId);
    if (!empresaId) { this.status.set({ type: 'error', text: 'Centro no encontrado' }); return; }
    const url = this.api.url(
      `/empresas/${empresaId}/centros/${centroId}/activos/${activoId}/documentos/${encodeURIComponent(nombre)}`
    );
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = nombreDisplay || nombre;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
      },
      error: (err) => this.setError(err),
    });
  }

  seleccionar(activo: Activo): void {
    this.seleccionado.set(activo);
    this.clearStatus();
  }

  clearStatus(): void { this.status.set(null); }

  private resolverIds(centroId: string): { empresaId: string | undefined; centroId: string } {
    const centro = this.centrosService.centros().find(c => asId(c._id) === asId(centroId));
    return { empresaId: centro ? String(centro.cliente_id) : undefined, centroId };
  }

  private setError(err: { error?: { message?: string } }): void {
    this.status.set({ type: 'error', text: err?.error?.message ?? 'Error inesperado' });
  }
}
