import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { readFileSync } from 'fs';
import {
  Newsletter,
  NewsletterDocument,
  NewsletterImagen,
  NewsletterImagenDocument,
} from './newsletters.schema';
import {
  SugerenciaNewsletter,
  SugerenciaNewsletterDocument,
} from './sugerencias-newsletter.schema';
import { CreateNewsletterDto, UpdateNewsletterDto, RechazarNewsletterDto } from './newsletters.dto';
import { MailService } from '../mail/mail.service';
import { newsletterHtml } from '../mail/templates/newsletter.template';
import { SC_LOGO_PATH } from '../mail/templates/logo';

interface ImagenBloque {
  _id: string;
  url: string;
}

interface BloqueConImagenes {
  titulo: string;
  cuerpo: string;
  imagenes: ImagenBloque[];
}

interface ImagenLean {
  _id: unknown;
  newsletter_id: unknown;
  bloque: number;
}

interface UsuarioLean {
  nombre: string;
  email: string;
  activo: boolean;
  rol: string;
}

@Injectable()
export class NewslettersService {
  private readonly logger = new Logger(NewslettersService.name);
  private logoBase64: string | null = null;

  constructor(
    @InjectModel('Newsletter') private newsletterModel: Model<NewsletterDocument>,
    @InjectModel('NewsletterImagen') private newsletterImagenModel: Model<NewsletterImagenDocument>,
    @InjectModel('SugerenciaNewsletter') private sugerenciaModel: Model<SugerenciaNewsletterDocument>,
    @InjectModel('Usuario') private usuarioModel: Model<UsuarioLean>,
    private mailService: MailService,
    private configService: ConfigService,
  ) {}

  private get aprobadorEmail(): string {
    return (this.configService.get<string>('NEWSLETTER_APROBADOR_EMAIL') ?? '').toLowerCase().trim();
  }

  private esAprobador(user: { email: string; rol: string }): boolean {
    return user.rol === 'super_admin' && user.email.toLowerCase().trim() === this.aprobadorEmail;
  }

