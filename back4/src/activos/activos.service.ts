import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Activo, ActivoDocument } from './activos.schema';
import { CreateActivoDto, UpdateActivoDto } from './activos.dto';

@Injectable()
export class ActivosService {
  constructor(@InjectModel('Activo') private activoModel: Model<ActivoDocument>) {}

  async findAll(centroCostoId?: string) {
    const filter: Record<string, unknown> = { activo: true };
    if (centroCostoId) filter['centro_costo_id'] = centroCostoId;
    return this.activoModel.find(filter).lean();
  }

  async findOne(id: string) {
    const activo = await this.activoModel.findById(id).lean();
    if (!activo) throw new NotFoundException(`Activo ${id} no encontrado`);
    return activo;
  }

  async create(dto: CreateActivoDto) {
    const activo = new this.activoModel(dto);
    return activo.save();
  }

  async update(id: string, dto: UpdateActivoDto) {
    const activo = await this.activoModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .lean();
    if (!activo) throw new NotFoundException(`Activo ${id} no encontrado`);
    return activo;
  }

  async remove(id: string) {
    const activo = await this.activoModel
      .findByIdAndUpdate(id, { activo: false }, { new: true })
      .lean();
    if (!activo) throw new NotFoundException(`Activo ${id} no encontrado`);
    return { message: 'Activo desactivado correctamente', id };
  }
}
