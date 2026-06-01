import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { Status } from '../../shared/models/status.model';

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
}

export type DocTipo = 'empresa' | 'centro' | 'proyecto';

@Injectable({ providedIn: 'root' })
export class DocumentosService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiService);

  readonly documentosEmpresa     = signal<DocumentoItem[]>([]);
  readonly documentosCentro      = signal<DocumentoItem[]>([]);
  readonly documentosProyecto    = signal<DocumentoItem[]>([]);
  readonly documentosPorCentro   = signal<{ nombre: string; docs: DocumentoItem[] }[]>([]);
  readonly uploadStatus = signal<Record<DocTipo, Status | null>>({
    empresa: null, centro: null, proyecto: null,
  });

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
      this.http.get<DocumentoItem[]>(this.api.url(`/empresas/${empresaId}/centros/${c._id}/documentos`))
    );
    forkJoin(calls).subscribe({
      next: results => this.documentosPorCentro.set(
        centros.map((c, i) => ({
          nombre: c.nombre,
          docs: results[i].map(d => this.addUrl(d, `/empresas/${empresaId}/centros/${c._id}/documentos/${d._id}`)),
        })).filter(x => x.docs.length > 0)
      ),
      error: () => this.documentosPorCentro.set([]),
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

  subir(
    file: File,
    tipo: DocTipo,
    empresaId?: string,
    centroId?: string,
    proyectoId?: string,
    nombreDisplay?: string,
    categoria?: string,
  ): void {
    if (!empresaId) { this.setUploadStatus(tipo, { type: 'error', text: 'Empresa no seleccionada' }); return; }
    if (tipo === 'centro' && !centroId) { this.setUploadStatus(tipo, { type: 'error', text: 'Selecciona un centro de costos primero.' }); return; }
    if (tipo === 'proyecto' && (!centroId || !proyectoId)) { this.setUploadStatus(tipo, { type: 'error', text: 'Selecciona un proyecto primero.' }); return; }

    const form = new FormData();
    form.append('archivo', file);
    if (nombreDisplay) form.append('nombre_display', nombreDisplay);
    if (categoria) form.append('categoria', categoria);

    let url: string;
    if (tipo === 'empresa') {
      url = this.api.url(`/empresas/${empresaId}/documentos`);
    } else if (tipo === 'proyecto' && centroId && proyectoId) {
      url = this.api.url(`/empresas/${empresaId}/centros/${centroId}/proyectos/${proyectoId}/documentos`);
    } else if (tipo === 'centro' && centroId) {
      url = this.api.url(`/empresas/${empresaId}/centros/${centroId}/documentos`);
    } else {
      this.setUploadStatus(tipo, { type: 'error', text: 'Contexto insuficiente para subir documento' });
      return;
    }

    this.http.post(url, form).subscribe({
      next: () => {
        this.setUploadStatus(tipo, { type: 'ok', text: `${nombreDisplay || file.name} cargado exitosamente` });
        if (tipo === 'empresa') this.cargarEmpresa(empresaId);
        else if (tipo === 'centro' && centroId) this.cargarCentro(empresaId, centroId);
        else if (tipo === 'proyecto' && centroId && proyectoId) this.cargarProyecto(empresaId, centroId, proyectoId);
      },
      error: (err) => {
        const raw = err?.error?.message;
        const text = Array.isArray(raw) ? raw.join('. ') : (raw ?? 'Error al cargar');
        this.setUploadStatus(tipo, { type: 'error', text });
      },
    });
  }

  eliminar(docId: string, tipo: DocTipo, empresaId?: string, centroId?: string, proyectoId?: string): void {
    if (!empresaId) { this.setUploadStatus(tipo, { type: 'error', text: 'Contexto insuficiente' }); return; }
    let url: string;
    if (tipo === 'empresa') {
      url = this.api.url(`/empresas/${empresaId}/documentos/${docId}`);
    } else if (tipo === 'proyecto' && centroId && proyectoId) {
      url = this.api.url(`/empresas/${empresaId}/centros/${centroId}/proyectos/${proyectoId}/documentos/${docId}`);
    } else if (tipo === 'centro' && centroId) {
      url = this.api.url(`/empresas/${empresaId}/centros/${centroId}/documentos/${docId}`);
    } else {
      this.setUploadStatus(tipo, { type: 'error', text: 'Contexto insuficiente' }); return;
    }
    this.http.delete(url).subscribe({
      next: () => {
        this.setUploadStatus(tipo, { type: 'ok', text: 'Documento eliminado' });
        if (tipo === 'empresa') this.cargarEmpresa(empresaId);
        else if (tipo === 'centro' && centroId) this.cargarCentro(empresaId, centroId);
        else if (tipo === 'proyecto' && centroId && proyectoId) this.cargarProyecto(empresaId, centroId, proyectoId);
      },
      error: (err) => this.setUploadStatus(tipo, { type: 'error', text: err?.error?.message ?? 'Error al eliminar' }),
    });
  }

  descargar(url: string, nombreDisplay?: string): void {
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = nombreDisplay || 'documento';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
      },
      error: () => {},
    });
  }

  private addUrl(doc: DocumentoItem, path: string): DocumentoItem {
    return { ...doc, url: this.api.url(path) };
  }

  private setUploadStatus(tipo: DocTipo, status: Status): void {
    this.uploadStatus.update(prev => ({ ...prev, [tipo]: status }));
  }
}
