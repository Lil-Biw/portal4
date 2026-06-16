import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TipoActivoDocument } from './tipos-activo.schema';
import { CreateTipoActivoDto, UpdateTipoActivoDto } from './tipos-activo.dto';

@Injectable()
export class TiposActivoService {
  constructor(
    @InjectModel('TipoActivo') private tipoModel: Model<TipoActivoDocument>,
  ) {}

  findAll() {
    return this.tipoModel.find().sort({ nombre: 1 }).lean();
  }

  async findOne(id: string) {
    const tipo = await this.tipoModel.findById(id).lean();
    if (!tipo) throw new NotFoundException(`Tipo de activo ${id} no encontrado`);
    return tipo;
  }

  create(dto: CreateTipoActivoDto) {
    return new this.tipoModel(dto).save();
  }

  async update(id: string, dto: UpdateTipoActivoDto) {
    const tipo = await this.tipoModel.findByIdAndUpdate(id, dto, { new: true }).lean();
    if (!tipo) throw new NotFoundException(`Tipo de activo ${id} no encontrado`);
    return tipo;
  }

  async remove(id: string) {
    const tipo = await this.tipoModel.findByIdAndDelete(id).lean();
    if (!tipo) throw new NotFoundException(`Tipo de activo ${id} no encontrado`);
    return { message: 'Tipo eliminado', id };
  }
}
