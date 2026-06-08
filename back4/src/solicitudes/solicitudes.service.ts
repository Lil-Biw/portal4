import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SolicitudDocument } from './solicitudes.schema';
import { CentroCostoDocument } from '../centros-costos/centros-costos.schema';
import { CreateSolicitudDto, UpdateSolicitudDto, CambiarEstadoDto } from './solicitudes.dto';
import { MailService } from '../mail/mail.service';
import { NotificacionOpcionesDto } from '../common/dto/notificacion-opciones.dto';

@Injectable()
export class SolicitudesService {
  private readonly logger = new Logger(SolicitudesService.name);

  constructor(
    @InjectModel('Solicitud') private solicitudModel: Model<SolicitudDocument>,
    @InjectModel('CentroCosto') private centroCostoModel: Model<CentroCostoDocument>,
    @InjectModel('Usuario') private usuarioModel: Model<{ nombre: string; email: string; rol: string; cliente_id: Types.ObjectId; centros_asignados: Types.ObjectId[]; activo: boolean }>,
    private mailService: MailService,
  ) {}

  async create(dto: CreateSolicitudDto) {
    const doc: Record<string, unknown> = {
      ...dto,
      empresa_id: new Types.ObjectId(dto.empresa_id!),
    };
    if (dto.centro_costo_id) doc['centro_costo_id'] = new Types.ObjectId(dto.centro_costo_id);
    if (dto.proyecto_id)     doc['proyecto_id']     = new Types.ObjectId(dto.proyecto_id);
    const saved = await new this.solicitudModel(doc).save();
    if (dto.centro_costo_id) await this.notificarUsuariosCentro(dto.centro_costo_id, dto, dto.notificacion);
    return saved;
  }

