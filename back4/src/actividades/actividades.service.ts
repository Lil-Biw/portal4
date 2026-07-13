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
import { S3Service } from '../common/s3/s3.service';

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

      .populate('tipo_id')
      .populate('activo_ids')
      .sort({ fecha: 1 })
      .lean();
  }

  async findOne(id: string) {
    const a = await this.actividadModel.findById(id).populate('tipo_id').lean();
    if (!a) throw new NotFoundException(`Actividad ${id} no encontrada`);
    return a;
  }

  async findByActivo(activoId: string) {
    let oid: Types.ObjectId;
    try {
      oid = new Types.ObjectId(activoId);
    } catch {
      return [];
    }
    return this.actividadModel
      .find({ activo_ids: oid })

      .populate('tipo_id')
      .sort({ fecha: -1 })
      .lean();
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
    return this.actividadModel
      .find({ activo_ids: oid, centro_costo_id: { $in: centroIds } })

      .populate('tipo_id')
      .sort({ fecha: -1 })
      .lean();
  }

  async create(dto: CreateActividadDto) {
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

    if (actividadData.centro_costo_id) {
      await this.notificarUsuariosCentro(actividadData.centro_costo_id, result!, notificacion, documentos_nombres);
    }

    return result;
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

  async update(id: string, dto: UpdateActividadDto) {
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
    return a;
  }

  async remove(id: string) {
    const a = await this.actividadModel.findByIdAndDelete(id).lean();
    if (!a) throw new NotFoundException(`Actividad ${id} no encontrada`);
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

    const actividades = await this.actividadModel
      // Solo actividades con al menos un día de aviso marcado; a diferencia de
      // proyectos aquí no hay auto-cierre, así que el resto no aporta nada.
      .find({ fecha: { $ne: null }, dias_recordatorio: { $exists: true, $ne: [] } })
      .populate({
        path: 'centro_costo_id',
        select: 'nombre cliente_id',
        populate: { path: 'cliente_id', select: 'razon_social' },
      })
      .lean() as any[];

    let notificados = 0;

    for (const actividad of actividades) {
      const fechaRef = actividad.fecha_termino ?? actividad.fecha;
      if (!fechaRef) continue;
      const fecha = new Date(fechaRef);
      const fechaUtc = Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate());
      const diasRestantes = Math.round((fechaUtc - hoyUtc) / 86_400_000);
      if (diasRestantes < 0) continue;

      // Los días de aviso los define la propia actividad (paso Notificaciones).
      // Se dispara el umbral más cercano ya cruzado (>= días restantes) que no
      // se haya notificado aún: si el cron corre dos veces el mismo día no
      // reenvía, y si un día marcado pasó sin correr (proceso caído) el aviso
      // se recupera en la siguiente corrida en vez de perderse.
      const umbralesCruzados = (actividad.dias_recordatorio ?? []).filter((d: number) => d >= diasRestantes);
      if (!umbralesCruzados.length) continue;
      const umbral = Math.min(...umbralesCruzados);
      if (umbral === actividad.ultimo_recordatorio_dias) continue;

      const centro = actividad.centro_costo_id;
      const centroId = centro?._id ?? actividad.centro_costo_id;
      const empresaId = centro?.cliente_id?._id ?? centro?.cliente_id;
      if (!centroId || !empresaId) continue;

      // Solo admins suscritos explícitamente a la empresa o al centro: el
      // toggle notificar_todas_empresas NO aplica a recordatorios (evita que
      // todo admin reciba los avisos por el default true del campo).
      const admins = await (this.usuarioModel as any)
        .find({
          rol: { $in: ['admin_smartclarity', 'super_admin'] },
          activo: true,
          $or: [
            { empresas_suscritas: empresaId },
            { centros_suscritos: centroId },
          ],
        })
        .select('nombre email')
        .lean();
      if (!admins.length) continue;

      const empresaNombre = centro?.cliente_id?.razon_social ?? 'Empresa';
      const centroNombre = centro?.nombre ?? undefined;
      const fechaTexto = fecha.toLocaleDateString('es-CL', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
      });

      const docs = await this.docActividadModel
        .find({ actividad_id: actividad._id })
        .select('nombre_display')
        .lean();

      await this.mailService.notificarActividadPorVencer({
        destinatarios: admins.map((a: any) => ({ nombre: a.nombre, email: a.email })),
        actividad: {
          nombre: actividad.nombre,
          fecha: fechaTexto,
          diasRestantes,
          jerarquia: { empresa: empresaNombre, centro: centroNombre },
          documentos: docs.map((d: any) => String(d.nombre_display)),
        },
      });
      await this.actividadModel.findByIdAndUpdate(actividad._id, { ultimo_recordatorio_dias: umbral });
      notificados++;
    }

    return { evaluados: actividades.length, notificados };
  }
}
