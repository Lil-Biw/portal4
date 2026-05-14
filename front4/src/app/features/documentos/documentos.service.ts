import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { Status } from '../../shared/models/status.model';
import { encodeQuery } from '../../shared/utils';

export const CATEGORIAS_DOCUMENTO = [
  'Contrato',
  'Factura',
  'Boleta',
  'Recibo',
  'Certificado',
  'Informe',
  'Otro',
] as const;

export type CategoriaDocumento = (typeof CATEGORIAS_DOCUMENTO)[number];

export interface DocumentoItem {
  nombre: string;
  nombre_display: string;
  categoria: string;
  url: string;
  tipo_mime: string;
  tamano_bytes?: number;
}

export type DocTipo = 'empresa' | 'centro' | 'proyecto';

@Injectable({ providedIn: 'root' })
export class DocumentosService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiService);

  readonly documentosEmpresa  = signal<DocumentoItem[]>([]);
  readonly documentosCentro   = signal<DocumentoItem[]>([]);
  readonly documentosProyecto = signal<DocumentoItem[]>([]);
  readonly uploadStatus = signal<Record<DocTipo, Status | null>>({
    empresa: null, centro: null, proyecto: null,
  });

  cargar(tipo: DocTipo, empresaNombre?: string, centroNombre?: string, proyectoNombre?: string): void {
    const qs = encodeQuery({ tipo, empresa_nombre: empresaNombre, centro_nombre: centroNombre, proyecto_nombre: proyectoNombre });
    this.http.get<DocumentoItem[]>(`${this.api.url('/documentos/listar')}?${qs}`).subscribe({
      next: (docs) => this.setDocs(tipo, docs),
      error: () => this.setDocs(tipo, []),
    });
  }

  subir(
    file: File,
    tipo: DocTipo,
    empresaNombre?: string,
    centroNombre?: string,
    proyectoNombre?: string,
    centroId?: string,
    proyectoId?: string,
    nombreDisplay?: string,
    categoria?: string,
  ): void {
    const form = new FormData();
    form.append('archivo', file);
    form.append('tipo', tipo);
    if (empresaNombre)  form.append('empresa_nombre', empresaNombre);
    if (centroNombre)   form.append('centro_nombre', centroNombre);
    if (proyectoNombre) form.append('proyecto_nombre', proyectoNombre);
    if (centroId)       form.append('centro_id', centroId);
    if (proyectoId)     form.append('proyecto_id', proyectoId);
    if (nombreDisplay)  form.append('nombre_display', nombreDisplay);
    if (categoria)      form.append('categoria', categoria);

    this.http.post(this.api.url('/documentos/upload'), form).subscribe({
      next: () => {
        this.setUploadStatus(tipo, { type: 'ok', text: `${nombreDisplay || file.name} cargado exitosamente` });
        this.cargar(tipo, empresaNombre, centroNombre, proyectoNombre);
      },
      error: (err) => this.setUploadStatus(tipo, { type: 'error', text: err?.error?.message ?? 'Error al cargar' }),
    });
  }

  eliminar(filename: string, tipo: DocTipo, empresaNombre?: string, centroNombre?: string, proyectoNombre?: string): void {
    const qs = encodeQuery({ tipo, empresa_nombre: empresaNombre, centro_nombre: centroNombre, proyecto_nombre: proyectoNombre });
    this.http.delete(`${this.api.url('/documentos/eliminar')}/${encodeURIComponent(filename)}?${qs}`).subscribe({
      next: () => {
        this.setUploadStatus(tipo, { type: 'ok', text: `${filename} eliminado` });
        this.cargar(tipo, empresaNombre, centroNombre, proyectoNombre);
      },
      error: (err) => this.setUploadStatus(tipo, { type: 'error', text: err?.error?.message ?? 'Error al eliminar' }),
    });
  }

  descargar(url: string): void {
    const fullUrl = url.startsWith('http') ? url : `${this.api.base}${url}`;
    window.open(fullUrl, '_blank');
  }

  private setDocs(tipo: DocTipo, docs: DocumentoItem[]): void {
    if (tipo === 'empresa')  this.documentosEmpresa.set(docs);
    if (tipo === 'centro')   this.documentosCentro.set(docs);
    if (tipo === 'proyecto') this.documentosProyecto.set(docs);
  }

  private setUploadStatus(tipo: DocTipo, status: Status): void {
    this.uploadStatus.update(prev => ({ ...prev, [tipo]: status }));
  }
}