  private async notificarUsuariosCentro(
    centroCostoId: string,
    dto: CreateSolicitudDto,
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

      const centroObjId = new Types.ObjectId(centroCostoId);
      const empresaId = new Types.ObjectId(String(centro.cliente_id));

      let usuariosCentro: { nombre: string; email: string }[] = [];

      if (opciones.audiencia === 'especificos') {
        const especificos = await this.usuarioModel
          .find({
            _id: { $in: (opciones.destinatarios_ids ?? []).map(id => new Types.ObjectId(id)) },
            cliente_id: empresaId,
            activo: true,
          })
          .select('nombre email')
          .lean();
        const admins = await this.usuarioModel
          .find({ cliente_id: empresaId, rol: 'admin_cliente', activo: true })
          .select('nombre email')
          .lean();
        usuariosCentro = [...especificos, ...admins];
      } else {
        // audiencia 'todos' o undefined → todos los usuarios del centro + admin_cliente
        usuariosCentro = await this.usuarioModel
          .find({
            cliente_id: empresaId,
            activo: true,
            $or: [{ rol: 'admin_cliente' }, { centros_asignados: centroObjId }],
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

      this.logger.log(`Notificación solicitud: centro=${centroCostoId} destinatarios=${destinatarios.length}`);

      await this.mailService.notificarNuevaSolicitud({
        destinatarios,
        solicitud: {
          nombre:      dto.nombre,
          tipo:        dto.tipo,
          descripcion: dto.descripcion,
          centro:      String(centro.nombre),
        },
      });
    } catch (err: unknown) {
      this.logger.error('Error al notificar solicitud:', err);
    }
  }

  async findByContexto(empresaId: string, centroId?: string, proyectoId?: string, estado?: string) {
    const filter: Record<string, unknown> = { empresa_id: new Types.ObjectId(empresaId) };
    if (centroId)   filter['centro_costo_id'] = new Types.ObjectId(centroId);
    if (proyectoId) filter['proyecto_id']     = new Types.ObjectId(proyectoId);
    if (estado)     filter['estado']          = estado;
    return this.solicitudModel.find(filter).select('-adjunto.contenido').sort({ creado_en: -1 }).lean();
  }

  async update(id: string, dto: UpdateSolicitudDto) {
    const solicitud = await this.solicitudModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .select('-adjunto.contenido')
      .lean();
    if (!solicitud) throw new NotFoundException(`Solicitud ${id} no encontrada`);
    return solicitud;
  }

  async remove(id: string) {
    const solicitud = await this.solicitudModel.findById(id).lean();
    if (!solicitud) throw new NotFoundException(`Solicitud ${id} no encontrada`);
    await this.solicitudModel.findByIdAndDelete(id);
    return { deleted: true };
  }

  async cambiarEstado(id: string, dto: CambiarEstadoDto) {
    const update: Record<string, unknown> = { estado: dto.estado };
    if (dto.estado === 'rechazado') {
      update['motivo_rechazo'] = dto.motivo_rechazo?.trim() ?? '';
    } else {
      update['motivo_rechazo'] = '';
    }
    const solicitud = await this.solicitudModel
      .findByIdAndUpdate(id, update, { new: true })
      .lean();
    if (!solicitud) throw new NotFoundException(`Solicitud ${id} no encontrada`);
    if (dto.estado === 'rechazado' && solicitud.empresa_id) {
      await this.notificarRechazoSolicitud(solicitud, dto.notificacion);
    }
    return solicitud;
  }

  private async notificarRechazoSolicitud(
    solicitud: Record<string, unknown>,
    notificacion?: NotificacionOpcionesDto,
  ) {
    const opciones = notificacion ?? { notificar: true, audiencia: 'todos' };
    if (!opciones.notificar) return;

    try {
      const empresaId = String(solicitud['empresa_id']);
      const centro = solicitud['centro_costo_id']
        ? await this.centroCostoModel.findById(String(solicitud['centro_costo_id'])).lean()
        : null;
      const centroObjId = centro ? new Types.ObjectId(String(solicitud['centro_costo_id'])) : null;

      let usuariosEmpresa: { nombre: string; email: string }[] = [];

      if (opciones.audiencia === 'especificos') {
        const especificos = await this.usuarioModel
          .find({
            _id: { $in: (opciones.destinatarios_ids ?? []).map(id => new Types.ObjectId(id)) },
            cliente_id: new Types.ObjectId(empresaId),
            activo: true,
          })
          .select('nombre email')
          .lean();
        const admins = await this.usuarioModel
          .find({ cliente_id: new Types.ObjectId(empresaId), rol: 'admin_cliente', activo: true })
          .select('nombre email')
          .lean();
        usuariosEmpresa = [...especificos, ...admins];
      } else {
        // audiencia 'todos' o undefined → usuarios del centro + admin_cliente
        usuariosEmpresa = await this.usuarioModel
          .find({
            cliente_id: new Types.ObjectId(empresaId),
            activo: true,
            $or: centroObjId
              ? [{ rol: 'admin_cliente' }, { centros_asignados: centroObjId }]
              : [{ rol: 'admin_cliente' }],
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
      for (const u of [...usuariosEmpresa, ...superAdmins]) {
        if (u.email && !emailsVistos.has(u.email)) {
          emailsVistos.add(u.email);
          destinatarios.push({ nombre: u.nombre, email: u.email });
        }
      }

      if (destinatarios.length === 0) return;

      await this.mailService.notificarRechazoSolicitud({
        destinatarios,
        solicitud: {
          nombre:         String(solicitud['nombre']),
          tipo:           String(solicitud['tipo']),
          motivo_rechazo: String(solicitud['motivo_rechazo'] ?? ''),
          centro:         centro ? String(centro.nombre) : 'Empresa',
        },
      });
    } catch (err: unknown) {
      this.logger.error('Error al notificar rechazo de solicitud:', err);
    }
  }

  async adjuntarArchivo(id: string, archivo: { originalname: string; buffer: Buffer; mimetype: string }) {
    const solicitud = await this.solicitudModel.findById(id).lean();
    if (!solicitud) throw new NotFoundException(`Solicitud ${id} no encontrada`);
    if (!['pendiente', 'rechazado', 'vencido'].includes(solicitud.estado)) {
      throw new BadRequestException(`No se puede adjuntar un archivo a una solicitud en estado "${solicitud.estado}"`);
    }
    const TIPOS_PERMITIDOS = [
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (!TIPOS_PERMITIDOS.includes(archivo.mimetype)) {
      throw new BadRequestException('Tipo de archivo no permitido. Se aceptan PDF, imágenes, Word y Excel.');
    }
    return this.solicitudModel
      .findByIdAndUpdate(
        id,
        {
          adjunto: { contenido: archivo.buffer, tipo_mime: archivo.mimetype, nombre: archivo.originalname },
          estado: 'revision',
        },
        { new: true },
      )
      .select('-adjunto.contenido')
      .lean();
  }

  async servirAdjunto(id: string): Promise<{ buffer: Buffer; tipo_mime: string; nombre: string }> {
    const solicitud = await this.solicitudModel.findById(id);
    if (!solicitud) throw new NotFoundException(`Solicitud ${id} no encontrada`);
    if (!solicitud.adjunto?.contenido) throw new NotFoundException('Esta solicitud no tiene adjunto');
    const raw = solicitud.adjunto.contenido as unknown;
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
    return { buffer, tipo_mime: solicitud.adjunto.tipo_mime, nombre: solicitud.adjunto.nombre };
  }
}
