import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TipoActividadDocument } from './tipos-actividad.schema';
import { CreateTipoActividadDto, UpdateTipoActividadDto } from './tipos-actividad.dto';

@Injectable()
export class TiposActividadService {
  constructor(
    @InjectModel('TipoActividad') private tipoModel: Model<TipoActividadDocument>,
  ) {}

  findAll() {
    return this.tipoModel.find().sort({ nombre: 1 }).lean();
  }

  async findOne(id: string) {
    const tipo = await this.tipoModel.findById(id).lean();
    if (!tipo) throw new NotFoundException(`Tipo de actividad ${id} no encontrado`);
    return tipo;
  }

  create(dto: CreateTipoActividadDto) {
    return new this.tipoModel(dto).save();
  }

  async update(id: string, dto: UpdateTipoActividadDto) {
    const tipo = await this.tipoModel.findByIdAndUpdate(id, dto, { new: true, runValidators: true }).lean();
    if (!tipo) throw new NotFoundException(`Tipo de actividad ${id} no encontrado`);
    return tipo;
  }

  async remove(id: string) {
    const tipo = await this.tipoModel.findByIdAndDelete(id).lean();
    if (!tipo) throw new NotFoundException(`Tipo de actividad ${id} no encontrado`);
    return { message: 'Tipo eliminado', id };
  }
}
