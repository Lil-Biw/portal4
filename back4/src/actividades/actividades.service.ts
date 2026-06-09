import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ActividadDocument } from './actividades.schema';
import { CentroCostoDocument } from '../centros-costos/centros-costos.schema';
import { CreateActividadDto, UpdateActividadDto } from './actividades.dto';
import { MailService } from '../mail/mail.service';
import { NotificacionOpcionesDto } from '../common/dto/notificacion-opciones.dto';

@Injectable()
export class ActividadesService {
  private readonly logger = new Logger(ActividadesService.name);

  constructor(
    @InjectModel('Actividad') private actividadModel: Model<ActividadDocument>,
    @InjectModel('CentroCosto') private centroCostoModel: Model<CentroCostoDocument>,
    @InjectModel('Usuario') private usuarioModel: Model<{ nombre: string; email: string; rol: string; cliente_id: Types.ObjectId; centros_asignados: Types.ObjectId[]; activo: boolean }>,
    @InjectModel('Activo') private activoModel: Model<{ nombre: string }>,
    private mailService: MailService,
  ) {}

  async findAllByEmpresa(empresaId: string, centroCostoId?: string, desde?: string, hasta?: string) {
    const centros = await this.centroCostoModel
      .find({ cliente_id: new Types.ObjectId(empresaId), activo: true })
      .select('_id')
      .lean();
    const centroIds = centros.map(c => c._id);
    const filter: Record<string, unknown> = { centro_costo_id: { $in: centroIds } };
    if (centroCostoId) {
      filter['centro_costo_id'] = {
        $in: [
          ...centroIds,
          new Types.ObjectId(centroCostoId),
          centroCostoId,
        ],
      };
    }
    if (desde || hasta) {
      filter['fecha'] = {};
      if (desde) (filter['fecha'] as Record<string, Date>)['$gte'] = new Date(desde);
      if (hasta) (filter['fecha'] as Record<string, Date>)['$lte'] = new Date(hasta);
    }
    return this.actividadModel
      .find(filter)
      .select('-documentos.contenido')
      .populate('tipo_id')
      .populate('activo_ids')
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
    return this.actividadModel
      .find(filter)
      .select('-documentos.contenido')
      .populate('tipo_id')
      .populate('activo_ids')
      .sort({ fecha: 1 })
      .lean();
  }

  async findOne(id: string) {
    const a = await this.actividadModel.findById(id).select('-documentos.contenido').populate('tipo_id').lean();
    if (!a) throw new NotFoundException(`Actividad ${id} no encontrada`);
    return a;
  }

  async create(dto: CreateActividadDto) {
    const { notificacion, ...actividadData } = dto;
    const a = await new this.actividadModel({
      ...actividadData,
      tipo_id: new Types.ObjectId(actividadData.tipo_id),
      centro_costo_id: new Types.ObjectId(actividadData.centro_costo_id),
      activo_ids: (actividadData.activo_ids ?? []).map(id => new Types.ObjectId(id)),
      fecha: new Date(actividadData.fecha),
    }).save();

    const result = await this.actividadModel.findById(a._id).populate('tipo_id').lean();

    if (actividadData.centro_costo_id) {
      await this.notificarUsuariosCentro(actividadData.centro_costo_id, result!, notificacion);
    }

    return result;
  }

