import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MantencionDocument } from './mantenciones.schema';
import { CentroCostoDocument } from '../centros-costos/centros-costos.schema';
import { CreateMantencionDto, UpdateMantencionDto } from './mantenciones.dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class MantencionesService {
  private readonly logger = new Logger(MantencionesService.name);

  constructor(
    @InjectModel('Mantencion') private mantencionModel: Model<MantencionDocument>,
    @InjectModel('CentroCosto') private centroCostoModel: Model<CentroCostoDocument>,
    @InjectModel('Usuario') private usuarioModel: Model<{ nombre: string; email: string; cliente_id: Types.ObjectId; activo: boolean }>,
    private mailService: MailService,
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

    const result = await this.mantencionModel.findById(m._id).populate('tipo_id').lean();

    await this.notificarUsuariosCentro(dto.centro_costo_id, result!);

    return result;
  }

  private async notificarUsuariosCentro(centroCostoId: string, m: Record<string, unknown>) {
    try {
      const centro = await this.centroCostoModel.findById(centroCostoId).lean();
      if (!centro) return;

      const usuarios = await this.usuarioModel
        .find({ cliente_id: new Types.ObjectId(String(centro.cliente_id)), activo: true })
        .select('nombre email')
        .lean();

      this.logger.log(`Notificación mantención: centro=${centroCostoId} usuarios=${usuarios.length}`);

      const destinatarios = usuarios.filter(u => u.email);
      if (destinatarios.length === 0) return;

      const tipo = m.tipo_id as Record<string, unknown> | null;

      await this.mailService.notificarNuevaMantencion({
        destinatarios,
        mantencion: {
          nombre:      String(m.nombre ?? ''),
          tipo:        String(tipo?.nombre ?? 'Sin tipo'),
          fecha:       m.fecha as Date,
          descripcion: m.descripcion ? String(m.descripcion) : undefined,
          centro:      String(centro.nombre),
        },
      });
      this.logger.log(`Correos de mantención enviados a ${destinatarios.length} usuario(s)`);
    } catch (err: unknown) {
      this.logger.error('Error al notificar mantención:', err);
    }
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
