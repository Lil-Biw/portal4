import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SolicitudDocument } from './solicitudes.schema';
import { CentroCostoDocument } from '../centros-costos/centros-costos.schema';
import { ClienteDocument } from '../clientes/clientes.schema';
import { ProyectoDocument } from '../proyectos/proyectos.schema';
import { CreateSolicitudDto, UpdateSolicitudDto, CambiarEstadoDto } from './solicitudes.dto';
import { MailService } from '../mail/mail.service';
import { NotificacionOpcionesDto } from '../common/dto/notificacion-opciones.dto';
import { DocumentosHelper, ArchivoInput, sanitizarNombreArchivo } from '../common/helpers/documentos.helper';
import { S3Service } from '../common/s3/s3.service';

@Injectable()
export class SolicitudesService {
  private readonly logger = new Logger(SolicitudesService.name);

  private readonly docsEmpresa:  DocumentosHelper;
  private readonly docsCentro:   DocumentosHelper;
  private readonly docsProyecto: DocumentosHelper;

  constructor(
    @InjectModel('Solicitud') private solicitudModel: Model<SolicitudDocument>,
    @InjectModel('CentroCosto') private centroCostoModel: Model<CentroCostoDocument>,
    @InjectModel('Cliente') private clienteModel: Model<ClienteDocument>,
    @InjectModel('Proyecto') private proyectoModel: Model<ProyectoDocument>,
    @InjectModel('DocCentroCosto') private docCentroCostoModel: Model<any>,
    @InjectModel('DocCliente') private docClienteModel: Model<any>,
    @InjectModel('DocProyecto') private docProyectoModel: Model<any>,
    @InjectModel('DocEliminado') private docEliminadoModel: Model<any>,
    @InjectModel('Usuario') private usuarioModel: Model<{ nombre: string; email: string; rol: string; cliente_id: Types.ObjectId; centros_asignados: Types.ObjectId[]; activo: boolean }>,
    private mailService: MailService,
    private readonly s3Service: S3Service,
  ) {
    this.docsEmpresa  = new DocumentosHelper(this.clienteModel as unknown as Model<any>, this.docClienteModel, 'cliente_id', this.docEliminadoModel, 'empresa', 'Cliente', s3Service);
    this.docsCentro   = new DocumentosHelper(this.centroCostoModel as unknown as Model<any>, this.docCentroCostoModel, 'centro_costo_id', this.docEliminadoModel, 'centro', 'CentroCosto', s3Service);
    this.docsProyecto = new DocumentosHelper(this.proyectoModel as unknown as Model<any>, this.docProyectoModel, 'proyecto_id', this.docEliminadoModel, 'proyecto', 'Proyecto', s3Service);
  }

  async create(dto: CreateSolicitudDto) {
    const { notificacion, ...solicitudData } = dto;
    const doc: Record<string, unknown> = {
      ...solicitudData,
      empresa_id: new Types.ObjectId(solicitudData.empresa_id!),
    };
    if (solicitudData.centro_costo_id) doc['centro_costo_id'] = new Types.ObjectId(solicitudData.centro_costo_id);
    if (solicitudData.proyecto_id)     doc['proyecto_id']     = new Types.ObjectId(solicitudData.proyecto_id);
    const saved = await new this.solicitudModel(doc).save();
    await this.notificarNuevaSolicitud(
      solicitudData.empresa_id!,
      solicitudData.centro_costo_id,
      dto,
      notificacion,
    );
    return saved;
  }

