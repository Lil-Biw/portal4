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
    @InjectModel('Usuario') private usuarioModel: Model<{ nombre: string; email: string; rol: string; cliente_id: Types.ObjectId; centros_asignados: Types.ObjectId[]; activo: boolean }>,
    @InjectModel('Activo') private activoModel: Model<{ nombre: string }>,
    private mailService: MailService,
  ) {}

  async findAllByEmpresa(empresaId: string) {
    const centros = await this.centroCostoModel
      .find({ cliente_id: new Types.ObjectId(empresaId), activo: true })
      .select('_id')
      .lean();
    const centroIds = centros.map(c => c._id);
    return this.mantencionModel
      .find({ centro_costo_id: { $in: centroIds } })
      .select('-documentos.contenido')
      .populate('tipo_id')
      .sort({ fecha: 1 })
      .lean();
  }

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
      .select('-documentos.contenido')
      .populate('tipo_id')
      .sort({ fecha: 1 })
      .lean();
  }

  async findOne(id: string) {
    const m = await this.mantencionModel.findById(id).select('-documentos.contenido').populate('tipo_id').lean();
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

      const centroObjId = new Types.ObjectId(centroCostoId);

      // Usuarios del centro asignados + admin_cliente de la empresa
      const usuariosCentro = await this.usuarioModel
        .find({
          cliente_id: new Types.ObjectId(String(centro.cliente_id)),
          activo: true,
          $or: [
            { rol: 'admin_cliente' },
            { centros_asignados: centroObjId },
          ],
        })
        .select('nombre email')
        .lean();

      // Super admins del sistema
      const superAdmins = await this.usuarioModel
        .find({ rol: 'super_admin', activo: true })
        .select('nombre email')
        .lean();

      // Unir sin duplicados por email
      const emailsVistos = new Set<string>();
      const destinatarios: { nombre: string; email: string }[] = [];
      for (const u of [...usuariosCentro, ...superAdmins]) {
        if (u.email && !emailsVistos.has(u.email)) {
          emailsVistos.add(u.email);
          destinatarios.push({ nombre: u.nombre, email: u.email });
        }
      }

      if (destinatarios.length === 0) return;

      // Nombres de los activos incluidos en la mantención
      const activoIds = (m.activo_ids as Types.ObjectId[] | undefined) ?? [];
      const activosDoc = activoIds.length > 0
        ? await this.activoModel.find({ _id: { $in: activoIds } }).select('nombre').lean()
        : [];
      const activosNombres = activosDoc.map(a => a.nombre);

      const tipo = m.tipo_id as Record<string, unknown> | null;

      this.logger.log(`Notificación mantención: centro=${centroCostoId} destinatarios=${destinatarios.length} activos=${activosNombres.length}`);

      await this.mailService.notificarNuevaMantencion({
        destinatarios,
        mantencion: {
          nombre:      String(m.nombre ?? ''),
          tipo:        String(tipo?.nombre ?? 'Sin tipo'),
          fecha:       m.fecha as Date,
          descripcion: m.descripcion ? String(m.descripcion) : undefined,
          centro:      String(centro.nombre),
          activos:     activosNombres,
        },
      });
      this.logger.log(`Correos de mantención enviados a ${destinatarios.length} destinatario(s)`);
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

  async subirDocumento(
    id: string,
    archivo: { originalname: string; buffer: Buffer; mimetype: string; size: number },
    nombreDisplay?: string,
  ) {
    const m = await this.mantencionModel.findById(id).lean();
    if (!m) throw new NotFoundException(`Mantención ${id} no encontrada`);

    const timestamp = Date.now();
    const rand = Math.random().toString(36).substring(7);
    const nombre = `${timestamp}_${rand}_${archivo.originalname}`;

    const docEntry = {
      nombre,
      nombre_display: nombreDisplay?.trim() || archivo.originalname,
      tamano_bytes:   archivo.size,
      tipo_mime:      archivo.mimetype,
      contenido:      archivo.buffer,
    };

    return this.mantencionModel
      .findByIdAndUpdate(id, { $push: { documentos: docEntry } }, { new: true })
      .select('-documentos.contenido')
      .populate('tipo_id')
      .lean();
  }

  async eliminarDocumento(id: string, nombre: string) {
    const m = await this.mantencionModel.findById(id).lean();
    if (!m) throw new NotFoundException(`Mantención ${id} no encontrada`);

    return this.mantencionModel
      .findByIdAndUpdate(id, { $pull: { documentos: { nombre } } }, { new: true })
      .select('-documentos.contenido')
      .populate('tipo_id')
      .lean();
  }

  async servirDocumento(id: string, nombre: string): Promise<{ buffer: Buffer; tipo_mime: string; nombre_display: string }> {
    // No usar .lean() aquí — los campos Buffer de MongoDB se deserializan como
    // BSON Binary con .lean(), pero como Buffer nativo sin él.
    const m = await this.mantencionModel.findById(id);
    if (!m) throw new NotFoundException(`Mantención ${id} no encontrada`);

    const doc = m.documentos.find(d => d.nombre === nombre);
    if (!doc) throw new NotFoundException(`Documento ${nombre} no encontrado`);

    // Garantizar Buffer nativo aunque el driver devuelva Uint8Array o BSON Binary
    const raw = doc.contenido as unknown;
    const buffer = Buffer.isBuffer(raw)
      ? raw
      : Buffer.from(raw as ArrayBuffer);

    return { buffer, tipo_mime: doc.tipo_mime, nombre_display: doc.nombre_display };
  }
}
