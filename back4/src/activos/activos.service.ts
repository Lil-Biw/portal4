import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Activo, ActivoDocument } from './activos.schema';
import { CreateActivoDto, UpdateActivoDto } from './activos.dto';
import { CentroCostoDocument } from '../centros-costos/centros-costos.schema';

@Injectable()
export class ActivosService {
  constructor(
    @InjectModel('Activo') private activoModel: Model<ActivoDocument>,
    @InjectModel('CentroCosto') private centroCostoModel: Model<CentroCostoDocument>,
  ) {}

  async findAll(centroCostoId?: string) {
    const filter: Record<string, unknown> = { activo: true };
    if (centroCostoId) {
      filter['centro_costo_id'] = {
        $in: [centroCostoId, new Types.ObjectId(centroCostoId)],
      };
    }
    return this.activoModel.find(filter).select('-documentos.contenido').lean();
  }

  async findAllByEmpresa(empresaId: string, centroCostoId?: string) {
    const centros = await this.centroCostoModel
      .find({ cliente_id: new Types.ObjectId(empresaId), activo: true })
      .select('_id')
      .lean();
    const centroIds = centros.map((c) => c._id);
    const filter: Record<string, unknown> = {
      activo: true,
      centro_costo_id: { $in: centroIds },
    };
    if (centroCostoId) {
      filter['centro_costo_id'] = {
        $in: [
          ...centroIds,
          new Types.ObjectId(centroCostoId),
          centroCostoId,
        ],
      };
    }
    return this.activoModel.find(filter).select('-documentos.contenido').lean();
  }

  async findOne(id: string) {
    const activo = await this.activoModel.findById(id).select('-documentos.contenido').lean();
    if (!activo) throw new NotFoundException(`Activo ${id} no encontrado`);
    return activo;
  }

  async create(dto: CreateActivoDto) {
    const activo = new this.activoModel({
      ...dto,
      centro_costo_id: new Types.ObjectId(dto.centro_costo_id),
    });
    return activo.save();
  }

  async update(id: string, dto: UpdateActivoDto) {
    const activo = await this.activoModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .select('-documentos.contenido')
      .lean();
    if (!activo) throw new NotFoundException(`Activo ${id} no encontrado`);
    return activo;
  }

  async remove(id: string) {
    const activo = await this.activoModel
      .findByIdAndUpdate(id, { activo: false }, { new: true })
      .select('-documentos.contenido')
      .lean();
    if (!activo) throw new NotFoundException(`Activo ${id} no encontrado`);
    return { message: 'Activo desactivado correctamente', id };
  }

  async subirDocumento(
    id: string,
    archivo: { originalname: string; buffer: Buffer; mimetype: string; size: number },
    nombreDisplay?: string,
  ) {
    const a = await this.activoModel.findById(id).lean();
    if (!a) throw new NotFoundException(`Activo ${id} no encontrado`);

    const timestamp = Date.now();
    const rand = Math.random().toString(36).substring(7);
    const nombre = `${timestamp}_${rand}_${archivo.originalname}`;

    const docEntry = {
      nombre,
      nombre_display: nombreDisplay?.trim() || archivo.originalname,
      tamano_bytes:   archivo.size,
      tipo_mime:      archivo.mimetype,
      contenido:      archivo.buffer,
    };

    return this.activoModel
      .findByIdAndUpdate(id, { $push: { documentos: docEntry } }, { new: true })
      .select('-documentos.contenido')
      .lean();
  }

  async eliminarDocumento(id: string, nombre: string) {
    const a = await this.activoModel.findById(id).lean();
    if (!a) throw new NotFoundException(`Activo ${id} no encontrado`);

    return this.activoModel
      .findByIdAndUpdate(id, { $pull: { documentos: { nombre } } }, { new: true })
      .select('-documentos.contenido')
      .lean();
  }

  async servirDocumento(id: string, nombre: string): Promise<{ buffer: Buffer; tipo_mime: string; nombre_display: string }> {
    // No usar .lean() aquí — Buffer de MongoDB necesita el documento Mongoose para deserializarse
    const a = await this.activoModel.findById(id);
    if (!a) throw new NotFoundException(`Activo ${id} no encontrado`);

    const doc = a.documentos.find(d => d.nombre === nombre);
    if (!doc) throw new NotFoundException(`Documento ${nombre} no encontrado`);

    const raw = doc.contenido as unknown;
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);

    return { buffer, tipo_mime: doc.tipo_mime, nombre_display: doc.nombre_display };
  }
}