  private async notificarNuevaSolicitud(
    empresaIdStr: string,
    centroCostoId: string | undefined,
    dto: CreateSolicitudDto,
    notificacion?: NotificacionOpcionesDto,
  ) {
    const opciones = notificacion ?? { notificar: true, audiencia: 'todos' };
    if (!opciones.notificar) return;

    try {
      const empresaId = new Types.ObjectId(empresaIdStr);

      let centroNombre = 'Empresa';
      let centroObjId: Types.ObjectId | null = null;

      if (centroCostoId) {
        const centro = await this.centroCostoModel.findById(centroCostoId).lean();
        if (!centro) {
          this.logger.warn(`notificarNuevaSolicitud: centro ${centroCostoId} no encontrado`);
        } else {
          centroNombre = String(centro.nombre);
          centroObjId = new Types.ObjectId(centroCostoId);
        }
      }

      let usuariosDestino: { nombre: string; email: string }[] = [];

      if (opciones.audiencia === 'especificos') {
        // Los admin_smartclarity son globales (sin cliente_id), no filtrar por empresa
        usuariosDestino = await this.usuarioModel
          .find({
            _id: { $in: (opciones.destinatarios_ids ?? []).map(id => new Types.ObjectId(id)) },
            activo: true,
            $or: [{ cliente_id: empresaId }, { rol: 'admin_smartclarity' }],
          })
          .select('nombre email')
          .lean();
      } else {
        // audiencia 'todos' → admin_smartclarity (globales) + usuarios del centro o de la empresa
        const orConditions: object[] = [{ rol: 'admin_smartclarity' }];
        if (centroObjId) {
          orConditions.push({ cliente_id: empresaId, centros_asignados: centroObjId });
        } else {
          orConditions.push({ cliente_id: empresaId, rol: 'usuario' });
        }
        usuariosDestino = await this.usuarioModel
          .find({ activo: true, $or: orConditions })
          .select('nombre email')
          .lean();
      }

      const superAdmins = opciones.notificar_super_admins
        ? await this.usuarioModel
            .find({ rol: 'super_admin', activo: true })
            .select('nombre email')
            .lean()
        : [];

      const emailsVistos = new Set<string>();
      const destinatarios: { nombre: string; email: string }[] = [];
      for (const u of [...usuariosDestino, ...superAdmins]) {
        if (u.email && !emailsVistos.has(u.email)) {
          emailsVistos.add(u.email);
          destinatarios.push({ nombre: u.nombre, email: u.email });
        }
      }

      if (destinatarios.length === 0) return;

      this.logger.log(`Notificación solicitud: empresa=${empresaIdStr} centro=${centroCostoId ?? 'ninguno'} destinatarios=${destinatarios.length}`);

      await this.mailService.notificarNuevaSolicitud({
        destinatarios,
        solicitud: {
          nombre:      dto.nombre,
          tipo:        dto.tipo,
          descripcion: dto.descripcion,
          centro:      centroNombre,
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
    const estadoPrevio = await this.solicitudModel.findById(id).select('estado').lean();
    if (!estadoPrevio) throw new NotFoundException(`Solicitud ${id} no encontrada`);

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
    if (dto.estado === 'aprobado' && estadoPrevio.estado !== 'aprobado') {
      const solFull = await this.solicitudModel.findById(id);
      if (solFull?.adjunto?.s3_key || solFull?.adjunto?.contenido) {
        await this.crearDocumentoDesde(solFull).catch(err =>
          this.logger.error('Error al crear documento desde solicitud aprobada:', err)
        );
      }
    }
    return solicitud;
  }

  private async crearDocumentoDesde(sol: SolicitudDocument): Promise<void> {
    if (!sol.adjunto?.s3_key && !sol.adjunto?.contenido) return;

    let buffer: Buffer;
    if (sol.adjunto.s3_key) {
      buffer = await this.s3Service.descargar(sol.adjunto.s3_key);
    } else {
      const raw = sol.adjunto.contenido as unknown;
      buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
    }

    const archivo: ArchivoInput = {
      originalname: sol.adjunto.nombre,
      buffer,
      mimetype:     sol.adjunto.tipo_mime,
      size:         buffer.length,
    };
    if (sol.proyecto_id) {
      await this.docsProyecto.agregar(String(sol.proyecto_id), archivo, sol.nombre, sol.tipo);
    } else if (sol.centro_costo_id) {
      await this.docsCentro.agregar(String(sol.centro_costo_id), archivo, sol.nombre, sol.tipo);
    } else {
      await this.docsEmpresa.agregar(String(sol.empresa_id), archivo, sol.nombre, sol.tipo);
    }
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
        // Los admin_smartclarity son globales (sin cliente_id), no filtrar por empresa
        usuariosEmpresa = await this.usuarioModel
          .find({
            _id: { $in: (opciones.destinatarios_ids ?? []).map(id => new Types.ObjectId(id)) },
            activo: true,
            $or: [{ cliente_id: new Types.ObjectId(empresaId) }, { rol: 'admin_smartclarity' }],
          })
          .select('nombre email')
          .lean();
      } else {
        // audiencia 'todos' o undefined → usuarios del centro o de la empresa + admin_smartclarity (globales)
        const orConditions: object[] = [{ rol: 'admin_smartclarity' }];
        if (centroObjId) {
          orConditions.push({ cliente_id: new Types.ObjectId(empresaId), centros_asignados: centroObjId });
        } else {
          orConditions.push({ cliente_id: new Types.ObjectId(empresaId), rol: 'usuario' });
        }
        usuariosEmpresa = await this.usuarioModel
          .find({ activo: true, $or: orConditions })
          .select('nombre email')
          .lean();
      }

      const superAdmins = opciones.notificar_super_admins
        ? await this.usuarioModel
            .find({ rol: 'super_admin', activo: true })
            .select('nombre email')
            .lean()
        : [];

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
    if (!['pendiente', 'rechazado'].includes(solicitud.estado)) {
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

    const timestamp = Date.now();
    const rand = Math.random().toString(36).substring(7);
    const s3Key = `solicitudes/${id}/${timestamp}_${rand}_${sanitizarNombreArchivo(archivo.originalname)}`;
    await this.s3Service.subir(s3Key, archivo.buffer, archivo.mimetype);

    const keyAnterior = solicitud.adjunto?.s3_key;
    const actualizada = await this.solicitudModel
      .findByIdAndUpdate(
        id,
        {
          adjunto: { s3_key: s3Key, tipo_mime: archivo.mimetype, nombre: archivo.originalname },
          estado: 'revision',
        },
        { new: true },
      )
      .select('-adjunto.contenido')
      .lean();

    // El adjunto reemplazado ya no lo referencia nadie: al aprobar una solicitud
    // el documento se crea como copia bajo documentos/, nunca apunta a esta key.
    if (actualizada && keyAnterior && keyAnterior !== s3Key) {
      await this.s3Service.eliminar(keyAnterior).catch((err: unknown) =>
        this.logger.error(`No se pudo eliminar el adjunto anterior en S3 (${keyAnterior}):`, err),
      );
    }
    return actualizada;
  }

  async servirAdjunto(id: string): Promise<{ buffer: Buffer; tipo_mime: string; nombre: string }> {
    const solicitud = await this.solicitudModel.findById(id);
    if (!solicitud) throw new NotFoundException(`Solicitud ${id} no encontrada`);
    if (!solicitud.adjunto?.s3_key && !solicitud.adjunto?.contenido) {
      throw new NotFoundException('Esta solicitud no tiene adjunto');
    }
    if (solicitud.adjunto.s3_key) {
      const buffer = await this.s3Service.descargar(solicitud.adjunto.s3_key);
      return { buffer, tipo_mime: solicitud.adjunto.tipo_mime, nombre: solicitud.adjunto.nombre };
    }
    const raw = solicitud.adjunto.contenido as unknown;
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
    return { buffer, tipo_mime: solicitud.adjunto.tipo_mime, nombre: solicitud.adjunto.nombre };
  }
}
