import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import { nuevoUsuarioHtml } from './templates/nuevo-usuario.template';
import { recuperarPasswordHtml } from './templates/recuperar-password.template';
import { nuevaActividadHtml } from './templates/nueva-actividad.template';
import { nuevaSolicitudHtml } from './templates/nueva-solicitud.template';
import { solicitudRechazadaHtml } from './templates/solicitud-rechazada.template';
import { solicitudCompletadaHtml } from './templates/solicitud-completada.template';
import { nuevaNoticiaHtml } from './templates/nueva-noticia.template';
import { newsletterHtml } from './templates/newsletter.template';
import { notificarNewsletterRevisionHtml } from './templates/newsletter-revision.template';
import { notificarResultadoAprobacionHtml } from './templates/newsletter-resultado-aprobacion.template';
import { documentoVencidoHtml } from './templates/documento-vencido.template';
import { nuevoDocumentoHtml } from './templates/nuevo-documento.template';
import { proyectoPorVencerHtml } from './templates/proyecto-por-vencer.template';
import { actividadPorVencerHtml } from './templates/actividad-por-vencer.template';
import { proyectoCerradoHtml } from './templates/proyecto-cerrado.template';
import { SC_LOGO_PATH, SC_LOGO_CID } from './templates/logo';
import { ContextoJerarquico, breadcrumbJerarquiaTexto } from './templates/jerarquia';

