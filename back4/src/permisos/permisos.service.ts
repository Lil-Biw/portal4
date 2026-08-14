import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PermisoDocument } from './permisos.schema';
import { AsignarPermisoDto } from './permisos.dto';

@Injectable()
export class PermisosService {
  private readonly logger = new Logger(PermisosService.name);

  constructor(
    @InjectModel('Permiso') private permisoModel: Model<PermisoDocument>,
    @InjectModel('CentroCosto') private centroCostoModel: Model<any>,
  ) {}

  async asignar(dto: AsignarPermisoDto, asignadoPor: string) {
    this.logger.log(`asignar: usuario=${dto.usuario_id} centro=${dto.centro_costo_id} tipo=${dto.tipo}`);

    const centro = await this.centroCostoModel.findById(dto.centro_costo_id).select('cliente_id').lean() as unknown as { cliente_id: Types.ObjectId } | null;
    if (!centro) throw new NotFoundException(`Centro de costos ${dto.centro_costo_id} no encontrado`);

    const existe = await this.permisoModel.findOne({
      usuario_id: new Types.ObjectId(dto.usuario_id),
      centro_costo_id: new Types.ObjectId(dto.centro_costo_id),
    });

    if (existe) {
      return this.permisoModel.findByIdAndUpdate(
        existe._id,
        { tipo: dto.tipo },
        { new: true },
      ).lean();
    }

    return new this.permisoModel({
      ...dto,
      cliente_id: centro.cliente_id,
      asignado_por: new Types.ObjectId(asignadoPor),
    }).save();
  }

  async findByUsuario(usuario_id: string) {
    return this.permisoModel
      .find({ usuario_id: new Types.ObjectId(usuario_id) })
      .populate('centro_costo_id', 'codigo nombre')
      .lean();
  }

  async findByCentro(centro_costo_id: string) {
    return this.permisoModel
      .find({ centro_costo_id: new Types.ObjectId(centro_costo_id) })
      .populate('usuario_id', 'nombre email')
      .lean();
  }

  async revocar(usuario_id: string, centro_costo_id: string) {
    if (!usuario_id || !centro_costo_id) return { message: 'Permiso revocado correctamente' };
    await this.permisoModel.deleteOne({
      usuario_id: new Types.ObjectId(usuario_id),
      centro_costo_id: new Types.ObjectId(centro_costo_id),
    });
    return { message: 'Permiso revocado correctamente' };
  }
}
