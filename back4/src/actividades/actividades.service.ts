import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ActividadDocument } from './actividades.schema';
import { CentroCostoDocument } from '../centros-costos/centros-costos.schema';
import { CreateActividadDto, UpdateActividadDto } from './actividades.dto';
import { MailService } from '../mail/mail.service';
import { NotificacionOpcionesDto } from '../common/dto/notificacion-opciones.dto';
import { DocumentosHelper, DocumentoInput } from '../common/helpers/documentos.helper';
import { hoyUtcChile } from '../common/helpers/fechas.helper';
import { resolverAdminsSuscritos } from '../common/helpers/notificar-documento.helper';
import { S3Service } from '../common/s3/s3.service';
import { RecordatoriosService } from '../recordatorios/recordatorios.service';

@Injectable()
export class ActividadesService {
  private readonly logger = new Logger(ActividadesService.name);
  private readonly docsHelper: DocumentosHelper;

  constructor(
    @InjectModel('Actividad') private actividadModel: Model<ActividadDocument>,
    @InjectModel('CentroCosto') private centroCostoModel: Model<CentroCostoDocument>,
    @InjectModel('Usuario') private usuarioModel: Model<{ nombre: string; email: string; rol: string; cliente_id: Types.ObjectId; centros_asignados: Types.ObjectId[]; activo: boolean }>,
    @InjectModel('Activo') private activoModel: Model<{ nombre: string }>,
    @InjectModel('DocActividad') private docActividadModel: Model<any>,
    @InjectModel('DocEliminado') private docEliminadoModel: Model<any>,
    private mailService: MailService,
    private readonly s3Service: S3Service,
    private readonly recordatoriosService: RecordatoriosService,
  ) {
    this.docsHelper = new DocumentosHelper(
      actividadModel,
      docActividadModel,
      'actividad_id',
      docEliminadoModel,
      'actividad',
      'Actividad',
      s3Service,
    );
  }

  // El campo dias_recordatorio vive en la colección recordatorios (no en el
  // documento de Actividad), así que hay que adjuntarlo explícitamente en
  // cada lectura o el frontend nunca lo recibe (ver bug: el wizard de edición
  // siempre mostraba los recordatorios destildados y el guardado los borraba).
  private async adjuntarDiasRecordatorio<T extends { _id: Types.ObjectId }>(actividades: T[]): Promise<(T & { dias_recordatorio: number[] })[]> {
    const mapa = await this.recordatoriosService.obtenerDiasBatch('actividad', actividades.map(a => a._id));
    return actividades.map(a => ({ ...a, dias_recordatorio: mapa.get(String(a._id)) ?? [] }));
  }

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
    const actividades = await this.actividadModel
      .find(filter)

