import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import { nuevoUsuarioHtml } from './templates/nuevo-usuario.template';
import { nuevaActividadHtml } from './templates/nueva-actividad.template';
import { nuevaSolicitudHtml } from './templates/nueva-solicitud.template';
import { solicitudRechazadaHtml } from './templates/solicitud-rechazada.template';
import { nuevaNoticiaHtml } from './templates/nueva-noticia.template';
import { SC_LOGO_PATH, SC_LOGO_CID } from './templates/logo';

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
    actividad: { nombre: string; tipo: string; fecha: Date; descripcion?: string; centro: string; activos: string[] };
  }): Promise<void> {
    const portalUrl = this.config.get<string>('PORTAL_URL') ?? 'http://localhost:4200';
    const fecha = params.actividad.fecha.toLocaleDateString('es-CL', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      timeZone: 'UTC',
    });
    await this.enviarATodos(
      params.destinatarios,
      `Nueva actividad programada — ${params.actividad.centro}`,
      dest => nuevaActividadHtml({
        destinatario: dest.nombre,
        nombre:       params.actividad.nombre,
        tipo:         params.actividad.tipo,
        fecha,
        descripcion:  params.actividad.descripcion,
        centro:       params.actividad.centro,
        activos:      params.actividad.activos,
        portalUrl,
      }),
      'actividad',
    );
  }

  async notificarNuevaSolicitud(params: {
    destinatarios: { nombre: string; email: string }[];
    solicitud: { nombre: string; tipo: string; descripcion?: string; centro: string };
  }): Promise<void> {
    const portalUrl = this.config.get<string>('PORTAL_URL') ?? 'http://localhost:4200';
    await this.enviarATodos(
      params.destinatarios,
      `Nueva solicitud de documentos — ${params.solicitud.centro}`,
      dest => nuevaSolicitudHtml({
        destinatario: dest.nombre,
        nombre:       params.solicitud.nombre,
        tipo:         params.solicitud.tipo,
        descripcion:  params.solicitud.descripcion,
        centro:       params.solicitud.centro,
        portalUrl,
      }),
      'solicitud',
    );
  }

  async notificarRechazoSolicitud(params: {
    destinatarios: { nombre: string; email: string }[];
    solicitud: { nombre: string; tipo: string; motivo_rechazo: string; centro: string };
  }): Promise<void> {
    const portalUrl = this.config.get<string>('PORTAL_URL') ?? 'http://localhost:4200';
    await this.enviarATodos(
      params.destinatarios,
      `Solicitud rechazada — ${params.solicitud.nombre}`,
      dest => solicitudRechazadaHtml({
        destinatario:   dest.nombre,
        nombre:         params.solicitud.nombre,
        tipo:           params.solicitud.tipo,
        motivo_rechazo: params.solicitud.motivo_rechazo,
        centro:         params.solicitud.centro,
        portalUrl,
      }),
      'rechazo',
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
}
