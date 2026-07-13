import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProyectoDocument } from './proyectos.schema';
import { CreateProyectoDto, UpdateProyectoDto } from './proyectos.dto';
import { DocumentosHelper, DocumentoInput } from '../common/helpers/documentos.helper';
import { notificarDocumentoSubido, resolverAdminsSuscritos } from '../common/helpers/notificar-documento.helper';
import { hoyUtcChile } from '../common/helpers/fechas.helper';
import { DocumentosVencidosService } from '../documentos-vencidos/documentos-vencidos.service';
import { MailService } from '../mail/mail.service';
import { ContextoJerarquico } from '../mail/templates/jerarquia';
import { NotificacionOpcionesDto } from '../common/dto/notificacion-opciones.dto';
import { S3Service } from '../common/s3/s3.service';

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

  async create(dto: CreateProyectoDto, creadoPor?: string) {
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
      return proyecto.populate('tipo_proyecto_id');
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictException(`Ya existe el código ${dto.codigo} en uno de los centros seleccionados`);
      }
      throw err;
    }
  }

  async findAll(page = 1, limit = 20, estado?: string) {
    const filter = estado ? { estado } : { estado: { $ne: 'cerrado' } };
    const [data, total] = await Promise.all([
      this.proyectoModel.find(filter).populate('tipo_proyecto_id').sort({ nombre: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.proyectoModel.countDocuments(filter),
    ]);
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findAllByCliente(cliente_id: string, page = 1, limit = 100) {
    const filter = {
      cliente_id: new Types.ObjectId(cliente_id),
      estado: { $ne: 'cerrado' },
    };
    const [data, total] = await Promise.all([
      this.proyectoModel.find(filter).populate('tipo_proyecto_id').sort({ nombre: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.proyectoModel.countDocuments(filter),
    ]);
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findAllByCentro(centro_costo_id: string, page = 1, limit = 20) {
    const filter = {
      centro_costo_ids: new Types.ObjectId(centro_costo_id),
      estado: { $ne: 'cerrado' },
    };
    const [data, total] = await Promise.all([
      this.proyectoModel.find(filter).populate('tipo_proyecto_id').sort({ nombre: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.proyectoModel.countDocuments(filter),
    ]);
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const proyecto = await this.proyectoModel.findById(id).populate('tipo_proyecto_id').lean();
    if (!proyecto) throw new NotFoundException(`Proyecto ${id} no encontrado`);
    return proyecto;
  }

  async update(id: string, dto: UpdateProyectoDto) {
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
      return proyecto;
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictException(`Ya existe el código ${codigo} en uno de los centros seleccionados`);
      }
      throw err;
    }
  }

  async remove(id: string) {
    const proyecto = await this.proyectoModel
      .findByIdAndUpdate(id, { estado: 'cerrado' }, { new: true })
      .populate('cliente_id', 'razon_social')
      .populate('centro_costo_ids', 'nombre')
      .lean() as any;
    if (!proyecto) throw new NotFoundException(`Proyecto ${id} no encontrado`);
    this.notificarCierreProyecto(proyecto).catch((err: unknown) =>
      this.logger.error('Error al notificar cierre de proyecto:', err),
    );
    return { message: 'Proyecto cerrado', id };
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

  listarDocumentos(id: string) {
    return this.docsHelper.listar(id);
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
    nombreDoc: string,
    categoria: string,
    jerarquia: ContextoJerarquico,
    notificacion?: NotificacionOpcionesDto,
  ): Promise<void> {
    if (!notificacion?.notificar) return;

    try {
      const empresaId  = new Types.ObjectId(empresaIdStr);
      const centroObjId = new Types.ObjectId(centroId);

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
              { rol: 'admin_smartclarity' },
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

    const proyectos = await this.proyectoModel
      .find({ estado: { $nin: ['cerrado', 'cancelado'] }, fecha_fin: { $ne: null } })
      .populate('cliente_id', 'razon_social')
      .populate('centro_costo_ids', 'nombre')
      .lean() as any[];

    let notificados = 0;
    let cerrados = 0;

    for (const proyecto of proyectos) {
      if (!proyecto.fecha_fin) continue;
      const fin = new Date(proyecto.fecha_fin);
      const finUtc = Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth(), fin.getUTCDate());
      const diasRestantes = Math.round((finUtc - hoyUtc) / 86_400_000);

      // La fecha de término ya pasó: se cierra automáticamente y se notifica
      // a los suscritos del cambio de estado, en vez de seguir enviando
      // recordatorios de "próximo a vencer".
      if (diasRestantes < 0) {
        await this.proyectoModel.findByIdAndUpdate(proyecto._id, { estado: 'cerrado' });
        await this.notificarCierreProyecto(proyecto);
        cerrados++;
        continue;
      }

      // Los días de aviso los define el propio proyecto (creación/edición).
      // Se dispara el umbral más cercano ya cruzado (>= días restantes) que no
      // se haya notificado aún: si el cron corre dos veces el mismo día no
      // reenvía, y si un día marcado pasó sin correr (proceso caído) el aviso
      // se recupera en la siguiente corrida en vez de perderse.
      const umbralesCruzados = (proyecto.dias_recordatorio ?? []).filter((d: number) => d >= diasRestantes);
      if (!umbralesCruzados.length) continue;
      const umbral = Math.min(...umbralesCruzados);
      if (umbral === proyecto.ultimo_recordatorio_dias) continue;

      const empresaId = proyecto.cliente_id?._id ?? proyecto.cliente_id;
      // Solo admins suscritos explícitamente a la empresa o al proyecto: el
      // toggle notificar_todas_empresas NO aplica a recordatorios (evita que
      // todo admin reciba los avisos por el default true del campo).
      const admins = await (this.usuarioModel as any)
        .find({
          rol: { $in: ['admin_smartclarity', 'super_admin'] },
          activo: true,
          $or: [
            { empresas_suscritas: empresaId },
            { proyectos_suscritos: proyecto._id },
          ],
        })
        .select('nombre email')
        .lean();
      if (!admins.length) continue;

      const empresaNombre = proyecto.cliente_id?.razon_social ?? 'Empresa';
      const centrosNombres = (proyecto.centro_costo_ids ?? []).map((c: any) => c.nombre).join(', ') || undefined;
      const fechaFin = fin.toLocaleDateString('es-CL', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
      });

      await this.mailService.notificarProyectoPorVencer({
        destinatarios: admins.map((a: any) => ({ nombre: a.nombre, email: a.email })),
        proyecto: {
          nombre: proyecto.nombre,
          fechaFin,
          diasRestantes,
          jerarquia: { empresa: empresaNombre, centro: centrosNombres, proyecto: proyecto.nombre },
        },
      });
      await this.proyectoModel.findByIdAndUpdate(proyecto._id, { ultimo_recordatorio_dias: umbral });
      notificados++;
    }

    return { evaluados: proyectos.length, notificados, cerrados };
  }
}
