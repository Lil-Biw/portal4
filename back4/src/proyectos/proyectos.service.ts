import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProyectoDocument } from './proyectos.schema';
import { CreateProyectoDto, UpdateProyectoDto } from './proyectos.dto';
import { DocumentosHelper, DocumentoInput, resolverSubidoPorNombre } from '../common/helpers/documentos.helper';
import { notificarDocumentoSubido, resolverAdminsSuscritos, condicionSuscripcionAdmin } from '../common/helpers/notificar-documento.helper';
import { hoyUtcChile } from '../common/helpers/fechas.helper';
import { DocumentosVencidosService } from '../documentos-vencidos/documentos-vencidos.service';
import { MailService } from '../mail/mail.service';
import { ContextoJerarquico } from '../mail/templates/jerarquia';
import { NotificacionOpcionesDto } from '../common/dto/notificacion-opciones.dto';
import { S3Service } from '../common/s3/s3.service';
import { RecordatoriosService } from '../recordatorios/recordatorios.service';

// Estados que ya no requieren vigilancia de vencimiento (el proyecto terminó su
// ejecución) ni aparecen listados por defecto cuando se agrupa con 'eliminado'.
const ESTADOS_TERMINALES = ['cierre_pendiente', 'finalizado_facturar', 'finalizado_facturado'];

@Injectable()
export class ProyectosService {
  private readonly docsHelper: DocumentosHelper;
  private readonly logger = new Logger(ProyectosService.name);

  constructor(
    @InjectModel('Proyecto') private proyectoModel: Model<ProyectoDocument>,
    @InjectModel('DocProyecto') private docProyectoModel: Model<any>,
    @InjectModel('DocEliminado') private docEliminadoModel: Model<any>,
    @InjectModel('CentroCosto') private centroCostoModel: Model<any>,
    @InjectModel('Usuario') private readonly usuarioModel: Model<{ nombre: string; email: string; rol: string; cliente_id: Types.ObjectId; centros_asignados: Types.ObjectId[]; activo: boolean }>,
    private readonly documentosVencidosService: DocumentosVencidosService,
    private readonly mailService: MailService,
    private readonly s3Service: S3Service,
    private readonly recordatoriosService: RecordatoriosService,
  ) {
    this.docsHelper = new DocumentosHelper(
      proyectoModel,
      docProyectoModel,
      'proyecto_id',
      docEliminadoModel,
      'proyecto',
      'Proyecto',
      s3Service,
    );
  }

  private toObjectId(value: string) {
    return new Types.ObjectId(value);
  }

  // El campo dias_recordatorio vive en la colección recordatorios (no en el
  // documento de Proyecto), así que hay que adjuntarlo explícitamente en
  // cada lectura o el frontend nunca lo recibe (ver bug: el form de edición
  // siempre mostraba los recordatorios destildados y el guardado los borraba).
  private async adjuntarDiasRecordatorio<T extends { _id: Types.ObjectId }>(proyectos: T[]): Promise<(T & { dias_recordatorio: number[] })[]> {
    const mapa = await this.recordatoriosService.obtenerDiasBatch('proyecto', proyectos.map(p => p._id));
    return proyectos.map(p => ({ ...p, dias_recordatorio: mapa.get(String(p._id)) ?? [] }));
  }

  private async validarCentrosEnCliente(cliente_id: string, centro_costo_ids: string[]) {
    const count = await this.centroCostoModel.countDocuments({
      _id: { $in: centro_costo_ids.map((id) => this.toObjectId(id)) },
      cliente_id: this.toObjectId(cliente_id),
      activo: true,
    });
    if (count !== centro_costo_ids.length) {
      throw new BadRequestException('Uno o más centros seleccionados no pertenecen a la empresa indicada');
    }
  }