      .populate('tipo_id')
      .populate('activo_ids')
      .sort({ fecha: 1 })
      .lean();
    return this.adjuntarDiasRecordatorio(actividades);
  }

  async findAll(centroCostoId?: string, desde?: string, hasta?: string) {
    const filter: Record<string, unknown> = {};
    if (centroCostoId) filter['centro_costo_id'] = new Types.ObjectId(centroCostoId);
    if (desde || hasta) {
      filter['fecha'] = {};
      if (desde) (filter['fecha'] as Record<string, Date>)['$gte'] = new Date(desde);
      if (hasta) (filter['fecha'] as Record<string, Date>)['$lte'] = new Date(hasta);
    }
    const actividades = await this.actividadModel
      .find(filter)

      .populate('tipo_id')
      .populate('activo_ids')
      .sort({ fecha: 1 })
      .lean();
    return this.adjuntarDiasRecordatorio(actividades);
  }

  async findOne(id: string): Promise<any> {
    const a = await this.actividadModel.findById(id).populate('tipo_id').lean();
    if (!a) throw new NotFoundException(`Actividad ${id} no encontrada`);
    const dias_recordatorio = await this.recordatoriosService.obtenerDias('actividad', a._id);
    return { ...a, dias_recordatorio };
  }

  async findByActivo(activoId: string) {
    let oid: Types.ObjectId;
    try {
      oid = new Types.ObjectId(activoId);
    } catch {
      return [];
    }
    const actividades = await this.actividadModel
      .find({ activo_ids: oid })

      .populate('tipo_id')
      .sort({ fecha: -1 })
      .lean();
    return this.adjuntarDiasRecordatorio(actividades);
  }

  async findByActivoForEmpresa(activoId: string, empresaId: string) {
    let oid: Types.ObjectId;
    try {
      oid = new Types.ObjectId(activoId);
    } catch {
      return [];
    }
    const centros = await this.centroCostoModel
      .find({ cliente_id: new Types.ObjectId(empresaId), activo: true })
      .select('_id')
      .lean();
    const centroIds = centros.map(c => c._id);
    const actividades = await this.actividadModel
      .find({ activo_ids: oid, centro_costo_id: { $in: centroIds } })

      .populate('tipo_id')
      .sort({ fecha: -1 })
      .lean();
    return this.adjuntarDiasRecordatorio(actividades);
  }

  async create(dto: CreateActividadDto): Promise<any> {
    const { notificacion, documentos_nombres, ...actividadData } = dto;
    const a = await new this.actividadModel({
      ...actividadData,
      tipo_id: new Types.ObjectId(actividadData.tipo_id),
      centro_costo_id: new Types.ObjectId(actividadData.centro_costo_id),
      activo_ids: (actividadData.activo_ids ?? []).map(id => new Types.ObjectId(id)),
      fecha: new Date(actividadData.fecha),
      fecha_termino: actividadData.fecha_termino ? new Date(actividadData.fecha_termino) : undefined,
    }).save();

    const result = await this.actividadModel.findById(a._id).populate('tipo_id').lean();

    const dias_recordatorio = actividadData.dias_recordatorio ?? [];
    await this.recordatoriosService.sincronizar(
      'actividad', a._id, dias_recordatorio, a.fecha_termino ?? a.fecha,
    );

    if (actividadData.centro_costo_id) {
      await this.notificarUsuariosCentro(actividadData.centro_costo_id, result!, notificacion, documentos_nombres);
    }

    return { ...result, dias_recordatorio };
  }

  private async notificarUsuariosCentro(
    centroCostoId: string | undefined,
    a: Record<string, unknown>,
    notificacion?: NotificacionOpcionesDto,
    documentosNombres?: string[],
  ) {
    const opciones = notificacion ?? { notificar: true, audiencia: 'todos' };
    if (!opciones.notificar) return;

    try {
      const centro = await this.centroCostoModel
        .findById(centroCostoId)
        .populate('cliente_id', 'razon_social')
        .lean() as any;
      if (!centro) {
        this.logger.warn(`notificarUsuariosCentro: centro ${centroCostoId} no encontrado, se omite notificación`);
        return;
      }

      const centroObjId = new Types.ObjectId(String(centroCostoId));
      const empresaId = new Types.ObjectId(String(centro.cliente_id?._id ?? centro.cliente_id));
      const empresaNombre = centro.cliente_id?.razon_social ?? 'Empresa';

      let usuariosCentro: { nombre: string; email: string }[] = [];

      if (opciones.audiencia === 'especificos') {
        // Los admin_smartclarity son globales (sin cliente_id), no filtrar por empresa
        usuariosCentro = await this.usuarioModel
          .find({
            _id: { $in: (opciones.destinatarios_ids ?? []).map(id => new Types.ObjectId(id)) },
            activo: true,
            $or: [{ cliente_id: empresaId }, { rol: 'admin_smartclarity' }],
          })
          .select('nombre email')
          .lean();
      } else {
        // audiencia 'todos' o undefined → usuarios del centro + admin_smartclarity (globales)
        usuariosCentro = await this.usuarioModel
          .find({
            activo: true,
            $or: [
              { rol: 'admin_smartclarity' },
              { cliente_id: empresaId, centros_asignados: centroObjId },
            ],
          })
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
          hora:        a.hora ? String(a.hora) : undefined,
          hora_termino: a.hora_termino ? String(a.hora_termino) : undefined,
          descripcion: a.descripcion ? String(a.descripcion) : undefined,
          jerarquia:   { empresa: empresaNombre, centro: centro.nombre },
          activos:     activosNombres,
          documentos:  documentosNombres ?? [],
        },
      });

      this.logger.log(`Correos de actividad enviados a ${destinatarios.length} destinatario(s)`);
    } catch (err: unknown) {
      this.logger.error('Error al notificar actividad:', err);
    }
  }

  async update(id: string, dto: UpdateActividadDto): Promise<any> {
    const { notificacion: _n, documentos_nombres: _d, ...updateData } = dto;
    const payload: Record<string, unknown> = { ...updateData };
    if (dto.tipo_id) payload['tipo_id'] = new Types.ObjectId(dto.tipo_id);
    if (dto.centro_costo_id) payload['centro_costo_id'] = new Types.ObjectId(dto.centro_costo_id);
    if (dto.fecha) payload['fecha'] = new Date(dto.fecha);
    if (dto.fecha_termino !== undefined) {
      payload['fecha_termino'] = dto.fecha_termino ? new Date(dto.fecha_termino) : null;
    }
    if (dto.activo_ids !== undefined) {
      payload['activo_ids'] = dto.activo_ids.map(aid => new Types.ObjectId(aid));
    }

    const a = await this.actividadModel
      .findByIdAndUpdate(id, payload, { new: true })
      .populate('tipo_id')
      .lean();
    if (!a) throw new NotFoundException(`Actividad ${id} no encontrada`);

    const dias = dto.dias_recordatorio ?? await this.recordatoriosService.obtenerDias('actividad', a._id);
    await this.recordatoriosService.sincronizar('actividad', a._id, dias, a.fecha_termino ?? a.fecha);

    return { ...a, dias_recordatorio: dias };
  }

  async remove(id: string) {
    const a = await this.actividadModel.findByIdAndDelete(id).lean();
    if (!a) throw new NotFoundException(`Actividad ${id} no encontrada`);
    await this.recordatoriosService.eliminar('actividad', a._id);
    return { message: 'Actividad eliminada', id };
  }

  listarDocumentos(actividadId: string) {
    return this.docsHelper.listar(actividadId);
  }

  subirDocumento(actividadId: string, input: DocumentoInput, nombreDisplay?: string) {
    return this.docsHelper.agregar(actividadId, input, nombreDisplay);
  }

  servirDocumento(actividadId: string, docId: string) {
    return this.docsHelper.servir(actividadId, docId);
  }

  eliminarDocumento(actividadId: string, docId: string) {
    return this.docsHelper.eliminar(actividadId, docId);
  }

  async enviarRecordatoriosVencimiento(): Promise<{ evaluados: number; notificados: number }> {
    const hoyUtc = hoyUtcChile();
    // Las actividades no tienen estado ni auto-cierre, así que el bucket
    // "vencidos" no dispara ninguna acción de negocio — pero su doc en
    // `recordatorios` sí hay que borrarlo, si no queda vigilado para siempre
    // (cada corrida lo reevalúa y lo descarta, sin límite de crecimiento).
    const { vencidos, porNotificar } = await this.recordatoriosService.evaluarPendientes('actividad', hoyUtc);
    if (vencidos.length) {
      await Promise.all(vencidos.map(id => this.recordatoriosService.eliminar('actividad', id)));
    }

    let notificados = 0;
    if (porNotificar.length) {
      const actividades = await this.actividadModel
        .find({ _id: { $in: porNotificar.map(p => p.entidadId) } })
        .populate({
          path: 'centro_costo_id',
          select: 'nombre cliente_id',
          populate: { path: 'cliente_id', select: 'razon_social' },
        })
        .lean() as any[];
      const porId = new Map(actividades.map(a => [String(a._id), a]));

      for (const pendiente of porNotificar) {
        const actividad = porId.get(String(pendiente.entidadId));
        if (!actividad) continue;

        const centro = actividad.centro_costo_id;
        const centroId = centro?._id ?? actividad.centro_costo_id;
        const empresaId = centro?.cliente_id?._id ?? centro?.cliente_id;
        if (!centroId || !empresaId) continue;

        // Solo admins suscritos explícitamente a la empresa o al centro: el
        // toggle notificar_todas_empresas NO aplica a recordatorios (evita que
        // todo admin reciba los avisos por el default true del campo).
        const admins = await resolverAdminsSuscritos(
          this.usuarioModel as any,
          { tipo: 'centro', empresaId: String(empresaId), centroId: String(centroId) },
          { soloSuscritos: true },
        );
        if (!admins.length) continue;

        const empresaNombre = centro?.cliente_id?.razon_social ?? 'Empresa';
        const centroNombre = centro?.nombre ?? undefined;
        const fechaRef = actividad.fecha_termino ?? actividad.fecha;
        const fechaTexto = new Date(fechaRef).toLocaleDateString('es-CL', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
        });

        const docs = await this.docActividadModel
          .find({ actividad_id: actividad._id })
          .select('nombre_display')
          .lean();

        await this.mailService.notificarActividadPorVencer({
          destinatarios: admins,
          actividad: {
            nombre: actividad.nombre,
            fecha: fechaTexto,
            diasRestantes: pendiente.diasRestantes,
            jerarquia: { empresa: empresaNombre, centro: centroNombre },
            documentos: docs.map((d: any) => String(d.nombre_display)),
          },
        });
        await this.recordatoriosService.marcarNotificado('actividad', pendiente.entidadId, pendiente.diasRestantes);
        notificados++;
      }
    }

    return { evaluados: vencidos.length + porNotificar.length, notificados };
  }
}
