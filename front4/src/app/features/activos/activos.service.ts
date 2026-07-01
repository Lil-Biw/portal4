import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { Activo, ActividadHistorialItem, CreateActivoDto, DocActivo, UpdateActivoDto } from '../../shared/models/activo.model';
import { Status } from '../../shared/models/status.model';
import { CentrosService } from '../centros/centros.service';
import { asId } from '../../shared/utils';

@Injectable({ providedIn: 'root' })
export class ActivosService {
  private readonly http = inject(HttpClient);
  private readonly api  = inject(ApiService);
  private readonly centrosService = inject(CentrosService);

  readonly activos           = signal<Activo[]>([]);
  readonly seleccionado      = signal<Activo | null>(null);
  readonly status            = signal<Status | null>(null);
  readonly loading           = signal(false);
  readonly saving            = signal(false);
  readonly historialActivo   = signal<ActividadHistorialItem[]>([]);
  readonly loadingHistorial  = signal(false);
  readonly documentosActivo  = signal<DocActivo[]>([]);
  private historialSub: Subscription | null = null;

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

  listarDocumentos(activoId: string, centroId: string): void {
    const { empresaId } = this.resolverIds(centroId);
    if (!empresaId) return;
    this.http.get<DocActivo[]>(
      this.api.url(`/empresas/${empresaId}/centros/${centroId}/activos/${activoId}/documentos`)
    ).subscribe({
      next: (docs) => this.documentosActivo.set(docs),
      error: () => this.documentosActivo.set([]),
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
    this.http.post(
      this.api.url(`/empresas/${empresaId}/centros/${centroId}/activos/${activoId}/documentos`),
      form
    ).subscribe({
      next: () => {
        this.status.set({ type: 'ok', text: 'Documento adjuntado correctamente' });
        this.listarDocumentos(activoId, centroId);
        onSuccess?.();
      },
      error: (err) => { this.setError(err); onError?.(); },
    });
  }

  eliminarDocumento(activoId: string, centroId: string, docId: string): void {
    const { empresaId } = this.resolverIds(centroId);
    if (!empresaId) { this.setError({ error: { message: 'Centro no encontrado' } }); return; }
    this.http.delete(
      this.api.url(`/empresas/${empresaId}/centros/${centroId}/activos/${activoId}/documentos/${docId}`)
    ).subscribe({
      next: () => {
        this.status.set({ type: 'ok', text: 'Documento eliminado' });
        this.listarDocumentos(activoId, centroId);
      },
      error: (err) => this.setError(err),
    });
  }

  descargarDocumento(activoId: string, centroId: string, docId: string, nombreDisplay?: string): void {
    const { empresaId } = this.resolverIds(centroId);
    if (!empresaId) { this.status.set({ type: 'error', text: 'Centro no encontrado' }); return; }
    const url = this.api.url(
      `/empresas/${empresaId}/centros/${centroId}/activos/${activoId}/documentos/${docId}`
    );
    this.triggerDownload(url, nombreDisplay || docId);
  }

  descargarDocumentoActividad(actividadId: string, centroId: string, docId: string, nombreDisplay?: string): void {
    const { empresaId } = this.resolverIds(centroId);
    if (!empresaId) { this.status.set({ type: 'error', text: 'Centro no encontrado' }); return; }
    const url = this.api.url(
      `/empresas/${empresaId}/centros/${centroId}/actividades/${actividadId}/documentos/${docId}`
    );
    this.triggerDownload(url, nombreDisplay || docId);
  }

  cargarHistorial(activoId: string, centroId: string): void {
    this.historialSub?.unsubscribe();
    const { empresaId } = this.resolverIds(centroId);
    if (!empresaId) return;
    this.loadingHistorial.set(true);
    this.historialActivo.set([]);
    this.historialSub = this.http.get<ActividadHistorialItem[]>(
      this.api.url(`/empresas/${empresaId}/centros/${centroId}/activos/${activoId}/historial`)
    ).subscribe({
      next: (res) => { this.historialActivo.set(res); this.loadingHistorial.set(false); },
      error: () => { this.loadingHistorial.set(false); },
    });
  }

  resetHistorial(): void {
    this.historialSub?.unsubscribe();
    this.historialSub = null;
    this.historialActivo.set([]);
    this.loadingHistorial.set(false);
  }

  private triggerDownload(url: string, fileName: string): void {
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = fileName;
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
