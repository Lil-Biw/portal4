import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { S3Service } from '../s3/s3.service';

export interface ArchivoInput {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
}

export interface DocumentoInput {
  archivo?: ArchivoInput;
  linkUrl?: string;
}

export function esUrlValida(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// Normaliza el nombre para usarlo en la key de S3: translitera acentos (á→a, ñ→n)
// y reemplaza cualquier otro carácter fuera de [a-zA-Z0-9._-] por "_".
// El nombre original se conserva en nombre_display.
export function sanitizarNombreArchivo(nombre: string): string {
  const limpio = nombre
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.-]+/g, '_');
  return limpio.replace(/^[_.]+$/, '') || 'archivo';
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

  // Un id malformado debe responder 404, no tumbar el handler con un BSONError (500)
  private toObjectId(id: string, mensaje: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException(mensaje);
    return new Types.ObjectId(id);
  }

  private entidadOid(id: string): Types.ObjectId {
    return this.toObjectId(id, `${this.entidad} ${id} no encontrado`);
  }

  private docOid(docId: string): Types.ObjectId {
    return this.toObjectId(docId, `Documento ${docId} no encontrado`);
  }

  async agregar(
    id: string,
    input: DocumentoInput,
    nombreDisplay?: string,
    categoria?: string,
    usuarioId?: string,
  ): Promise<Record<string, unknown>> {
    const existe = await this.entidadModel.findById(this.entidadOid(id)).lean();
    if (!existe) throw new NotFoundException(`${this.entidad} ${id} no encontrado`);

    if (input.linkUrl) return this.agregarLink(id, input.linkUrl, nombreDisplay, categoria, usuarioId);
    if (input.archivo) return this.agregarArchivo(id, input.archivo, nombreDisplay, categoria, usuarioId);
    throw new BadRequestException('Debes adjuntar un archivo o un link');
  }

  private async agregarLink(
    id: string,
    linkUrl: string,
    nombreDisplay?: string,
    categoria?: string,
    usuarioId?: string,
  ): Promise<Record<string, unknown>> {
    if (!esUrlValida(linkUrl)) throw new BadRequestException('El link debe ser una URL http(s) válida');

    const nombre_display = nombreDisplay?.trim() || linkUrl;
    const nuevoDoc: Record<string, unknown> = {
      [this.fkField]: new Types.ObjectId(id),
      nombre: nombre_display,
      nombre_display,
      tipo_contenido: 'link',
      link_url:       linkUrl,
      subido_en:      new Date(),
    };
    if (categoria) nuevoDoc['categoria'] = categoria;
    if (usuarioId) nuevoDoc['subido_por'] = new Types.ObjectId(usuarioId);

    const doc = await this.docModel.create(nuevoDoc);
    const obj = doc.toObject() as Record<string, unknown>;
    delete obj['contenido'];
    return obj;
  }

  private async agregarArchivo(
    id: string,
    archivo: ArchivoInput,
    nombreDisplay?: string,
    categoria?: string,
    usuarioId?: string,
  ): Promise<Record<string, unknown>> {
    const timestamp = Date.now();
    const rand = Math.random().toString(36).substring(7);
    const nombre = `${timestamp}_${rand}_${sanitizarNombreArchivo(archivo.originalname)}`;

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
      tipo_contenido: 'archivo',
      tipo_mime:    archivo.mimetype,
      tamano_bytes: archivo.size,
      s3_key:       s3Key,
      subido_en:    new Date(),
    };
    if (categoria) nuevoDoc['categoria'] = categoria;
    if (usuarioId) nuevoDoc['subido_por'] = new Types.ObjectId(usuarioId);

    let doc;
    try {
      doc = await this.docModel.create(nuevoDoc);
    } catch (err) {
      // Si la metadata no se pudo guardar, el objeto ya subido quedaría huérfano en S3
      await this.s3.eliminar(s3Key).catch(() => undefined);
      throw err;
    }
    const obj = doc.toObject() as Record<string, unknown>;
    delete obj['contenido'];
    return obj;
  }

  async listar(id: string): Promise<Record<string, unknown>[]> {
    return this.docModel
      .find({ [this.fkField]: this.entidadOid(id) })
      .select('-contenido')
      .sort({ nombre_display: 1 })
      .lean();
  }

  async servir(entidadId: string, docId: string): Promise<{ buffer: Buffer; tipo_mime: string; nombre_display: string }> {
    const doc = await this.docModel.findOne({
      _id: this.docOid(docId),
      [this.fkField]: this.entidadOid(entidadId),
    });
    if (!doc) throw new NotFoundException(`Documento ${docId} no encontrado`);
    if (doc.tipo_contenido === 'link') throw new BadRequestException('Este documento es un link externo, no un archivo');

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
      _id: this.docOid(docId),
      [this.fkField]: this.entidadOid(entidadId),
    });
    if (!doc) throw new NotFoundException(`Documento ${docId} no encontrado`);

    await this.docEliminadoModel.create({
      origen_tipo:    this.origenTipo,
      entidad_id:     new Types.ObjectId(entidadId),
      nombre_display: doc.nombre_display,
      categoria:      doc.categoria,
      tipo_contenido: doc.tipo_contenido,
      link_url:       doc.link_url,
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

// Resuelve en batch subido_por (ObjectId) -> nombre de usuario, para listados de
// documentos. Un solo find() con $in, no N+1. Si un doc no tiene subido_por, o el
// usuario no existe, se omite el campo (nunca se agrega un placeholder).
export async function resolverSubidoPorNombre(
  docs: Record<string, unknown>[],
  usuarioModel: Model<any>,
): Promise<Record<string, unknown>[]> {
  const ids = [...new Set(
    docs.map(d => d['subido_por']).filter(Boolean).map(String)
  )];
  if (!ids.length) return docs;

  const usuarios = await usuarioModel
    .find({ _id: { $in: ids } })
    .select('nombre')
    .lean();
  const nombreMap = new Map(usuarios.map(u => [String((u as any)._id), (u as any).nombre]));

  return docs.map(d => {
    const nombre = d['subido_por'] ? nombreMap.get(String(d['subido_por'])) : undefined;
    return nombre ? { ...d, subido_por_nombre: nombre } : d;
  });
}