  private async notificarUsuariosCentro(
    centroCostoId: string | undefined,
    a: Record<string, unknown>,
    notificacion?: NotificacionOpcionesDto,
  ) {
    const opciones = notificacion ?? { notificar: true, audiencia: 'todos' };
    if (!opciones.notificar) return;

    try {
      const centro = await this.centroCostoModel.findById(centroCostoId).lean();
      if (!centro) {
        this.logger.warn(`notificarUsuariosCentro: centro ${centroCostoId} no encontrado, se omite notificación`);
        return;
      }

      const centroObjId = new Types.ObjectId(String(centroCostoId));
      const empresaId = new Types.ObjectId(String(centro.cliente_id));

      let usuariosCentro: { nombre: string; email: string }[] = [];

      if (opciones.audiencia === 'especificos') {
        usuariosCentro = await this.usuarioModel
          .find({
            _id: { $in: (opciones.destinatarios_ids ?? []).map(id => new Types.ObjectId(id)) },
            cliente_id: empresaId,
            activo: true,
          })
          .select('nombre email')
          .lean();
      } else {
        // audiencia 'todos' o undefined → todos los usuarios del centro + admin_smartclarity
        usuariosCentro = await this.usuarioModel
          .find({
            cliente_id: empresaId,
            activo: true,
            $or: [{ rol: 'admin_smartclarity' }, { centros_asignados: centroObjId }],
          })
          .select('nombre email')
          .lean();
      }

      const superAdmins = await this.usuarioModel
        .find({ rol: 'super_admin', activo: true })
        .select('nombre email')
        .lean();

      const emailsVistos = new Set<string>();
      const destinatarios: { nombre: string; email: string }[] = [];
      for (const u of [...usuariosCentro, ...superAdmins]) {
        if (u.email && !emailsVistos.has(u.email)) {
          emailsVistos.add(u.email);
          destinatarios.push({ nombre: u.nombre, email: u.email });
        }
      }

      if (destinatarios.length === 0) return;

      const activoIds = (a.activo_ids as Types.ObjectId[] | undefined) ?? [];
      const activosDoc = activoIds.length > 0
        ? await this.activoModel.find({ _id: { $in: activoIds } }).select('nombre').lean()
        : [];
      const activosNombres = activosDoc.map(ac => ac.nombre);
      const tipo = a.tipo_id as Record<string, unknown> | null;

      this.logger.log(`Notificación actividad: centro=${centroCostoId} destinatarios=${destinatarios.length}`);

      await this.mailService.notificarNuevaActividad({
        destinatarios,
        actividad: {
          nombre:      String(a.nombre ?? ''),
          tipo:        String(tipo?.nombre ?? 'Sin tipo'),
          fecha:       a.fecha as Date,
          descripcion: a.descripcion ? String(a.descripcion) : undefined,
          centro:      String(centro.nombre),
          activos:     activosNombres,
        },
      });

      this.logger.log(`Correos de actividad enviados a ${destinatarios.length} destinatario(s)`);
    } catch (err: unknown) {
      this.logger.error('Error al notificar actividad:', err);
    }
  }

  async update(id: string, dto: UpdateActividadDto) {
    const { notificacion: _n, ...updateData } = dto;
    const payload: Record<string, unknown> = { ...updateData };
    if (dto.tipo_id) payload['tipo_id'] = new Types.ObjectId(dto.tipo_id);
    if (dto.centro_costo_id) payload['centro_costo_id'] = new Types.ObjectId(dto.centro_costo_id);
    if (dto.fecha) payload['fecha'] = new Date(dto.fecha);
    if (dto.activo_ids !== undefined) {
      payload['activo_ids'] = dto.activo_ids.map(aid => new Types.ObjectId(aid));
    }

    const a = await this.actividadModel
      .findByIdAndUpdate(id, payload, { new: true })
      .populate('tipo_id')
      .lean();
    if (!a) throw new NotFoundException(`Actividad ${id} no encontrada`);
    return a;
  }

  async remove(id: string) {
    const a = await this.actividadModel.findByIdAndDelete(id).lean();
    if (!a) throw new NotFoundException(`Actividad ${id} no encontrada`);
    return { message: 'Actividad eliminada', id };
  }

  async subirDocumento(
    id: string,
    archivo: { originalname: string; buffer: Buffer; mimetype: string; size: number },
    nombreDisplay?: string,
  ) {
    const a = await this.actividadModel.findById(id).lean();
    if (!a) throw new NotFoundException(`Actividad ${id} no encontrada`);

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

    return this.actividadModel
      .findByIdAndUpdate(id, { $push: { documentos: docEntry } }, { new: true })
      .select('-documentos.contenido')
      .populate('tipo_id')
      .lean();
  }

  async eliminarDocumento(id: string, nombre: string) {
    const a = await this.actividadModel.findById(id).lean();
    if (!a) throw new NotFoundException(`Actividad ${id} no encontrada`);

    return this.actividadModel
      .findByIdAndUpdate(id, { $pull: { documentos: { nombre } } }, { new: true })
      .select('-documentos.contenido')
      .populate('tipo_id')
      .lean();
  }

  async servirDocumento(id: string, nombre: string): Promise<{ buffer: Buffer; tipo_mime: string; nombre_display: string }> {
    // No usar .lean() aquí — los campos Buffer de MongoDB se deserializan como
    // BSON Binary con .lean(), pero como Buffer nativo sin él.
    const a = await this.actividadModel.findById(id);
    if (!a) throw new NotFoundException(`Actividad ${id} no encontrada`);

    const doc = a.documentos.find(d => d.nombre === nombre);
    if (!doc) throw new NotFoundException(`Documento ${nombre} no encontrado`);

    const raw = doc.contenido as unknown;
    const buffer = Buffer.isBuffer(raw)
      ? raw
      : Buffer.from(raw as ArrayBuffer);

    return { buffer, tipo_mime: doc.tipo_mime, nombre_display: doc.nombre_display };
  }
}
