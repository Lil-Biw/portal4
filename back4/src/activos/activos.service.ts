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
    return this.activoModel.find(filter).lean();
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
    return this.activoModel.find(filter).lean();
  }

  async findOne(id: string) {
    const activo = await this.activoModel.findById(id).lean();
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
