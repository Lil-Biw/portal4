import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MantencionDocument } from './mantenciones.schema';
import { CreateMantencionDto, UpdateMantencionDto } from './mantenciones.dto';

@Injectable()
export class MantencionesService {
  constructor(
    @InjectModel('Mantencion') private mantencionModel: Model<MantencionDocument>,
  ) {}

  findAll(centroCostoId?: string, desde?: string, hasta?: string) {
    const filter: Record<string, unknown> = {};
    if (centroCostoId) filter['centro_costo_id'] = new Types.ObjectId(centroCostoId);
    if (desde || hasta) {
      filter['fecha'] = {};
      if (desde) (filter['fecha'] as Record<string, Date>)['$gte'] = new Date(desde);
      if (hasta) (filter['fecha'] as Record<string, Date>)['$lte'] = new Date(hasta);
    }
    return this.mantencionModel
      .find(filter)
      .populate('tipo_id')
      .sort({ fecha: 1 })
      .lean();
  }

  async findOne(id: string) {
    const m = await this.mantencionModel.findById(id).populate('tipo_id').lean();
    if (!m) throw new NotFoundException(`Mantención ${id} no encontrada`);
    return m;
  }

  async create(dto: CreateMantencionDto) {
    const m = await new this.mantencionModel({
      ...dto,
      tipo_id: new Types.ObjectId(dto.tipo_id),
      centro_costo_id: new Types.ObjectId(dto.centro_costo_id),
      activo_ids: (dto.activo_ids ?? []).map(id => new Types.ObjectId(id)),
      fecha: new Date(dto.fecha),
    }).save();
    return this.mantencionModel.findById(m._id).populate('tipo_id').lean();
  }

  async update(id: string, dto: UpdateMantencionDto) {
    const payload: Record<string, unknown> = { ...dto };
    if (dto.tipo_id) payload['tipo_id'] = new Types.ObjectId(dto.tipo_id);
    if (dto.centro_costo_id) payload['centro_costo_id'] = new Types.ObjectId(dto.centro_costo_id);
    if (dto.fecha) payload['fecha'] = new Date(dto.fecha);
    if (dto.activo_ids !== undefined) {
      payload['activo_ids'] = dto.activo_ids.map(aid => new Types.ObjectId(aid));
    }

    const m = await this.mantencionModel
      .findByIdAndUpdate(id, payload, { new: true })
      .populate('tipo_id')
      .lean();
    if (!m) throw new NotFoundException(`Mantención ${id} no encontrada`);
    return m;
  }

  async remove(id: string) {
    const m = await this.mantencionModel.findByIdAndDelete(id).lean();
    if (!m) throw new NotFoundException(`Mantención ${id} no encontrada`);
    return { message: 'Mantención eliminada', id };
  }
}
