import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { Observable, forkJoin, of, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { Status } from '../../shared/models/status.model';
import { asId, NOTIFY_COOLDOWN_MS } from '../../shared/utils';

export const CATEGORIAS_DOCUMENTO = [
  '[AGUA] Boleta/Factura',
  '[COMBUSTIBLE] Boleta/Factura',
  '[BNE] Carpeta Tributaria',
  '[BNE] Ingresos por Ventas',
  '[ENERGIA] Boleta/Factura/BNE',
  '[GAS] Boleta/Factura',
  'Auditorías',
  'Certificados',
  'Contratos',
  'Informes',
  'Lista de Activos',
  'OT',
  'Planos/Diagramas',
  'Otros',
] as const;

export type CategoriaDocumento = (typeof CATEGORIAS_DOCUMENTO)[number];

export interface DocumentoItem {
  _id: string;
  nombre: string;
  nombre_display: string;
  url: string;
  tipo_mime: string;
  tamano_bytes?: number;
  subido_en?: string;
  categoria?: string;
  tipo_contenido?: 'archivo' | 'link';
  link_url?: string;
}

export type DocTipo = 'empresa' | 'centro' | 'proyecto';

export interface DocumentoVencidoItem {
  _id: string;
  nombre_display: string;
  categoria?: string;
  tipo_mime: string;
  tamano_bytes?: number;
  subido_en?: string;
  vencido_en: string;
  origen_tipo: 'empresa' | 'centro' | 'proyecto';
  empresa_nombre?: string;
  centro_nombre?: string;
  proyecto_nombre?: string;
  url: string;
  tipo_contenido?: 'archivo' | 'link';
  link_url?: string;
}

@Injectable({ providedIn: 'root' })
export class DocumentosService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiService);
  private readonly uploadStatusTimers: Partial<Record<DocTipo, ReturnType<typeof setTimeout>>> = {};

  readonly documentosEmpresa     = signal<DocumentoItem[]>([]);
  readonly documentosCentro      = signal<DocumentoItem[]>([]);
  readonly documentosProyecto    = signal<DocumentoItem[]>([]);
  readonly documentosPorCentro   = signal<{ nombre: string; centroId: string; docs: DocumentoItem[] }[]>([]);
  readonly documentosPorProyecto = signal<{ nombre: string; proyectoId: string; centroNombres: string; docs: DocumentoItem[] }[]>([]);
  readonly uploadStatus = signal<Record<DocTipo, Status | null>>({
    empresa: null, centro: null, proyecto: null,
  });
  readonly documentosVencidos = signal<DocumentoVencidoItem[]>([]);

  // Carga documentos de una empresa
  cargarEmpresa(empresaId: string): void {
    this.http.get<DocumentoItem[]>(this.api.url(`/empresas/${empresaId}/documentos`)).subscribe({
      next: (docs) => this.documentosEmpresa.set(
        docs.map(d => this.addUrl(d, `/empresas/${empresaId}/documentos/${d._id}`))
      ),
      error: () => this.documentosEmpresa.set([]),
    });
  }

  // Carga documentos de un centro específico
  cargarCentro(empresaId: string, centroId: string): void {
    this.http.get<DocumentoItem[]>(
      this.api.url(`/empresas/${empresaId}/centros/${centroId}/documentos`)
    ).subscribe({
      next: (docs) => this.documentosCentro.set(
        docs.map(d => this.addUrl(d, `/empresas/${empresaId}/centros/${centroId}/documentos/${d._id}`))
      ),
      error: () => this.documentosCentro.set([]),
    });
  }

  // Carga documentos de un proyecto específico
  cargarProyecto(empresaId: string, centroId: string, proyectoId: string): void {
    this.http.get<DocumentoItem[]>(
      this.api.url(`/empresas/${empresaId}/centros/${centroId}/proyectos/${proyectoId}/documentos`)
    ).subscribe({
      next: (docs) => this.documentosProyecto.set(
        docs.map(d => this.addUrl(d, `/empresas/${empresaId}/centros/${centroId}/proyectos/${proyectoId}/documentos/${d._id}`))
      ),
      error: () => this.documentosProyecto.set([]),
    });
  }

  // Carga docs de todos los centros de una empresa (para vista "todos")
  cargarTodosCentros(empresaId: string, centros: { _id: string; nombre: string }[]): void {
    this.documentosPorCentro.set([]);
    if (!centros.length) return;
    const calls = centros.map(c =>
      this.http.get<DocumentoItem[]>(this.api.url(`/empresas/${empresaId}/centros/${c._id}/documentos`)).pipe(
        catchError(() => of([] as DocumentoItem[]))
      )
    );
    forkJoin(calls).subscribe({
      next: results => this.documentosPorCentro.set(
        centros.map((c, i) => ({
          nombre:    c.nombre,
          centroId:  asId(c._id),
          docs: results[i].map(d => this.addUrl(d, `/empresas/${empresaId}/centros/${c._id}/documentos/${d._id}`)),
        })).filter(x => x.docs.length > 0)
      ),
    });
  }

  // Carga docs de todos los proyectos de una empresa (para vista "todos")
  cargarTodosProyectos(
    empresaId: string,
    proyectos: { _id: string; nombre: string; centro_costo_ids?: string[] }[],
    centros: { _id: string; nombre: string }[]
  ): void {
    this.documentosPorProyecto.set([]);
    if (!proyectos.length) return;
    const calls = proyectos.map(p => {
      const centroId = p.centro_costo_ids?.[0];
      if (!centroId) return of([] as DocumentoItem[]);
      return this.http.get<DocumentoItem[]>(
        this.api.url(`/empresas/${empresaId}/centros/${asId(centroId)}/proyectos/${asId(p._id)}/documentos`)
      ).pipe(catchError(() => of([] as DocumentoItem[])));
    });
    forkJoin(calls).subscribe({
      next: results => {
        const centroMap = new Map(centros.map(c => [asId(c._id), c.nombre]));
        this.documentosPorProyecto.set(
          proyectos
            .map((p, i) => {
              const centroId = p.centro_costo_ids?.[0];
              return {
                nombre:        p.nombre,
                proyectoId:    asId(p._id),
                centroNombres: (p.centro_costo_ids ?? []).map(id => centroMap.get(asId(id))).filter(Boolean).join(', '),
                docs: centroId
                  ? results[i].map(d =>
                      this.addUrl(d, `/empresas/${empresaId}/centros/${asId(centroId)}/proyectos/${asId(p._id)}/documentos/${d._id}`)
                    )
                  : [],
              };
            })
            .filter(x => x.docs.length > 0)
        );
      },
    });
  }

  // Compatibilidad con el componente admin que llama cargar(tipo, empresaNombre, centroNombre, proyectoNombre)
  // En la nueva versión, el componente debe pasar IDs en lugar de nombres.
  // Mantenemos la firma pero usamos los IDs del contexto si se pasan.
  cargar(tipo: DocTipo, empresaId?: string, centroId?: string, proyectoId?: string): void {
    if (tipo === 'empresa' && empresaId) {
      this.cargarEmpresa(empresaId);
    } else if (tipo === 'centro' && empresaId && centroId) {
      this.cargarCentro(empresaId, centroId);
    } else if (tipo === 'proyecto' && empresaId && centroId && proyectoId) {
      this.cargarProyecto(empresaId, centroId, proyectoId);
    }
  }

  private documentosUrl(tipo: DocTipo, empresaId?: string, centroId?: string, proyectoId?: string): string | null {
    if (!empresaId) return null;
    if (tipo === 'empresa') return this.api.url(`/empresas/${empresaId}/documentos`);
    if (tipo === 'proyecto' && centroId && proyectoId) return this.api.url(`/empresas/${empresaId}/centros/${centroId}/proyectos/${proyectoId}/documentos`);
    if (tipo === 'centro' && centroId) return this.api.url(`/empresas/${empresaId}/centros/${centroId}/documentos`);
    return null;
  }

  private recargarTras(tipo: DocTipo, empresaId: string, centroId?: string, proyectoId?: string): void {
    if (tipo === 'empresa') this.cargarEmpresa(empresaId);
    else if (tipo === 'centro' && centroId) this.cargarCentro(empresaId, centroId);
    else if (tipo === 'proyecto' && centroId && proyectoId) this.cargarProyecto(empresaId, centroId, proyectoId);
  }

  subir(
    file: File,
    tipo: DocTipo,
    empresaId?: string,
    centroId?: string,
    proyectoId?: string,
    nombreDisplay?: string,
    categoria?: string,
  ): Observable<HttpEvent<DocumentoItem>> {
    if (!empresaId) return throwError(() => new Error('Empresa no seleccionada'));
    if (tipo === 'centro' && !centroId) return throwError(() => new Error('Selecciona un centro de costos primero.'));
    if (tipo === 'proyecto' && (!centroId || !proyectoId)) return throwError(() => new Error('Selecciona un proyecto primero.'));

    const form = new FormData();
    form.append('archivo', file);
    if (nombreDisplay) form.append('nombre_display', nombreDisplay);
    if (categoria) form.append('categoria', categoria);

    const url = this.documentosUrl(tipo, empresaId, centroId, proyectoId);
    if (!url) return throwError(() => new Error('Contexto insuficiente para subir documento'));

    return this.http.post<DocumentoItem>(url, form, { reportProgress: true, observe: 'events' }).pipe(
      tap(event => {
        if (event.type === HttpEventType.Response) this.recargarTras(tipo, empresaId, centroId, proyectoId);
      }),
    );
  }

  subirLink(
    linkUrl: string,
    tipo: DocTipo,
    empresaId?: string,
    centroId?: string,
    proyectoId?: string,
    nombreDisplay?: string,
    categoria?: string,
  ): Observable<DocumentoItem> {
    if (!empresaId) return throwError(() => new Error('Empresa no seleccionada'));
    if (tipo === 'centro' && !centroId) return throwError(() => new Error('Selecciona un centro de costos primero.'));
    if (tipo === 'proyecto' && (!centroId || !proyectoId)) return throwError(() => new Error('Selecciona un proyecto primero.'));

    const form = new FormData();
    form.append('link_url', linkUrl);
    if (nombreDisplay) form.append('nombre_display', nombreDisplay);
    if (categoria) form.append('categoria', categoria);

    const url = this.documentosUrl(tipo, empresaId, centroId, proyectoId);
    if (!url) return throwError(() => new Error('Contexto insuficiente para subir documento'));

    return this.http.post<DocumentoItem>(url, form).pipe(
      tap(() => this.recargarTras(tipo, empresaId, centroId, proyectoId)),
    );
  }

  eliminar(docUrl: string, tipo: DocTipo, empresaId: string, centroId?: string, proyectoId?: string, onSuccess?: () => void): void {
    if (!docUrl) { this.setUploadStatus(tipo, { type: 'error', text: 'URL de documento no disponible' }); return; }
    this.http.delete(docUrl).subscribe({
      next: () => {
        this.setUploadStatus(tipo, { type: 'ok', text: 'Documento eliminado' });
        if (onSuccess) { onSuccess(); return; }
        if (tipo === 'empresa') this.cargarEmpresa(empresaId);
        else if (tipo === 'centro' && centroId) this.cargarCentro(empresaId, centroId);
        else if (tipo === 'proyecto' && centroId && proyectoId) this.cargarProyecto(empresaId, centroId, proyectoId);
      },
      error: (err) => this.setUploadStatus(tipo, { type: 'error', text: err?.error?.message ?? 'Error al eliminar' }),
    });
  }

  descargar(url: string, nombreDisplay?: string): void {
    this.http.get(url, { responseType: 'blob', observe: 'response' }).subscribe({
      next: (response) => {
        const blob = response.body!;
        const base = nombreDisplay || 'documento';
        const ext  = this.extFromMime(response.headers.get('content-type') ?? blob.type);
        const nombre = base.includes('.') ? base : base + ext;
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = nombre;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
      },
      error: () => {},
    });
  }

  cargarVencidos(empresaId: string, centroId?: string, proyectoId?: string, tipo?: 'empresa' | 'centro' | 'proyecto'): void {
    const params: Record<string, string> = { empresaId };
    if (centroId)   params['centroId']   = centroId;
    if (proyectoId) params['proyectoId'] = proyectoId;
    if (tipo)       params['tipo']       = tipo;
    const qs = new URLSearchParams(params).toString();
    this.http.get<DocumentoVencidoItem[]>(this.api.url(`/documentos-vencidos?${qs}`)).subscribe({
      next:  (v) => this.documentosVencidos.set(
        v.map(item => ({ ...item, url: this.api.url(`/documentos-vencidos/${item._id}`) }))
      ),
      error: ()  => this.documentosVencidos.set([]),
    });
  }

  marcarVencido(
    docUrl: string,
    tipo: DocTipo,
    empresaId: string,
    centroId?: string,
    proyectoId?: string,
    empresaNombre?: string,
    centroNombre?: string,
    proyectoNombre?: string,
    notificacion?: { notificar: boolean; audiencia?: 'todos' | 'especificos'; destinatarios_ids?: string[]; notificar_super_admins?: boolean },
    onSuccess?: () => void,
  ): void {
    const body: Record<string, unknown> = {};
    if (empresaNombre)  body['empresa_nombre']  = empresaNombre;
    if (centroNombre)   body['centro_nombre']   = centroNombre;
    if (proyectoNombre) body['proyecto_nombre'] = proyectoNombre;
    if (notificacion)   body['notificacion']    = notificacion;

    this.http.patch(docUrl + '/vencer', body).subscribe({
      next: () => {
        this.setUploadStatus(tipo, { type: 'ok', text: 'Documento marcado como vencido' });
        if (onSuccess) { onSuccess(); return; }
        if (tipo === 'empresa') this.cargarEmpresa(empresaId);
        else if (tipo === 'centro'   && centroId)               this.cargarCentro(empresaId, centroId);
        else if (tipo === 'proyecto' && centroId && proyectoId) this.cargarProyecto(empresaId, centroId, proyectoId);
        this.cargarVencidos(empresaId, centroId, proyectoId);
      },
      error: (err) => {
        const raw = err?.error?.message;
        const text = Array.isArray(raw) ? raw.join('. ') : (raw ?? 'Error al marcar como vencido');
        this.setUploadStatus(tipo, { type: 'error', text });
      },
    });
  }

  private extFromMime(mime: string): string {
    const m: Record<string, string> = {
      'application/pdf': '.pdf',
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'application/vnd.ms-powerpoint': '.ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
      'text/plain': '.txt',
      'text/csv': '.csv',
      'application/zip': '.zip',
    };
    const base = mime.split(';')[0].trim();
    return m[base] ?? '';
  }

  private addUrl(doc: DocumentoItem, path: string): DocumentoItem {
    return { ...doc, url: this.api.url(path) };
  }

  private setUploadStatus(tipo: DocTipo, status: Status): void {
    const existing = this.uploadStatusTimers[tipo];
    if (existing) clearTimeout(existing);
    this.uploadStatus.update(prev => ({ ...prev, [tipo]: status }));
    this.uploadStatusTimers[tipo] = setTimeout(() => {
      this.uploadStatus.update(prev => ({ ...prev, [tipo]: null }));
      delete this.uploadStatusTimers[tipo];
    }, NOTIFY_COOLDOWN_MS);
  }
}
