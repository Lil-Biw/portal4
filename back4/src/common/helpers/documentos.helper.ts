import { NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { S3Service } from '../s3/s3.service';

export interface ArchivoInput {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
}

export class DocumentosHelper {
  constructor(
    private readonly entidadModel: Model<any>,
    private readonly docModel: Model<any>,
    private readonly fkField: string,
    private readonly docEliminadoModel: Model<any>,
    private readonly origenTipo: 'empresa' | 'centro' | 'activo' | 'proyecto' | 'actividad',
    private readonly entidad: string,
    private readonly s3: S3Service,
  ) {}

  private buildKey(entidadId: string, nombre: string): string {
    return `documentos/${this.origenTipo}/${entidadId}/${nombre}`;
  }

  async agregar(
    id: string,
    archivo: ArchivoInput,
    nombreDisplay?: string,
    categoria?: string,
    usuarioId?: string,
  ): Promise<Record<string, unknown>> {
    const existe = await this.entidadModel.findById(id).lean();
    if (!existe) throw new NotFoundException(`${this.entidad} ${id} no encontrado`);

    const timestamp = Date.now();
    const rand = Math.random().toString(36).substring(7);
    const nombre = `${timestamp}_${rand}_${archivo.originalname}`;

    const dotIdx = archivo.originalname.lastIndexOf('.');
    const originalExt = dotIdx > 0 ? archivo.originalname.slice(dotIdx) : '';
    const rawBase = nombreDisplay?.trim() || archivo.originalname;
    const nombre_display = originalExt && !rawBase.endsWith(originalExt)
      ? rawBase + originalExt
      : rawBase;

    const s3Key = this.buildKey(id, nombre);
    await this.s3.subir(s3Key, archivo.buffer, archivo.mimetype);

    const nuevoDoc: Record<string, unknown> = {
      [this.fkField]: new Types.ObjectId(id),
      nombre,
      nombre_display,
      tipo_mime:    archivo.mimetype,
      tamano_bytes: archivo.size,
      s3_key:       s3Key,
      subido_en:    new Date(),
    };
    if (categoria) nuevoDoc['categoria'] = categoria;
    if (usuarioId) nuevoDoc['subido_por'] = new Types.ObjectId(usuarioId);

    const doc = await this.docModel.create(nuevoDoc);
    const obj = doc.toObject() as Record<string, unknown>;
    delete obj['contenido'];
    return obj;
  }

  async listar(id: string): Promise<Record<string, unknown>[]> {
    return this.docModel
      .find({ [this.fkField]: new Types.ObjectId(id) })
      .select('-contenido')
      .sort({ nombre_display: 1 })
      .lean();
  }

  async servir(entidadId: string, docId: string): Promise<{ buffer: Buffer; tipo_mime: string; nombre_display: string }> {
    const doc = await this.docModel.findOne({
      _id: new Types.ObjectId(docId),
      [this.fkField]: new Types.ObjectId(entidadId),
    });
    if (!doc) throw new NotFoundException(`Documento ${docId} no encontrado`);

    if (doc.s3_key) {
      const buffer = await this.s3.descargar(doc.s3_key as string);
      return { buffer, tipo_mime: doc.tipo_mime as string, nombre_display: doc.nombre_display as string };
    }

    const raw = doc.contenido as unknown;
    const buffer = Buffer.isBuffer(raw)
      ? raw
      : Buffer.from((raw as { buffer: ArrayBuffer }).buffer);
    return { buffer, tipo_mime: doc.tipo_mime as string, nombre_display: doc.nombre_display as string };
  }

  async eliminar(entidadId: string, docId: string): Promise<{ message: string; docId: string }> {
    const doc = await this.docModel.findOne({
      _id: new Types.ObjectId(docId),
      [this.fkField]: new Types.ObjectId(entidadId),
    });
    if (!doc) throw new NotFoundException(`Documento ${docId} no encontrado`);

    await this.docEliminadoModel.create({
      origen_tipo:    this.origenTipo,
      entidad_id:     new Types.ObjectId(entidadId),
      nombre_display: doc.nombre_display,
      categoria:      doc.categoria,
      tipo_mime:      doc.tipo_mime,
      tamano_bytes:   doc.tamano_bytes,
      contenido:      doc.contenido,
      s3_key:         doc.s3_key,
      subido_en:      doc.subido_en,
    });

    await this.docModel.deleteOne({ _id: doc._id });
    return { message: 'Documento eliminado', docId };
  }
}
