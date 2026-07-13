import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TipoProyectoDocument } from './tipos-proyecto.schema';
import { CreateTipoProyectoDto, UpdateTipoProyectoDto } from './tipos-proyecto.dto';
import { CATALOGO_TIPOS_PROYECTO } from './tipos-proyecto.catalogo';

@Injectable()
export class TiposProyectoService implements OnModuleInit {
  private readonly logger = new Logger(TiposProyectoService.name);

  constructor(
    @InjectModel('TipoProyecto') private tipoModel: Model<TipoProyectoDocument>,
  ) {}

  // Siembra el catálogo oficial (A–K) solo si la colección está vacía (primer arranque).
  // A partir de ahí los tipos se administran por completo desde la UI (crear/editar/eliminar) —
  // no se vuelve a forzar ni a borrar nada en arranques posteriores.
  async onModuleInit() {
    try {
      const total = await this.tipoModel.countDocuments();
      if (total > 0) return;
      await this.tipoModel.insertMany(CATALOGO_TIPOS_PROYECTO);
      this.logger.log(`Catálogo inicial de tipos de proyecto sembrado (${CATALOGO_TIPOS_PROYECTO.length})`);
    } catch (err: unknown) {
      this.logger.error('Error al sembrar el catálogo inicial de tipos de proyecto:', err);
    }
  }

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