  async create(dto: CreateProyectoDto, creadoPor?: string): Promise<any> {
    const centroIds = dto.centro_costo_ids ?? [];
    if (!centroIds.length) throw new BadRequestException('Debe seleccionar al menos un centro de costos');
    await this.validarCentrosEnCliente(dto.cliente_id!, centroIds);
    const existe = await this.proyectoModel.findOne({
      centro_costo_ids: { $in: centroIds.map((id) => this.toObjectId(id)) },
      codigo: dto.codigo,
    });
    if (existe) throw new ConflictException(`Ya existe el código ${dto.codigo} en uno de los centros seleccionados`);
    const doc: Record<string, unknown> = {
      ...dto,
      cliente_id: this.toObjectId(dto.cliente_id!),
      centro_costo_ids: centroIds.map((id) => this.toObjectId(id)),
      tipo_proyecto_id: dto.tipo_proyecto_id ? this.toObjectId(dto.tipo_proyecto_id) : undefined,
      fecha_inicio: dto.fecha_inicio ? new Date(dto.fecha_inicio) : undefined,
      fecha_fin: dto.fecha_fin ? new Date(dto.fecha_fin) : undefined,
    };
    if (creadoPor) doc['creado_por'] = new Types.ObjectId(creadoPor);
    try {
      const proyecto = await new this.proyectoModel(doc).save();
      const diasSolicitados = dto.dias_recordatorio ?? [];
      await this.recordatoriosService.sincronizar('proyecto', proyecto._id, diasSolicitados, proyecto.fecha_fin);
      // sincronizar() no persiste nada si falta fecha_fin (borra en vez de crear) —
      // reflejar eso en la respuesta en vez de ecoar siempre lo pedido en el DTO.
      const dias_recordatorio = proyecto.fecha_fin ? diasSolicitados : [];
      const populated = await proyecto.populate('tipo_proyecto_id');
      return { ...populated.toObject(), dias_recordatorio };
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictException(`Ya existe el código ${dto.codigo} en uno de los centros seleccionados`);
      }
      throw err;
    }
  }

  async findAll(page = 1, limit = 500, estado?: string) {
    const filter = estado ? { estado } : { estado: { $ne: 'eliminado' } };
    const [data, total] = await Promise.all([
      this.proyectoModel.find(filter).populate('tipo_proyecto_id').sort({ nombre: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.proyectoModel.countDocuments(filter),
    ]);
    return { data: await this.adjuntarDiasRecordatorio(data), total, page, pages: Math.ceil(total / limit) };
  }

  async findAllByCliente(cliente_id: string, page = 1, limit = 500) {
    const filter = {
      cliente_id: new Types.ObjectId(cliente_id),
      estado: { $ne: 'eliminado' },
    };
    const [data, total] = await Promise.all([
      this.proyectoModel.find(filter).populate('tipo_proyecto_id').sort({ nombre: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.proyectoModel.countDocuments(filter),
    ]);
    return { data: await this.adjuntarDiasRecordatorio(data), total, page, pages: Math.ceil(total / limit) };
  }

  async findAllByCentro(centro_costo_id: string, page = 1, limit = 500) {
    const filter = {
      centro_costo_ids: new Types.ObjectId(centro_costo_id),
      estado: { $ne: 'eliminado' },
    };
    const [data, total] = await Promise.all([
      this.proyectoModel.find(filter).populate('tipo_proyecto_id').sort({ nombre: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.proyectoModel.countDocuments(filter),
    ]);
    return { data: await this.adjuntarDiasRecordatorio(data), total, page, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string): Promise<any> {
    const proyecto = await this.proyectoModel.findById(id).populate('tipo_proyecto_id').lean();
    if (!proyecto) throw new NotFoundException(`Proyecto ${id} no encontrado`);
    const dias_recordatorio = await this.recordatoriosService.obtenerDias('proyecto', proyecto._id);
    return { ...proyecto, dias_recordatorio };
  }

  async update(id: string, dto: UpdateProyectoDto): Promise<any> {
    const proyectoActual = await this.proyectoModel.findById(id).lean();
    if (!proyectoActual) throw new NotFoundException(`Proyecto ${id} no encontrado`);
    const clienteId = dto.cliente_id || proyectoActual.cliente_id.toString();
    if (dto.centro_costo_ids) {
      if (!dto.centro_costo_ids.length) throw new BadRequestException('Debe seleccionar al menos un centro de costos');
      await this.validarCentrosEnCliente(clienteId, dto.centro_costo_ids);
    }
    const codigo = dto.codigo ?? proyectoActual.codigo;
    const centroIds = dto.centro_costo_ids ?? proyectoActual.centro_costo_ids.map((c) => c.toString());
    const existe = await this.proyectoModel.findOne({
      _id: { $ne: this.toObjectId(id) },
      centro_costo_ids: { $in: centroIds.map((cid) => this.toObjectId(cid)) },
      codigo,
    });
    if (existe) throw new ConflictException(`Ya existe el código ${codigo} en uno de los centros seleccionados`);
    const payload: Record<string, unknown> = { ...dto };
    if (dto.cliente_id) payload['cliente_id'] = this.toObjectId(dto.cliente_id);
    if (dto.centro_costo_ids) payload['centro_costo_ids'] = dto.centro_costo_ids.map((cid) => this.toObjectId(cid));
    if (dto.tipo_proyecto_id) payload['tipo_proyecto_id'] = this.toObjectId(dto.tipo_proyecto_id);
    try {
      const proyecto = await this.proyectoModel
        .findByIdAndUpdate(id, payload, { new: true, runValidators: true })
        .populate('tipo_proyecto_id')
        .lean();
      if (!proyecto) throw new NotFoundException(`Proyecto ${id} no encontrado`);
      const dias_recordatorio = await this.sincronizarRecordatorio(proyecto, dto.dias_recordatorio);
      return { ...proyecto, dias_recordatorio };
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictException(`Ya existe el código ${codigo} en uno de los centros seleccionados`);
      }
      throw err;
    }
  }

  private async sincronizarRecordatorio(proyecto: any, diasDto?: number[]): Promise<number[]> {
    // Sin fecha_fin no hay contra qué calcular vencimiento: sincronizar() borraría
    // igual el registro, así que evitamos la llamada y devolvemos lo realmente
    // persistido ([]) en vez de ecoar los días pedidos en el DTO.
    if (ESTADOS_TERMINALES.includes(proyecto.estado) || proyecto.estado === 'eliminado' || !proyecto.fecha_fin) {
      await this.recordatoriosService.eliminar('proyecto', proyecto._id);
      return [];
    }
    const dias = diasDto ?? await this.recordatoriosService.obtenerDias('proyecto', proyecto._id);
    await this.recordatoriosService.sincronizar('proyecto', proyecto._id, dias, proyecto.fecha_fin);
    return dias;
  }

  async remove(id: string) {
    const proyecto = await this.proyectoModel
      .findByIdAndUpdate(id, { estado: 'eliminado' }, { new: true })
      .populate('cliente_id', 'razon_social')
      .populate('centro_costo_ids', 'nombre')
      .lean() as any;
    if (!proyecto) throw new NotFoundException(`Proyecto ${id} no encontrado`);
    await this.recordatoriosService.eliminar('proyecto', proyecto._id);
    this.notificarCierreProyecto(proyecto).catch((err: unknown) =>
      this.logger.error('Error al notificar cierre de proyecto:', err),
    );
    return { message: 'Proyecto eliminado', id };
  }

  private async notificarCierreProyecto(proyecto: any): Promise<void> {
    const empresaId = String(proyecto.cliente_id?._id ?? proyecto.cliente_id);
    const admins = await resolverAdminsSuscritos(this.usuarioModel as any, {
      tipo: 'proyecto',
      empresaId,
      proyectoId: String(proyecto._id),
    });
    if (!admins.length) return;

    const empresaNombre = proyecto.cliente_id?.razon_social ?? 'Empresa';
    const centrosNombres = (proyecto.centro_costo_ids ?? []).map((c: any) => c.nombre).join(', ') || undefined;

    await this.mailService.notificarProyectoCerrado({
      destinatarios: admins,
      proyecto: {
        nombre: proyecto.nombre,
        jerarquia: { empresa: empresaNombre, centro: centrosNombres, proyecto: proyecto.nombre },
      },
    });
  }

  async agregarDocumento(id: string, input: DocumentoInput, nombreDisplay?: string, categoria?: string, usuarioId?: string, rolUploader?: string) {
    const result = await this.docsHelper.agregar(id, input, nombreDisplay, categoria, usuarioId);
    if (rolUploader === 'usuario') {
      this.notificarSubidaDocumento(id, result['nombre_display'] as string, result['categoria'] as string | undefined, usuarioId)
        .catch((err: unknown) => this.logger.error('Error al notificar subida de documento (proyecto):', err));
    }
    return result;
  }

  private async notificarSubidaDocumento(proyectoId: string, nombre: string, categoria?: string, usuarioId?: string): Promise<void> {
    const proyecto = await this.proyectoModel
      .findById(proyectoId)
      .select('nombre cliente_id centro_costo_ids')
      .populate('cliente_id', 'razon_social')
      .populate('centro_costo_ids', 'nombre')
      .lean() as any;
    if (!proyecto) return;
    const empresaId = proyecto.cliente_id?._id ?? proyecto.cliente_id;
    const empresaNombre = proyecto.cliente_id?.razon_social ?? 'Empresa';
    const centrosNombres = (proyecto.centro_costo_ids ?? []).map((c: any) => c.nombre).join(', ') || undefined;
    await notificarDocumentoSubido({
      jerarquia: { empresa: empresaNombre, centro: centrosNombres, proyecto: proyecto.nombre },
      nombre,
      categoria: categoria ?? 'Sin categoría',
      usuarioId,
      usuarioModel: this.usuarioModel as any,
      mailService: this.mailService,
      logger: this.logger,
      scope: { tipo: 'proyecto', empresaId: String(empresaId), proyectoId },
    });
  }

  async listarDocumentos(id: string) {
    const docs = await this.docsHelper.listar(id);
    return resolverSubidoPorNombre(docs, this.usuarioModel as any);
  }

  async actualizarDocumento(id: string, docId: string, categoria: string) {
    const doc = await this.docsHelper.actualizarCategoria(id, docId, categoria);
    const [conNombre] = await resolverSubidoPorNombre([doc], this.usuarioModel as any);
    return conNombre;
  }

  servirDocumento(proyectoId: string, docId: string) {
    return this.docsHelper.servir(proyectoId, docId);
  }

  eliminarDocumento(proyectoId: string, docId: string) {
    return this.docsHelper.eliminar(proyectoId, docId);
  }

  async vencerDocumento(
    proyectoId: string, docId: string,
    empresaId: string, centroId: string,
    empresaNombre?: string, centroNombre?: string, proyectoNombre?: string,
    notificacion?: NotificacionOpcionesDto,
  ) {
    const proyecto = await this.proyectoModel
      .findById(proyectoId)
      .populate('cliente_id', 'razon_social')
      .populate('centro_costo_ids', 'nombre')
      .lean() as any;
    if (!proyecto) throw new NotFoundException(`Proyecto ${proyectoId} no encontrado`);

    const doc = await this.docProyectoModel.findOne({
      _id: new Types.ObjectId(docId),
      proyecto_id: new Types.ObjectId(proyectoId),
    });
    if (!doc) throw new NotFoundException(`Documento ${docId} no encontrado`);

    const empresaNombreReal = proyecto.cliente_id?.razon_social ?? empresaNombre ?? 'Empresa';
    const centrosNombresReal = (proyecto.centro_costo_ids ?? []).map((c: any) => c.nombre).join(', ') || centroNombre || undefined;

    await this.documentosVencidosService.crear({
      nombre_display:  doc.nombre_display,
      categoria:       doc.categoria,
      tipo_contenido:  doc.tipo_contenido as 'archivo' | 'link' | undefined,
      link_url:        doc.link_url,
      tipo_mime:       doc.tipo_mime,
      tamano_bytes:    doc.tamano_bytes,
      contenido:       doc.contenido,
      s3_key:          doc.s3_key,
      subido_por:      doc.subido_por,
      origen_tipo:     'proyecto',
      empresa_id:      empresaId,
      centro_id:       centroId,
      proyecto_id:     proyectoId,
      empresa_nombre:  empresaNombre,
      centro_nombre:   centroNombre,
      proyecto_nombre: proyectoNombre,
      subido_en:       doc.subido_en,
    });

    await this.docProyectoModel.deleteOne({ _id: doc._id });

    void this.notificarVencimiento(
      empresaId,
      centroId,
      proyectoId,
      doc.nombre_display as string,
      doc.categoria as string,
      { empresa: empresaNombreReal, centro: centrosNombresReal, proyecto: proyecto.nombre },
      notificacion,
    );

    return { message: 'Documento marcado como vencido', docId };
  }

  private async notificarVencimiento(
    empresaIdStr: string,
    centroId: string,
    proyectoIdStr: string,
    nombreDoc: string,
    categoria: string,
    jerarquia: ContextoJerarquico,
    notificacion?: NotificacionOpcionesDto,
  ): Promise<void> {
    if (!notificacion?.notificar) return;

    try {
      const empresaId  = new Types.ObjectId(empresaIdStr);
      const centroObjId = new Types.ObjectId(centroId);
      const proyectoObjId = new Types.ObjectId(proyectoIdStr);

      let usuariosDestino: { nombre: string; email: string }[] = [];

      if (notificacion.audiencia === 'especificos') {
        usuariosDestino = await this.usuarioModel
          .find({
            _id: { $in: (notificacion.destinatarios_ids ?? []).map(id => new Types.ObjectId(id)) },
            activo: true,
            $or: [{ cliente_id: empresaId }, { rol: 'admin_smartclarity' }],
          })
          .select('nombre email')
          .lean();
      } else {
        usuariosDestino = await this.usuarioModel
          .find({
            activo: true,
            $or: [
              { rol: 'admin_smartclarity', $or: condicionSuscripcionAdmin({ empresaId, centroId: centroObjId, proyectoId: proyectoObjId }) },
              { cliente_id: empresaId, centros_asignados: centroObjId },
            ],
          })
          .select('nombre email')
          .lean();
      }

      const superAdmins = notificacion.notificar_super_admins
        ? await this.usuarioModel.find({ rol: 'super_admin', activo: true }).select('nombre email').lean()
        : [];

      const vistos = new Set<string>();
      const destinatarios: { nombre: string; email: string }[] = [];
      for (const u of [...usuariosDestino, ...superAdmins]) {
        if (u.email && !vistos.has(u.email)) {
          vistos.add(u.email);
          destinatarios.push({ nombre: u.nombre, email: u.email });
        }
      }

      if (destinatarios.length === 0) return;

      await this.mailService.notificarDocumentoVencido({
        destinatarios,
        documento: { nombre: nombreDoc, categoria, jerarquia },
      });
    } catch (err: unknown) {
      this.logger.error('Error al notificar vencimiento de documento:', err);
    }
  }

  // Recordatorios de plazo de proyecto próximo a vencer. Invocado cada hora
  // por el cron interno de TareasService (CRON_INTERNO=true) o a mano vía
  // TareasController; la marca ultimo_recordatorio_dias hace que correr
  // seguido no repita avisos.
  async enviarRecordatoriosVencimiento(): Promise<{ evaluados: number; notificados: number; cerrados: number }> {
    const hoyUtc = hoyUtcChile();
    const { vencidos, porNotificar } = await this.recordatoriosService.evaluarPendientes('proyecto', hoyUtc);

    let cerrados = 0;
    if (vencidos.length) {
      // El filtro de estado es defensivo: si el recordatorio quedó desincronizado
      // (p. ej. el proyecto ya se movió a cierre manualmente) no se vuelve a mover/notificar.
      const aCerrar = await this.proyectoModel
        .find({ _id: { $in: vencidos }, estado: { $nin: [...ESTADOS_TERMINALES, 'eliminado'] } })
        .populate('cliente_id', 'razon_social')
        .populate('centro_costo_ids', 'nombre')
        .lean() as any[];
      for (const proyecto of aCerrar) {
        // El plazo venció: pasa a cierre pendiente (validación interna) en vez de
        // saltar directo a facturado.
        await this.proyectoModel.findByIdAndUpdate(proyecto._id, { estado: 'cierre_pendiente' });
        await this.notificarCierreProyecto(proyecto);
        cerrados++;
      }
      // Los que estaban desincronizados (ya en un estado terminal) tampoco necesitan seguir vigilados.
      await Promise.all(vencidos.map(id => this.recordatoriosService.eliminar('proyecto', id)));
    }

    let notificados = 0;
    if (porNotificar.length) {
      // Filtro de estado defensivo (igual que en "vencidos"): si el recordatorio
      // quedó desincronizado con un proyecto ya en un estado terminal, no se notifica.
      const proyectos = await this.proyectoModel
        .find({ _id: { $in: porNotificar.map(p => p.entidadId) }, estado: { $nin: [...ESTADOS_TERMINALES, 'eliminado'] } })
        .populate('cliente_id', 'razon_social')
        .populate('centro_costo_ids', 'nombre')
        .lean() as any[];
      const porId = new Map(proyectos.map(p => [String(p._id), p]));

      for (const pendiente of porNotificar) {
        const proyecto = porId.get(String(pendiente.entidadId));
        if (!proyecto) continue;

        const empresaId = String(proyecto.cliente_id?._id ?? proyecto.cliente_id);
        // Solo admins suscritos explícitamente a la empresa o al proyecto: el
        // toggle notificar_todas_empresas NO aplica a recordatorios (evita que
        // todo admin reciba los avisos por el default true del campo).
        const admins = await resolverAdminsSuscritos(
          this.usuarioModel as any,
          { tipo: 'proyecto', empresaId, proyectoId: String(proyecto._id) },
          { soloSuscritos: true },
        );
        if (!admins.length) continue;

        const empresaNombre = proyecto.cliente_id?.razon_social ?? 'Empresa';
        const centrosNombres = (proyecto.centro_costo_ids ?? []).map((c: any) => c.nombre).join(', ') || undefined;
        const fechaFin = new Date(proyecto.fecha_fin).toLocaleDateString('es-CL', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
        });

        await this.mailService.notificarProyectoPorVencer({
          destinatarios: admins,
          proyecto: {
            nombre: proyecto.nombre,
            fechaFin,
            diasRestantes: pendiente.diasRestantes,
            jerarquia: { empresa: empresaNombre, centro: centrosNombres, proyecto: proyecto.nombre },
          },
        });
        await this.recordatoriosService.marcarNotificado('proyecto', pendiente.entidadId, pendiente.diasRestantes);
        notificados++;
      }
    }

    return { evaluados: vencidos.length + porNotificar.length, notificados, cerrados };
  }
}
