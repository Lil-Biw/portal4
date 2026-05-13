import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PermisoDocument } from './permisos.schema';
import { AsignarPermisoDto } from './permisos.dto';

@Injectable()
export class PermisosService {
  constructor(@InjectModel('Permiso') private permisoModel: Model<PermisoDocument>) {}

  async asignar(dto: AsignarPermisoDto, asignadoPor?: string, clienteId?: string) {
    const existe = await this.permisoModel.findOne({
      usuario_id: dto.usuario_id,
      centro_costo_id: dto.centro_costo_id,
    });

    if (existe) {
      return this.permisoModel.findByIdAndUpdate(
        existe._id,
        { tipo: dto.tipo },
        { new: true },
      ).lean();
    }

    const doc: any = { ...dto };
    if (clienteId) doc.cliente_id = new Types.ObjectId(clienteId);
    if (asignadoPor) doc.asignado_por = new Types.ObjectId(asignadoPor);
    return new this.permisoModel(doc).save();
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
    const resultado = await this.permisoModel.deleteOne({
      usuario_id: new Types.ObjectId(usuario_id),
      centro_costo_id: new Types.ObjectId(centro_costo_id),
    });

    if (resultado.deletedCount === 0) {
      throw new NotFoundException('No se encontró el permiso para revocar');
    }

    return { message: 'Permiso revocado correctamente' };
  }
}
