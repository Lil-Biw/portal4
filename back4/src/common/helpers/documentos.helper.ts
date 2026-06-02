import { NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';

export interface ArchivoInput {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
}

/**
 * Centraliza el CRUD de subdocumentos `documentos[]` embebidos en cualquier
 * entidad (Cliente, CentroCosto, Proyecto). Instanciar en el servicio que lo use.
 */
export class DocumentosHelper {
  constructor(
    private readonly model: Model<any>,
    private readonly entidad: string,
    private readonly baseSelect = '-documentos.contenido',
  ) {}

  async agregar(
    id: string,
    archivo: ArchivoInput,
    nombreDisplay?: string,
    categoria?: string,
    usuarioId?: string,
  ) {
    const timestamp = Date.now();
    const rand = Math.random().toString(36).substring(7);
    const nombre = `${timestamp}_${rand}_${archivo.originalname}`;

    // Always preserve the original file extension so downloads open correctly
    const dotIdx = archivo.originalname.lastIndexOf('.');
    const originalExt = dotIdx > 0 ? archivo.originalname.slice(dotIdx) : '';
    const rawBase = nombreDisplay?.trim() || archivo.originalname;
    const nombre_display = originalExt && !rawBase.endsWith(originalExt)
      ? rawBase + originalExt
      : rawBase;

    const nuevoDoc: Record<string, unknown> = {
      _id: new Types.ObjectId(),
      nombre,
      nombre_display,
      tipo_mime:      archivo.mimetype,
      tamano_bytes:   archivo.size,
      contenido:      archivo.buffer,
      subido_en:      new Date(),
    };
    if (categoria) nuevoDoc['categoria'] = categoria;
    if (usuarioId) nuevoDoc['subido_por'] = new Types.ObjectId(usuarioId);
    const doc = await this.model
      .findByIdAndUpdate(id, { $push: { documentos: nuevoDoc } }, { new: true })
      .select(this.baseSelect)
      .lean() as any;
    if (!doc) throw new NotFoundException(`${this.entidad} ${id} no encontrado`);
    return doc.documentos[doc.documentos.length - 1];
  }

  async listar(id: string) {
    const doc = await this.model.findById(id).select(this.baseSelect).lean() as any;
    if (!doc) throw new NotFoundException(`${this.entidad} ${id} no encontrado`);
    return doc.documentos ?? [];
  }

  async servir(entityId: string, docId: string): Promise<{ buffer: Buffer; tipo_mime: string; nombre_display: string }> {
    const entity = await this.model.findById(entityId);
    if (!entity) throw new NotFoundException(`${this.entidad} ${entityId} no encontrado`);
    const doc = entity.documentos.find((d: any) => String(d._id) === docId);
    if (!doc) throw new NotFoundException(`Documento ${docId} no encontrado`);
    const raw = doc.contenido as unknown;
    const buffer = Buffer.isBuffer(raw)
      ? raw
      : Buffer.from((raw as { buffer: ArrayBuffer }).buffer);
    return { buffer, tipo_mime: doc.tipo_mime, nombre_display: doc.nombre_display };
  }

  async eliminar(entityId: string, docId: string) {
    const doc = await this.model
      .findByIdAndUpdate(
        entityId,
        { $pull: { documentos: { _id: new Types.ObjectId(docId) } } },
        { new: true },
      )
      .lean();
    if (!doc) throw new NotFoundException(`${this.entidad} ${entityId} no encontrado`);
    return { message: 'Documento eliminado', docId };
  }
}
