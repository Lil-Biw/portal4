import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TipoMantencionDocument } from './tipos-mantencion.schema';
import { CreateTipoMantencionDto, UpdateTipoMantencionDto } from './tipos-mantencion.dto';

@Injectable()
export class TiposMantencionService {
  constructor(
    @InjectModel('TipoMantencion') private tipoModel: Model<TipoMantencionDocument>,
  ) {}

  findAll() {
    return this.tipoModel.find().sort({ nombre: 1 }).lean();
  }

  async findOne(id: string) {
    const tipo = await this.tipoModel.findById(id).lean();
    if (!tipo) throw new NotFoundException(`Tipo de mantención ${id} no encontrado`);
    return tipo;
  }

  create(dto: CreateTipoMantencionDto) {
    return new this.tipoModel(dto).save();
  }

  async update(id: string, dto: UpdateTipoMantencionDto) {
    const tipo = await this.tipoModel.findByIdAndUpdate(id, dto, { new: true }).lean();
    if (!tipo) throw new NotFoundException(`Tipo de mantención ${id} no encontrado`);
    return tipo;
  }

  async remove(id: string) {
    const tipo = await this.tipoModel.findByIdAndDelete(id).lean();
    if (!tipo) throw new NotFoundException(`Tipo de mantención ${id} no encontrado`);
    return { message: 'Tipo eliminado', id };
  }
}
