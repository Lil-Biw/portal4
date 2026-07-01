import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TipoProyectoDocument } from './tipos-proyecto.schema';
import { CreateTipoProyectoDto, UpdateTipoProyectoDto } from './tipos-proyecto.dto';

@Injectable()
export class TiposProyectoService {
  constructor(
    @InjectModel('TipoProyecto') private tipoModel: Model<TipoProyectoDocument>,
  ) {}

  findAll() {
    return this.tipoModel.find().sort({ nombre: 1 }).lean();
  }

  async findOne(id: string) {
    const tipo = await this.tipoModel.findById(id).lean();
    if (!tipo) throw new NotFoundException(`Tipo de proyecto ${id} no encontrado`);
    return tipo;
  }

  create(dto: CreateTipoProyectoDto) {
    return new this.tipoModel(dto).save();
  }

  async update(id: string, dto: UpdateTipoProyectoDto) {
    const tipo = await this.tipoModel.findByIdAndUpdate(id, dto, { new: true }).lean();
    if (!tipo) throw new NotFoundException(`Tipo de proyecto ${id} no encontrado`);
    return tipo;
  }

  async remove(id: string) {
    const tipo = await this.tipoModel.findByIdAndDelete(id).lean();
    if (!tipo) throw new NotFoundException(`Tipo de proyecto ${id} no encontrado`);
    return { message: 'Tipo eliminado', id };
  }
}
