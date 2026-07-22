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
import { DocumentosHelper, ArchivoInput, DocumentoInput, sanitizarNombreArchivo, esUrlValida } from '../common/helpers/documentos.helper';
import { notificarSolicitudCompletada, ScopeDocumento, condicionSuscripcionAdmin } from '../common/helpers/notificar-documento.helper';
import { ContextoJerarquico } from '../mail/templates/jerarquia';
import { S3Service } from '../common/s3/s3.service';

interface UsuarioConSuscripciones {
  nombre: string;
  email: string;
  rol: string;
  cliente_id: Types.ObjectId;
  centros_asignados: Types.ObjectId[];
  activo: boolean;
  notificar_todas_empresas?: boolean;
  empresas_suscritas?: Types.ObjectId[];
  centros_suscritos?: Types.ObjectId[];
  proyectos_suscritos?: Types.ObjectId[];
}

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
    @InjectModel('Usuario') private usuarioModel: Model<UsuarioConSuscripciones>,
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

      const [empresa, centro, proyecto] = await Promise.all([
        this.clienteModel.findById(empresaId).select('razon_social').lean(),
        centroCostoId ? this.centroCostoModel.findById(centroCostoId).select('nombre').lean() : Promise.resolve(null),
        dto.proyecto_id ? this.proyectoModel.findById(dto.proyecto_id).select('nombre').lean() : Promise.resolve(null),
      ]);

      let centroObjId: Types.ObjectId | null = null;
      if (centroCostoId) {
        if (!centro) {
          this.logger.warn(`notificarNuevaSolicitud: centro ${centroCostoId} no encontrado`);
        } else {
          centroObjId = new Types.ObjectId(centroCostoId);
        }
      }
      const proyectoObjId = dto.proyecto_id && proyecto ? new Types.ObjectId(dto.proyecto_id) : undefined;

      const empresaNombre = empresa ? String(empresa.razon_social) : 'Empresa';
      const jerarquia: ContextoJerarquico = {
        empresa:  empresaNombre,
        centro:   centro ? String(centro.nombre) : undefined,
        proyecto: proyecto ? String(proyecto.nombre) : undefined,
      };

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
        // audiencia 'todos' → admin_smartclarity suscritos (globales) + usuarios del centro o de la empresa
        const orConditions: object[] = [
          { rol: 'admin_smartclarity', $or: condicionSuscripcionAdmin({ empresaId, centroId: centroObjId ?? undefined, proyectoId: proyectoObjId }) },
        ];
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
          jerarquia,
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
    const solicitudes = await this.solicitudModel.find(filter).select('-adjunto.contenido').sort({ creado_en: -1 }).lean();
    return this.conSubidoPorNombre(solicitudes);
  }

  // El adjunto de una solicitud es un sub-documento embebido (no una colección
  // doc_* aparte), así que resolverSubidoPorNombre (pensado para subido_por a
  // nivel raíz) no aplica directo — el campo vive en adjunto.subido_por.
  private async conSubidoPorNombre(solicitudes: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
    const ids = [...new Set(
      solicitudes
        .map(s => (s['adjunto'] as { subido_por?: unknown } | undefined)?.subido_por)
        .filter(Boolean)
        .map(String)
    )];
    if (!ids.length) return solicitudes;

    const usuarios = await this.usuarioModel.find({ _id: { $in: ids } }).select('nombre').lean();
    const nombreMap = new Map(usuarios.map(u => [String((u as any)._id), (u as any).nombre]));

    return solicitudes.map(s => {
      const adjunto = s['adjunto'] as Record<string, unknown> | undefined;
      const nombre = adjunto?.['subido_por'] ? nombreMap.get(String(adjunto['subido_por'])) : undefined;
      if (!nombre) return s;
      return { ...s, adjunto: { ...adjunto, subido_por_nombre: nombre } };
    });
  }

  async update(id: string, empresaId: string, dto: UpdateSolicitudDto) {
    const solicitud = await this.solicitudModel
      .findOneAndUpdate({ _id: id, empresa_id: new Types.ObjectId(empresaId) }, { $set: dto }, { new: true })
      .select('-adjunto.contenido')
      .lean();
    if (!solicitud) throw new NotFoundException(`Solicitud ${id} no encontrada`);
    return solicitud;
  }

  async remove(id: string, empresaId: string) {
    const filtro = { _id: id, empresa_id: new Types.ObjectId(empresaId) };
    const solicitud = await this.solicitudModel.findOne(filtro).lean();
    if (!solicitud) throw new NotFoundException(`Solicitud ${id} no encontrada`);
    await this.solicitudModel.deleteOne(filtro);
    return { deleted: true };
  }

  async cambiarEstado(id: string, empresaId: string, dto: CambiarEstadoDto, usuarioRespondeId?: string) {
    const filtro = { _id: id, empresa_id: new Types.ObjectId(empresaId) };
    const estadoPrevio = await this.solicitudModel.findOne(filtro).select('estado').lean();
    if (!estadoPrevio) throw new NotFoundException(`Solicitud ${id} no encontrada`);

    const update: Record<string, unknown> = { estado: dto.estado };
    if (dto.estado === 'rechazado') {
      update['motivo_rechazo'] = dto.motivo_rechazo?.trim() ?? '';
    } else {
      update['motivo_rechazo'] = '';
    }
    const solicitud = await this.solicitudModel
      .findOneAndUpdate(filtro, update, { new: true })
      .lean();
    if (!solicitud) throw new NotFoundException(`Solicitud ${id} no encontrada`);
    if (dto.estado === 'rechazado' && solicitud.empresa_id) {
      await this.notificarRechazoSolicitud(solicitud, dto.notificacion);
    }
    if (dto.estado === 'aprobado' && estadoPrevio.estado !== 'aprobado') {
      const solFull = await this.solicitudModel.findById(id);
      if (solFull?.adjunto?.s3_key || solFull?.adjunto?.contenido || solFull?.adjunto?.link_url) {
        await this.crearDocumentoDesde(solFull).catch(err =>
          this.logger.error('Error al crear documento desde solicitud aprobada:', err)
        );
      }
    }
    if (usuarioRespondeId && ['aprobado', 'rechazado'].includes(dto.estado)) {
      await this.suscribirPorRespuesta(usuarioRespondeId, solicitud).catch(err =>
        this.logger.error('Error al auto-suscribir por respuesta de solicitud:', err)
      );
    }
    return solicitud;
  }

  // Un admin que aprueba o rechaza una solicitud queda suscrito automáticamente
  // al ámbito más específico de esa solicitud (proyecto > centro > empresa),
  // para seguir recibiendo notificaciones de esa misma línea sin configurarlo
  // a mano. Solo aplica a admin_smartclarity/super_admin (ver usuarioEstaSuscrito
  // en el frontend, que documenta la misma regla).
  private async suscribirPorRespuesta(
    usuarioId: string,
    solicitud: Record<string, unknown>,
  ): Promise<void> {
    const usuario = await this.usuarioModel.findById(usuarioId).select('rol').lean();
    if (!usuario || !['admin_smartclarity', 'super_admin'].includes(usuario.rol)) return;

    let campo: 'proyectos_suscritos' | 'centros_suscritos' | 'empresas_suscritas';
    let valor: unknown;
    if (solicitud['proyecto_id']) {
      campo = 'proyectos_suscritos';
      valor = solicitud['proyecto_id'];
    } else if (solicitud['centro_costo_id']) {
      campo = 'centros_suscritos';
      valor = solicitud['centro_costo_id'];
    } else if (solicitud['empresa_id']) {
      campo = 'empresas_suscritas';
      valor = solicitud['empresa_id'];
    } else {
      return;
    }

    await this.usuarioModel.updateOne({ _id: usuarioId }, { $addToSet: { [campo]: valor } });
  }

  private async crearDocumentoDesde(sol: SolicitudDocument): Promise<void> {
    // Conserva quién subió el adjunto original: el documento resultante debe
    // mostrar el mismo tag "subido por" que tenía en la solicitud.
    const subidoPor = sol.adjunto?.subido_por ? String(sol.adjunto.subido_por) : undefined;

    if (sol.adjunto?.tipo_contenido === 'link' && sol.adjunto.link_url) {
      const input: DocumentoInput = { linkUrl: sol.adjunto.link_url };
      if (sol.proyecto_id) {
        await this.docsProyecto.agregar(String(sol.proyecto_id), input, sol.nombre, sol.tipo, subidoPor);
      } else if (sol.centro_costo_id) {
        await this.docsCentro.agregar(String(sol.centro_costo_id), input, sol.nombre, sol.tipo, subidoPor);
      } else {
        await this.docsEmpresa.agregar(String(sol.empresa_id), input, sol.nombre, sol.tipo, subidoPor);
      }
      return;
    }

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
      await this.docsProyecto.agregar(String(sol.proyecto_id), { archivo }, sol.nombre, sol.tipo, subidoPor);
    } else if (sol.centro_costo_id) {
      await this.docsCentro.agregar(String(sol.centro_costo_id), { archivo }, sol.nombre, sol.tipo, subidoPor);
    } else {
      await this.docsEmpresa.agregar(String(sol.empresa_id), { archivo }, sol.nombre, sol.tipo, subidoPor);
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
      const [empresa, centro, proyecto] = await Promise.all([
        this.clienteModel.findById(empresaId).select('razon_social').lean(),
        solicitud['centro_costo_id']
          ? this.centroCostoModel.findById(String(solicitud['centro_costo_id'])).select('nombre').lean()
          : Promise.resolve(null),
        solicitud['proyecto_id']
          ? this.proyectoModel.findById(String(solicitud['proyecto_id'])).select('nombre').lean()
          : Promise.resolve(null),
      ]);
      const centroObjId = centro ? new Types.ObjectId(String(solicitud['centro_costo_id'])) : null;

      const empresaNombre = empresa ? String(empresa.razon_social) : 'Empresa';
      const jerarquia: ContextoJerarquico = {
        empresa:  empresaNombre,
        centro:   centro ? String(centro.nombre) : undefined,
        proyecto: proyecto ? String(proyecto.nombre) : undefined,
      };

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
        // audiencia 'todos' o undefined → usuarios del centro o de la empresa + admin_smartclarity suscritos (globales)
        const empresaObjId = new Types.ObjectId(empresaId);
        const proyectoObjId = solicitud['proyecto_id'] && proyecto ? new Types.ObjectId(String(solicitud['proyecto_id'])) : undefined;
        const orConditions: object[] = [
          { rol: 'admin_smartclarity', $or: condicionSuscripcionAdmin({ empresaId: empresaObjId, centroId: centroObjId ?? undefined, proyectoId: proyectoObjId }) },
        ];
        if (centroObjId) {
          orConditions.push({ cliente_id: empresaObjId, centros_asignados: centroObjId });
        } else {
          orConditions.push({ cliente_id: empresaObjId, rol: 'usuario' });
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
          jerarquia,
        },
      });
    } catch (err: unknown) {
      this.logger.error('Error al notificar rechazo de solicitud:', err);
    }
  }

  async adjuntar(
    id: string,
    input: DocumentoInput,
    usuarioId?: string,
    rolUploader?: string,
  ) {
    const solicitud = await this.solicitudModel.findById(id).lean();
    if (!solicitud) throw new NotFoundException(`Solicitud ${id} no encontrada`);
    if (!['pendiente', 'rechazado'].includes(solicitud.estado)) {
      throw new BadRequestException(`No se puede adjuntar un archivo a una solicitud en estado "${solicitud.estado}"`);
    }

    let nuevoS3Key: string | undefined;
    let adjuntoData: Record<string, unknown>;

    if (input.archivo) {
      const archivo = input.archivo;
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
      nuevoS3Key = `solicitudes/${id}/${timestamp}_${rand}_${sanitizarNombreArchivo(archivo.originalname)}`;
      await this.s3Service.subir(nuevoS3Key, archivo.buffer, archivo.mimetype);
      adjuntoData = { s3_key: nuevoS3Key, tipo_contenido: 'archivo', tipo_mime: archivo.mimetype, nombre: archivo.originalname };
    } else if (input.linkUrl) {
      if (!esUrlValida(input.linkUrl)) throw new BadRequestException('El link debe ser una URL http(s) válida');
      adjuntoData = { tipo_contenido: 'link', link_url: input.linkUrl, nombre: input.linkUrl };
    } else {
      throw new BadRequestException('Debes adjuntar un archivo o un link');
    }
    if (usuarioId) adjuntoData['subido_por'] = new Types.ObjectId(usuarioId);

    const keyAnterior = solicitud.adjunto?.s3_key;
    const actualizada = await this.solicitudModel
      .findByIdAndUpdate(
        id,
        { adjunto: adjuntoData, estado: 'revision' },
        { new: true },
      )
      .select('-adjunto.contenido')
      .lean();

    // El adjunto reemplazado ya no lo referencia nadie: al aprobar una solicitud
    // el documento se crea como copia bajo documentos/, nunca apunta a esta key.
    if (actualizada && keyAnterior && keyAnterior !== nuevoS3Key) {
      await this.s3Service.eliminar(keyAnterior).catch((err: unknown) =>
        this.logger.error(`No se pudo eliminar el adjunto anterior en S3 (${keyAnterior}):`, err),
      );
    }
    if (actualizada && rolUploader === 'usuario') {
      this.notificarSolicitudCompletadaEvento(actualizada, usuarioId).catch((err: unknown) =>
        this.logger.error('Error al notificar solicitud completada:', err),
      );
    }
    if (!actualizada) return actualizada;
    const [conNombre] = await this.conSubidoPorNombre([actualizada]);
    return conNombre;
  }

  private async notificarSolicitudCompletadaEvento(
    solicitud: Record<string, unknown>,
    usuarioId?: string,
  ): Promise<void> {
    const empresaId = String(solicitud['empresa_id']);
    const [empresa, centro, proyecto] = await Promise.all([
      this.clienteModel.findById(empresaId).select('razon_social').lean(),
      solicitud['centro_costo_id']
        ? this.centroCostoModel.findById(String(solicitud['centro_costo_id'])).select('nombre').lean()
        : Promise.resolve(null),
      solicitud['proyecto_id']
        ? this.proyectoModel.findById(String(solicitud['proyecto_id'])).select('nombre').lean()
        : Promise.resolve(null),
    ]);

    const jerarquia: ContextoJerarquico = {
      empresa:  empresa ? String(empresa.razon_social) : 'Empresa',
      centro:   centro ? String(centro.nombre) : undefined,
      proyecto: proyecto ? String(proyecto.nombre) : undefined,
    };

    // El adjunto se guarda en el proyecto si existe, si no en el centro, si no a nivel de empresa
    // (misma prioridad que adjuntarArchivo/docsHelper más arriba).
    const scope: ScopeDocumento = solicitud['proyecto_id']
      ? { tipo: 'proyecto', empresaId, proyectoId: String(solicitud['proyecto_id']) }
      : solicitud['centro_costo_id']
        ? { tipo: 'centro', empresaId, centroId: String(solicitud['centro_costo_id']) }
        : { tipo: 'empresa', empresaId };

    await notificarSolicitudCompletada({
      jerarquia,
      nombre: String(solicitud['nombre']),
      tipo: String(solicitud['tipo']),
      usuarioId,
      usuarioModel: this.usuarioModel as any,
      mailService: this.mailService,
      logger: this.logger,
      scope,
    });
  }

  async findEnRevisionParaAdmin(usuarioId: string, rol: string) {
    const filter: Record<string, unknown> = { estado: 'revision' };

    if (rol !== 'super_admin') {
      const usuario = await this.usuarioModel.findById(usuarioId).lean();
      if (!usuario) return [];
      if (usuario.notificar_todas_empresas === false) {
        const or: Record<string, unknown>[] = [];
        if (usuario.empresas_suscritas?.length)  or.push({ empresa_id: { $in: usuario.empresas_suscritas } });
        if (usuario.centros_suscritos?.length)   or.push({ centro_costo_id: { $in: usuario.centros_suscritos } });
        if (usuario.proyectos_suscritos?.length) or.push({ proyecto_id: { $in: usuario.proyectos_suscritos } });
        if (!or.length) return [];
        filter['$or'] = or;
      }
    }

    const solicitudes = await this.solicitudModel
      .find(filter)
      .select('-adjunto.contenido')
      .sort({ actualizado_en: -1 })
      .populate('empresa_id', 'razon_social')
      .populate('centro_costo_id', 'nombre')
      .populate('proyecto_id', 'nombre')
      .lean();
    return this.conSubidoPorNombre(solicitudes);
  }

  async servirAdjunto(id: string): Promise<{ buffer: Buffer; tipo_mime: string; nombre: string }> {
    const solicitud = await this.solicitudModel.findById(id);
    if (!solicitud) throw new NotFoundException(`Solicitud ${id} no encontrada`);
    if (!solicitud.adjunto?.s3_key && !solicitud.adjunto?.contenido && !solicitud.adjunto?.link_url) {
      throw new NotFoundException('Esta solicitud no tiene adjunto');
    }
    if (solicitud.adjunto.tipo_contenido === 'link') {
      throw new BadRequestException('Este adjunto es un link externo, no un archivo');
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