const LOGO_ATTACHMENT = { filename: 'image.png', path: SC_LOGO_PATH, cid: SC_LOGO_CID };

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const user = this.config.get<string>('MAIL_USER') ?? '';
    this.from = `"SmartClarity Portal" <${user}>`;

    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user,
        pass: this.config.get<string>('MAIL_PASS') ?? '',
      },
    });
  }

  private async enviarATodos(
    destinatarios: { nombre: string; email: string }[],
    subject: string,
    htmlFn: (dest: { nombre: string; email: string }) => string,
    tipo: string,
    extraAttachments: Mail.Attachment[] = [],
  ): Promise<void> {
    const attachments = [LOGO_ATTACHMENT, ...extraAttachments];
    const results = await Promise.allSettled(
      destinatarios.map(dest =>
        this.transporter.sendMail({ from: this.from, to: dest.email, subject, html: htmlFn(dest), attachments })
          .then(() => { this.logger.log(`Notificación de ${tipo} enviada a ${dest.email}`); })
      )
    );
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
        this.logger.error(`Error al notificar ${tipo} a ${destinatarios[i].email}: ${msg}`);
      }
    });
  }

  async notificarNuevaActividad(params: {
    destinatarios: { nombre: string; email: string }[];
    actividad: { nombre: string; tipo: string; fecha: Date; hora?: string; hora_termino?: string; descripcion?: string; jerarquia: ContextoJerarquico; activos: string[]; documentos?: string[] };
  }): Promise<void> {
    const portalUrl = this.config.get<string>('PORTAL_URL') ?? 'http://localhost:4200';
    let fecha = params.actividad.fecha.toLocaleDateString('es-CL', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      timeZone: 'UTC',
    });
    if (params.actividad.hora) {
      fecha += params.actividad.hora_termino
        ? ` de ${params.actividad.hora} a ${params.actividad.hora_termino} hrs`
        : ` a las ${params.actividad.hora} hrs`;
    }
    await this.enviarATodos(
      params.destinatarios,
      `Nueva actividad programada — ${params.actividad.nombre} — ${breadcrumbJerarquiaTexto(params.actividad.jerarquia)}`,
      dest => nuevaActividadHtml({
        destinatario: dest.nombre,
        nombre:       params.actividad.nombre,
        tipo:         params.actividad.tipo,
        fecha,
        descripcion:  params.actividad.descripcion,
        jerarquia:    params.actividad.jerarquia,
        activos:      params.actividad.activos,
        documentos:   params.actividad.documentos ?? [],
        portalUrl,
      }),
      'actividad',
    );
  }

  async notificarNuevaSolicitud(params: {
    destinatarios: { nombre: string; email: string }[];
    solicitud: { nombre: string; tipo: string; descripcion?: string; jerarquia: ContextoJerarquico };
  }): Promise<void> {
    const portalUrl = this.config.get<string>('PORTAL_URL') ?? 'http://localhost:4200';
    await this.enviarATodos(
      params.destinatarios,
      `Nueva solicitud de documentos — ${params.solicitud.nombre} — ${breadcrumbJerarquiaTexto(params.solicitud.jerarquia)}`,
      dest => nuevaSolicitudHtml({
        destinatario: dest.nombre,
        nombre:       params.solicitud.nombre,
        tipo:         params.solicitud.tipo,
        descripcion:  params.solicitud.descripcion,
        jerarquia:    params.solicitud.jerarquia,
        portalUrl,
      }),
      'solicitud',
    );
  }

  async notificarRechazoSolicitud(params: {
    destinatarios: { nombre: string; email: string }[];
    solicitud: { nombre: string; tipo: string; motivo_rechazo: string; jerarquia: ContextoJerarquico };
  }): Promise<void> {
    const portalUrl = this.config.get<string>('PORTAL_URL') ?? 'http://localhost:4200';
    await this.enviarATodos(
      params.destinatarios,
      `Solicitud rechazada — ${params.solicitud.nombre} — ${breadcrumbJerarquiaTexto(params.solicitud.jerarquia)}`,
      dest => solicitudRechazadaHtml({
        destinatario:   dest.nombre,
        nombre:         params.solicitud.nombre,
        tipo:           params.solicitud.tipo,
        motivo_rechazo: params.solicitud.motivo_rechazo,
        jerarquia:      params.solicitud.jerarquia,
        portalUrl,
      }),
      'rechazo',
    );
  }

  async notificarSolicitudCompletada(params: {
    destinatarios: { nombre: string; email: string }[];
    solicitud: { nombre: string; tipo: string; jerarquia: ContextoJerarquico; completadoPor?: string };
  }): Promise<void> {
    const portalUrl = this.config.get<string>('PORTAL_URL') ?? 'http://localhost:4200';
    await this.enviarATodos(
      params.destinatarios,
      `Solicitud completada, pendiente de revisión — ${params.solicitud.nombre} — ${breadcrumbJerarquiaTexto(params.solicitud.jerarquia)}`,
      dest => solicitudCompletadaHtml({
        destinatario:  dest.nombre,
        nombre:        params.solicitud.nombre,
        tipo:          params.solicitud.tipo,
        jerarquia:     params.solicitud.jerarquia,
        completadoPor: params.solicitud.completadoPor,
        portalUrl,
      }),
      'solicitud-completada',
    );
  }

  async notificarNuevaNoticia(params: {
    destinatarios: { nombre: string; email: string }[];
    noticia: {
      titulo: string; resumen: string; enlace: string; seccion: string;
      imagenBuffer?: Buffer; imagenMimetype?: string;
    };
  }): Promise<void> {
    const portalUrl = this.config.get<string>('PORTAL_URL') ?? 'http://localhost:4200';
    const seccionLabel = params.noticia.seccion.charAt(0).toUpperCase() + params.noticia.seccion.slice(1);

    const extraAttachments: Mail.Attachment[] = [];
    let imagenUrl: string | undefined;

    if (params.noticia.imagenBuffer) {
      const cid = 'noticia-imagen@smartclarity';
      extraAttachments.push({
        filename: 'noticia-imagen',
        content: params.noticia.imagenBuffer,
        contentType: params.noticia.imagenMimetype ?? 'image/jpeg',
        cid,
      });
      imagenUrl = `cid:${cid}`;
    }

    await this.enviarATodos(
      params.destinatarios,
      `[${seccionLabel}] ${params.noticia.titulo}`,
      dest => nuevaNoticiaHtml({
        destinatario: dest.nombre,
        titulo:    params.noticia.titulo,
        resumen:   params.noticia.resumen,
        enlace:    params.noticia.enlace,
        seccion:   params.noticia.seccion,
        imagenUrl,
        portalUrl,
      }),
      'noticia',
      extraAttachments,
    );
  }

  private buildNewsletterAttachments(
    bloques: { titulo: string; cuerpo: string; imagenes: { buffer: Buffer; mimetype: string }[] }[],
  ): { attachments: Mail.Attachment[]; bloquesParaHtml: { titulo: string; cuerpo: string; imagenes: string[] }[] } {
    const attachments: Mail.Attachment[] = [];
    const bloquesParaHtml = bloques.map((bloque, bi) => ({
      titulo: bloque.titulo,
      cuerpo: bloque.cuerpo,
      imagenes: bloque.imagenes.map((img, ii) => {
        const cid = `newsletter-img-${bi}-${ii}@smartclarity`;
        attachments.push({
          filename: `newsletter-img-${bi}-${ii}`,
          content: img.buffer,
          contentType: img.mimetype || 'image/jpeg',
          cid,
        });
        return `cid:${cid}`;
      }),
    }));
    return { attachments, bloquesParaHtml };
  }

  async notificarNewsletter(params: {
    destinatarios: { nombre: string; email: string }[];
    newsletter: {
      id: string;
      titulo: string;
      tagline?: string;
      bloques: { titulo: string; cuerpo: string; imagenes: { buffer: Buffer; mimetype: string }[] }[];
    };
  }): Promise<void> {
    const { attachments, bloquesParaHtml } = this.buildNewsletterAttachments(params.newsletter.bloques);
    const portalUrl = this.config.get<string>('PORTAL_URL') ?? 'http://localhost:4200';

    await this.enviarATodos(
      params.destinatarios,
      `⚡ Newsletter: ${params.newsletter.titulo}`,
      dest => newsletterHtml({
        destinatario: dest.nombre,
        titulo:   params.newsletter.titulo,
        tagline:  params.newsletter.tagline,
        bloques:  bloquesParaHtml,
        newsletterUrl: `${portalUrl}/noticias/newsletters/${params.newsletter.id}`,
        logoUrl:  `cid:${SC_LOGO_CID}`,
      }),
      'newsletter',
      attachments,
    );
  }

  async notificarNewsletterPrueba(params: {
    destinatario: { nombre: string; email: string };
    newsletter: {
      id: string;
      titulo: string;
      tagline?: string;
      bloques: { titulo: string; cuerpo: string; imagenes: { buffer: Buffer; mimetype: string }[] }[];
    };
  }): Promise<void> {
    const { attachments, bloquesParaHtml } = this.buildNewsletterAttachments(params.newsletter.bloques);
    const portalUrl = this.config.get<string>('PORTAL_URL') ?? 'http://localhost:4200';
    const html = newsletterHtml({
      destinatario: params.destinatario.nombre,
      titulo:   params.newsletter.titulo,
      tagline:  params.newsletter.tagline,
      bloques:  bloquesParaHtml,
      newsletterUrl: `${portalUrl}/noticias/newsletters/${params.newsletter.id}`,
      logoUrl:  `cid:${SC_LOGO_CID}`,
    });
    const attachmentsFinal = [LOGO_ATTACHMENT, ...attachments];

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: params.destinatario.email,
        subject: `[PRUEBA] ⚡ Newsletter: ${params.newsletter.titulo}`,
        html,
        attachments: attachmentsFinal,
      });
      this.logger.log(`Newsletter prueba enviada a ${params.destinatario.email}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error al enviar newsletter de prueba a ${params.destinatario.email}: ${msg}`);
      throw err;
    }
  }

  async notificarNewsletterRevision(params: {
    aprobadorEmail: string;
    solicitanteNombre: string;
    solicitanteEmail: string;
    newsletter: {
      titulo: string;
      tagline?: string;
      bloques: { titulo: string; cuerpo: string; imagenes: { buffer: Buffer; mimetype: string }[] }[];
    };
    revisarUrl: string;
  }): Promise<void> {
    const { attachments, bloquesParaHtml } = this.buildNewsletterAttachments(params.newsletter.bloques);
    const html = notificarNewsletterRevisionHtml({
      titulo: params.newsletter.titulo,
      tagline: params.newsletter.tagline,
      bloques: bloquesParaHtml,
      solicitanteNombre: params.solicitanteNombre,
      solicitanteEmail: params.solicitanteEmail,
      revisarUrl: params.revisarUrl,
      logoUrl: `cid:${SC_LOGO_CID}`,
    });

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: params.aprobadorEmail,
        subject: `[REVISIÓN] ⚡ Newsletter: ${params.newsletter.titulo}`,
        html,
        attachments: [LOGO_ATTACHMENT, ...attachments],
      });
      this.logger.log(`Newsletter en revisión enviado a ${params.aprobadorEmail}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error al enviar revisión a ${params.aprobadorEmail}: ${msg}`);
      throw err;
    }
  }

  async notificarResultadoAprobacionNewsletter(params: {
    destinatario: { nombre: string; email: string };
    titulo: string;
    aprobado: boolean;
    motivo?: string;
  }): Promise<void> {
    const html = notificarResultadoAprobacionHtml({
      destinatario: params.destinatario.nombre,
      titulo: params.titulo,
      aprobado: params.aprobado,
      motivo: params.motivo,
      portalUrl: this.config.get<string>('PORTAL_URL') ?? 'http://localhost:4200',
      logoUrl: `cid:${SC_LOGO_CID}`,
    });

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: params.destinatario.email,
        subject: params.aprobado
          ? `✅ Newsletter aprobado: ${params.titulo}`
          : `❌ Newsletter rechazado: ${params.titulo}`,
        html,
        attachments: [LOGO_ATTACHMENT],
      });
      this.logger.log(`Resultado de aprobación enviado a ${params.destinatario.email}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error al enviar resultado de aprobación a ${params.destinatario.email}: ${msg}`);
      throw err;
    }
  }

  async notificarNuevoUsuario(params: {
    nombre: string;
    email: string;
    password: string;
  }): Promise<void> {
    const portalUrl = this.config.get<string>('PORTAL_URL') ?? 'http://localhost:4200';

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: params.email,
        subject: 'Bienvenido al Portal SmartClarity — tus credenciales de acceso',
        html: nuevoUsuarioHtml({ ...params, portalUrl }),
        attachments: [LOGO_ATTACHMENT],
      });
      this.logger.log(`Correo de bienvenida enviado a ${params.email}`);
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error al enviar correo a ${params.email}: ${mensaje}`);
    }
  }

  async notificarRecuperarPassword(params: {
    nombre: string;
    email: string;
    resetUrl: string;
  }): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: params.email,
        subject: 'Recupera tu contraseña — Portal SmartClarity',
        html: recuperarPasswordHtml(params),
        attachments: [LOGO_ATTACHMENT],
      });
      this.logger.log(`Correo de recuperación de contraseña enviado a ${params.email}`);
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error al enviar correo de recuperación a ${params.email}: ${mensaje}`);
    }
  }

  async notificarNuevoDocumento(params: {
    destinatarios: { nombre: string; email: string }[];
    documento: { nombre: string; categoria: string; jerarquia: ContextoJerarquico; subioPor?: string };
  }): Promise<void> {
    const portalUrl = this.config.get<string>('PORTAL_URL') ?? 'http://localhost:4200';
    await this.enviarATodos(
      params.destinatarios,
      `Nuevo documento subido — ${params.documento.nombre} — ${breadcrumbJerarquiaTexto(params.documento.jerarquia)}`,
      dest => nuevoDocumentoHtml({
        destinatario: dest.nombre,
        nombre:       params.documento.nombre,
        categoria:    params.documento.categoria,
        jerarquia:    params.documento.jerarquia,
        subioPor:     params.documento.subioPor,
        portalUrl,
      }),
      'nuevo-documento',
    );
  }

  async notificarDocumentoVencido(params: {
    destinatarios: { nombre: string; email: string }[];
    documento: { nombre: string; categoria: string; jerarquia: ContextoJerarquico };
  }): Promise<void> {
    const portalUrl = this.config.get<string>('PORTAL_URL') ?? 'http://localhost:4200';
    await this.enviarATodos(
      params.destinatarios,
      `Documento vencido — ${params.documento.nombre} — ${breadcrumbJerarquiaTexto(params.documento.jerarquia)}`,
      dest => documentoVencidoHtml({
        destinatario: dest.nombre,
        nombre:       params.documento.nombre,
        categoria:    params.documento.categoria,
        jerarquia:    params.documento.jerarquia,
        portalUrl,
      }),
      'vencimiento',
    );
  }

  async notificarProyectoPorVencer(params: {
    destinatarios: { nombre: string; email: string }[];
    proyecto: { nombre: string; fechaFin: string; diasRestantes: number; jerarquia: ContextoJerarquico };
  }): Promise<void> {
    const portalUrl = this.config.get<string>('PORTAL_URL') ?? 'http://localhost:4200';
    const plazo = params.proyecto.diasRestantes === 0
      ? 'vence hoy'
      : `en ${params.proyecto.diasRestantes} ${params.proyecto.diasRestantes === 1 ? 'día' : 'días'}`;
    await this.enviarATodos(
      params.destinatarios,
      `Proyecto próximo a vencer — ${breadcrumbJerarquiaTexto(params.proyecto.jerarquia)} (${plazo})`,
      dest => proyectoPorVencerHtml({
        destinatario:  dest.nombre,
        nombre:        params.proyecto.nombre,
        fechaFin:      params.proyecto.fechaFin,
        diasRestantes: params.proyecto.diasRestantes,
        jerarquia:     params.proyecto.jerarquia,
        portalUrl,
      }),
      'proyecto-por-vencer',
    );
  }

  async notificarActividadPorVencer(params: {
    destinatarios: { nombre: string; email: string }[];
    actividad: { nombre: string; fecha: string; diasRestantes: number; jerarquia: ContextoJerarquico; documentos?: string[] };
  }): Promise<void> {
    const portalUrl = this.config.get<string>('PORTAL_URL') ?? 'http://localhost:4200';
    const plazo = params.actividad.diasRestantes === 0
      ? 'vence hoy'
      : `en ${params.actividad.diasRestantes} ${params.actividad.diasRestantes === 1 ? 'día' : 'días'}`;
    await this.enviarATodos(
      params.destinatarios,
      `Actividad próxima — ${params.actividad.nombre} — ${breadcrumbJerarquiaTexto(params.actividad.jerarquia)} (${plazo})`,
      dest => actividadPorVencerHtml({
        destinatario:  dest.nombre,
        nombre:        params.actividad.nombre,
        fecha:         params.actividad.fecha,
        diasRestantes: params.actividad.diasRestantes,
        jerarquia:     params.actividad.jerarquia,
        documentos:    params.actividad.documentos ?? [],
        portalUrl,
      }),
      'actividad-por-vencer',
    );
  }

  async notificarProyectoCerrado(params: {
    destinatarios: { nombre: string; email: string }[];
    proyecto: { nombre: string; jerarquia: ContextoJerarquico };
  }): Promise<void> {
    const portalUrl = this.config.get<string>('PORTAL_URL') ?? 'http://localhost:4200';
    await this.enviarATodos(
      params.destinatarios,
      `Proyecto cerrado — ${breadcrumbJerarquiaTexto(params.proyecto.jerarquia)}`,
      dest => proyectoCerradoHtml({
        destinatario: dest.nombre,
        nombre:       params.proyecto.nombre,
        jerarquia:    params.proyecto.jerarquia,
        portalUrl,
      }),
      'proyecto-cerrado',
    );
  }
}