  private normalizarBuffer(raw: unknown): Buffer {
    if (Buffer.isBuffer(raw)) return raw;
    if (raw && typeof raw === 'object') {
      const obj = raw as { buffer?: Buffer | ArrayBuffer; type?: string; data?: unknown };
      if (obj.buffer !== undefined) {
        return Buffer.isBuffer(obj.buffer) ? obj.buffer : Buffer.from(obj.buffer);
      }
      if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
        return Buffer.from(obj.data);
      }
    }
    return Buffer.from(raw as ArrayBuffer);
  }

  private getLogoBase64(): string {
    if (this.logoBase64 === null) {
      try {
        const buf = readFileSync(SC_LOGO_PATH);
        this.logoBase64 = `data:image/png;base64,${buf.toString('base64')}`;
      } catch (err) {
        this.logger.warn(`No se pudo leer el logo para el preview: ${(err as Error).message}`);
        this.logoBase64 = '';
      }
    }
    return this.logoBase64;
  }

  private adjuntarImagenes(
    newsletter: Record<string, unknown>,
    imagenes: ImagenLean[],
  ): Record<string, unknown> {
    const bloques = (newsletter.bloques as { titulo: string; cuerpo: string }[] | undefined) ?? [];
    return {
      ...newsletter,
      bloques: bloques.map((bloque, idx): BloqueConImagenes => ({
        titulo: bloque.titulo,
        cuerpo: bloque.cuerpo,
        imagenes: imagenes
          .filter(img => img.bloque === idx)
          .map(img => ({
            _id: String(img._id),
            url: `/api/v1/newsletters/imagenes/${img._id}`,
          })),
      })),
    };
  }

  async findAll(): Promise<object[]> {
    const newsletters = await this.newsletterModel
      .find({ activo: true })
      .sort({ creado_en: -1 })
      .lean();

    const ids = newsletters.map(n => n._id);
    const imagenes = await this.newsletterImagenModel
      .find({ newsletter_id: { $in: ids } })
      .select('newsletter_id bloque')
      .sort({ bloque: 1, orden: 1 })
      .lean();

    return newsletters.map(n =>
      this.adjuntarImagenes(n, imagenes.filter(img => String(img.newsletter_id) === String(n._id))),
    );
  }

  async findOne(id: string) {
    const newsletter = await this.newsletterModel.findById(id).lean();
    if (!newsletter) throw new NotFoundException(`Newsletter ${id} no encontrado`);

    const imagenes = await this.newsletterImagenModel
      .find({ newsletter_id: newsletter._id })
      .select('newsletter_id bloque')
      .sort({ bloque: 1, orden: 1 })
      .lean();

    return this.adjuntarImagenes(newsletter, imagenes);
  }

  async create(dto: CreateNewsletterDto, creadoPorId: string) {
    return new this.newsletterModel({
      ...dto,
      estado: 'borrador',
      aprobador_email: this.aprobadorEmail,
      creado_por: creadoPorId ? new Types.ObjectId(creadoPorId) : undefined,
    }).save();
  }

  async update(id: string, dto: UpdateNewsletterDto) {
    const newsletter = await this.newsletterModel.findById(id).lean();
    if (!newsletter) throw new NotFoundException(`Newsletter ${id} no encontrado`);

    const updateData: Record<string, unknown> = { ...dto };
    // Cualquier edición posterior a aprobación/rechazo/pendiente vuelve a borrador.
    if (!['borrador'].includes(newsletter.estado)) {
      updateData.estado = 'borrador';
      updateData.aprobado_por = undefined;
      updateData.aprobado_en = undefined;
      updateData.motivo_rechazo = '';
    }

    const actualizado = await this.newsletterModel
      .findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
      .lean();
    if (!actualizado) throw new NotFoundException(`Newsletter ${id} no encontrado`);
    return actualizado;
  }

  async subirImagenes(id: string, bloque: number, archivos: { buffer: Buffer; mimetype: string }[]) {
    const newsletter = await this.newsletterModel.findById(id).lean();
    if (!newsletter) throw new NotFoundException(`Newsletter ${id} no encontrado`);

    const existentes = await this.newsletterImagenModel
      .countDocuments({ newsletter_id: newsletter._id, bloque })
      .exec();

    const creadas = await this.newsletterImagenModel.insertMany(
      archivos.map((archivo, i) => ({
        newsletter_id: newsletter._id,
        bloque,
        orden: existentes + i,
        mimetype: archivo.mimetype || 'image/jpeg',
        data: archivo.buffer,
      })),
    );

    return creadas.map(img => ({ _id: String(img._id), url: `/api/v1/newsletters/imagenes/${img._id}` }));
  }

  async eliminarImagen(id: string, imagenId: string) {
    const newsletter = await this.newsletterModel.findById(id).lean();
    if (!newsletter) throw new NotFoundException(`Newsletter ${id} no encontrado`);

    const eliminada = await this.newsletterImagenModel.findOneAndDelete({
      _id: imagenId,
      newsletter_id: newsletter._id,
    }).lean();
    if (!eliminada) throw new NotFoundException(`Imagen ${imagenId} no encontrada`);
    return { message: 'Imagen eliminada', id: imagenId };
  }

  async getImagen(imagenId: string): Promise<{ data: Buffer; mimetype: string }> {
    const imagen = await this.newsletterImagenModel.findById(imagenId).select('data mimetype').lean();
    if (!imagen) throw new NotFoundException(`Imagen ${imagenId} no encontrada`);
    return { data: this.normalizarBuffer(imagen.data), mimetype: imagen.mimetype || 'image/jpeg' };
  }

  private async construirNotificacion(id: string) {
    const newsletter = await this.newsletterModel.findById(id).lean();
    if (!newsletter) throw new NotFoundException(`Newsletter ${id} no encontrado`);

    const imagenes = await this.newsletterImagenModel
      .find({ newsletter_id: newsletter._id })
      .sort({ bloque: 1, orden: 1 })
      .lean();

    const bloques = (newsletter.bloques ?? []).map((bloque, idx) => ({
      titulo: bloque.titulo,
      cuerpo: bloque.cuerpo,
      imagenes: imagenes
        .filter(img => img.bloque === idx)
        .map(img => ({
          buffer: this.normalizarBuffer(img.data),
          mimetype: img.mimetype || 'image/jpeg',
        })),
    }));

    return { id: String(newsletter._id), titulo: newsletter.titulo, tagline: newsletter.tagline ?? '', bloques };
  }

  async renderHtml(id: string): Promise<string> {
    const newsletter = await this.newsletterModel.findById(id).lean();
    if (!newsletter) throw new NotFoundException(`Newsletter ${id} no encontrado`);

    const imagenes = await this.newsletterImagenModel
      .find({ newsletter_id: newsletter._id })
      .sort({ bloque: 1, orden: 1 })
      .lean();

    const bloques = (newsletter.bloques ?? []).map((bloque, idx) => ({
      titulo: bloque.titulo,
      cuerpo: bloque.cuerpo,
      imagenes: imagenes
        .filter(img => img.bloque === idx)
        .map(img => `data:${img.mimetype || 'image/jpeg'};base64,${this.normalizarBuffer(img.data).toString('base64')}`),
    }));

    const portalUrl = this.configService.get<string>('PORTAL_URL') ?? 'http://localhost:4200';

    return newsletterHtml({
      destinatario: '',
      titulo: newsletter.titulo,
      tagline: newsletter.tagline,
      bloques,
      newsletterUrl: `${portalUrl}/noticias/newsletters/${id}`,
      logoUrl: this.getLogoBase64(),
    });
  }

  async enviarPrueba(id: string, usuario: { sub: string; email: string }) {
    const notificacion = await this.construirNotificacion(id);

    const usuarioDb = await this.usuarioModel.findById(usuario.sub).select('nombre email').lean();
    const email = usuarioDb?.email || usuario.email;
    const nombre = usuarioDb?.nombre || '';
    if (!email) throw new NotFoundException('No se encontró un email para la prueba');

    const destinatario = { nombre, email };

    this.logger.log(`Newsletter ${id}: envío de prueba a ${email}`);
    await this.mailService.notificarNewsletterPrueba({ destinatario, newsletter: notificacion });
    return { message: `Prueba enviada a ${email}` };
  }

  // ── Flujo de aprobación ───────────────────────────────────────────────────

  async solicitarAprobacion(id: string, solicitante: { sub: string; email: string; rol: string }) {
    const newsletter = await this.newsletterModel.findById(id).lean();
    if (!newsletter) throw new NotFoundException(`Newsletter ${id} no encontrado`);
    if (solicitante.rol !== 'super_admin') {
      throw new ConflictException('Solo un super_admin puede solicitar aprobación');
    }
    if (!['borrador', 'rechazado'].includes(newsletter.estado)) {
      throw new ConflictException(`No se puede solicitar aprobación desde el estado ${newsletter.estado}`);
    }

    const aprobadorEmail = this.aprobadorEmail;
    if (!aprobadorEmail) {
      throw new ConflictException('No está configurado NEWSLETTER_APROBADOR_EMAIL');
    }

    await this.newsletterModel.findByIdAndUpdate(id, {
      estado: 'pendiente_aprobacion',
      aprobador_email: aprobadorEmail,
      aprobado_por: undefined,
      aprobado_en: undefined,
      motivo_rechazo: '',
    });

    const solicitanteDb = await this.usuarioModel.findById(solicitante.sub).select('nombre email').lean();
    const notificacion = await this.construirNotificacion(id);
    const portalUrl = this.configService.get<string>('PORTAL_URL') ?? 'http://localhost:4200';

    await this.mailService.notificarNewsletterRevision({
      aprobadorEmail,
      solicitanteNombre: solicitanteDb?.nombre || '',
      solicitanteEmail: solicitanteDb?.email || solicitante.email,
      newsletter: notificacion,
      revisarUrl: `${portalUrl}/noticias`,
    });

    return { message: `Copia de revisión enviada a ${aprobadorEmail}` };
  }

  async aprobar(id: string, aprobador: { sub: string; email: string; rol: string }) {
    const newsletter = await this.newsletterModel.findById(id).lean();
    if (!newsletter) throw new NotFoundException(`Newsletter ${id} no encontrado`);
    if (!this.esAprobador(aprobador)) {
      throw new ConflictException('Solo el super_admin aprobador configurado puede aprobar este newsletter');
    }
    if (newsletter.estado !== 'pendiente_aprobacion') {
      throw new ConflictException(`No se puede aprobar un newsletter en estado ${newsletter.estado}`);
    }

    await this.newsletterModel.findByIdAndUpdate(id, {
      estado: 'aprobado',
      aprobado_por: new Types.ObjectId(aprobador.sub),
      aprobado_en: new Date(),
      motivo_rechazo: '',
    });

    await this.notificarResultadoAprobacion(id, true);
    return { message: 'Newsletter aprobado. Ya puede enviarse a todos.' };
  }

  async rechazar(id: string, dto: RechazarNewsletterDto, aprobador: { sub: string; email: string; rol: string }) {
    const newsletter = await this.newsletterModel.findById(id).lean();
    if (!newsletter) throw new NotFoundException(`Newsletter ${id} no encontrado`);
    if (!this.esAprobador(aprobador)) {
      throw new ConflictException('Solo el super_admin aprobador configurado puede rechazar este newsletter');
    }
    if (newsletter.estado !== 'pendiente_aprobacion') {
      throw new ConflictException(`No se puede rechazar un newsletter en estado ${newsletter.estado}`);
    }

    await this.newsletterModel.findByIdAndUpdate(id, {
      estado: 'rechazado',
      aprobado_por: undefined,
      aprobado_en: undefined,
      motivo_rechazo: dto.motivo,
    });

    await this.notificarResultadoAprobacion(id, false, dto.motivo);
    return { message: 'Newsletter rechazado. El autor recibirá el motivo.' };
  }

  private async notificarResultadoAprobacion(id: string, aprobado: boolean, motivo?: string) {
    const newsletter = await this.newsletterModel.findById(id).lean();
    if (!newsletter?.creado_por) return;

    const autor = await this.usuarioModel
      .findById(newsletter.creado_por)
      .select('nombre email')
      .lean();
    if (!autor?.email) return;

    await this.mailService.notificarResultadoAprobacionNewsletter({
      destinatario: { nombre: autor.nombre, email: autor.email },
      titulo: newsletter.titulo,
      aprobado,
      motivo,
    });
  }

  async enviarATodos(id: string) {
    const newsletter = await this.newsletterModel.findById(id).lean();
    if (!newsletter) throw new NotFoundException(`Newsletter ${id} no encontrado`);
    if (newsletter.estado !== 'aprobado') {
      throw new ConflictException('El newsletter debe estar aprobado antes de enviarse a todos');
    }

    const notificacion = await this.construirNotificacion(id);

    const usuarios = await this.usuarioModel
      .find({ activo: true, rol: { $in: ['super_admin', 'admin_smartclarity'] } })
      .select('nombre email')
      .lean();

    const destinatarios = usuarios.filter(u => u.email);
    if (destinatarios.length === 0) throw new NotFoundException('No hay destinatarios activos');

    this.logger.log(`Newsletter ${id}: envío a ${destinatarios.length} miembro(s) de SmartClarity`);
    await this.mailService.notificarNewsletter({ destinatarios, newsletter: notificacion });

    await this.newsletterModel.findByIdAndUpdate(id, {
      estado: 'enviado',
      enviado_en: new Date(),
    });

    return { message: `Newsletter enviado a ${destinatarios.length} miembro(s)` };
  }

  async remove(id: string) {
    const newsletter = await this.newsletterModel.findByIdAndDelete(id).lean();
    if (!newsletter) throw new NotFoundException(`Newsletter ${id} no encontrado`);

    await this.newsletterImagenModel.deleteMany({ newsletter_id: newsletter._id });
    return { message: 'Newsletter eliminado', id };
  }

  // ── Buzón de sugerencias ──────────────────────────────────────────────────

  async crearSugerencia(
    dto: { mensaje: string; categoria?: string },
    autor: { sub: string; email: string; rol: string },
  ) {
    if (!['super_admin', 'admin_smartclarity'].includes(autor.rol)) {
      throw new ConflictException('Solo el personal interno puede enviar sugerencias');
    }
    if (!dto.mensaje?.trim()) throw new ConflictException('El mensaje es obligatorio');

    return new this.sugerenciaModel({
      mensaje: dto.mensaje.trim(),
      categoria: (dto.categoria ?? '').trim() || 'Otro',
      autor_id: new Types.ObjectId(autor.sub),
    }).save();
  }

  async listarSugerencias(rol: string): Promise<object[]> {
    if (rol !== 'super_admin') throw new ConflictException('Solo super_admin puede listar sugerencias');
    return this.sugerenciaModel
      .find({ activo: true })
      .sort({ creado_en: -1 })
      .populate('autor_id', 'nombre email rol')
      .lean();
  }

  async eliminarSugerencia(id: string, rol: string) {
    if (rol !== 'super_admin') throw new ConflictException('Solo super_admin puede eliminar sugerencias');
    const eliminada = await this.sugerenciaModel.findByIdAndDelete(id).lean();
    if (!eliminada) throw new NotFoundException(`Sugerencia ${id} no encontrada`);
    return { message: 'Sugerencia eliminada', id };
  }

  async contarPendientesAprobacion(): Promise<number> {
    return this.newsletterModel.countDocuments({ activo: true, estado: 'pendiente_aprobacion' });
  }
}
