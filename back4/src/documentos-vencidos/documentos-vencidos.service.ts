import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DocumentoVencido, DocumentoVencidoDocument } from './documentos-vencidos.schema';
import { CreateDocVencidoDto } from './documentos-vencidos.dto';
import { S3Service } from '../common/s3/s3.service';

@Injectable()
export class DocumentosVencidosService {
  constructor(
    @InjectModel('DocumentoVencido') private readonly model: Model<DocumentoVencidoDocument>,
    private readonly s3Service: S3Service,
  ) {}

  crear(dto: CreateDocVencidoDto) {
    const doc = new this.model({
      ...dto,
      empresa_id:  new Types.ObjectId(dto.empresa_id),
      centro_id:   dto.centro_id   ? new Types.ObjectId(dto.centro_id)   : undefined,
      proyecto_id: dto.proyecto_id ? new Types.ObjectId(dto.proyecto_id) : undefined,
    });
    return doc.save();
  }

  listarUltimos20(empresaId: string, centroId?: string, proyectoId?: string, tipo?: string) {
    if (!empresaId || !Types.ObjectId.isValid(empresaId)) return Promise.resolve([]);
    const filter: Record<string, unknown> = { empresa_id: new Types.ObjectId(empresaId) };
    if (proyectoId && Types.ObjectId.isValid(proyectoId)) {
      filter['proyecto_id'] = new Types.ObjectId(proyectoId);
      filter['origen_tipo'] = 'proyecto';
    } else if (centroId && Types.ObjectId.isValid(centroId)) {
      filter['centro_id'] = new Types.ObjectId(centroId);
      filter['origen_tipo'] = tipo === 'proyecto' ? 'proyecto' : 'centro';
    } else if (tipo === 'proyecto' || tipo === 'centro') {
      filter['origen_tipo'] = tipo;
    } else {
      filter['origen_tipo'] = 'empresa';
    }
    return this.model.find(filter).sort({ vencido_en: -1 }).limit(20).select('-contenido').lean();
  }

  async descargar(id: string): Promise<{ buffer: Buffer; tipo_mime: string; nombre_display: string }> {
    const doc = await this.model.findById(id);
    if (!doc) throw new NotFoundException('Documento vencido no encontrado');
    if (doc.s3_key) {
      const buffer = await this.s3Service.descargar(doc.s3_key);
      return { buffer, tipo_mime: doc.tipo_mime, nombre_display: doc.nombre_display };
    }
    const raw = doc.contenido as unknown;
    const buffer = Buffer.isBuffer(raw)
      ? raw
      : Buffer.from((raw as { buffer: ArrayBuffer }).buffer);
    return { buffer, tipo_mime: doc.tipo_mime, nombre_display: doc.nombre_display };
  }
}
