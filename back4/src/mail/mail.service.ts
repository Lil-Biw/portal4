import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { nuevoUsuarioHtml } from './templates/nuevo-usuario.template';
import { nuevaMantencionHtml } from './templates/nueva-mantencion.template';
import { nuevaSolicitudHtml } from './templates/nueva-solicitud.template';
import { solicitudRechazadaHtml } from './templates/solicitud-rechazada.template';
import { nuevaNoticiaHtml } from './templates/nueva-noticia.template';

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

  async notificarNuevaMantencion(params: {
    destinatarios: { nombre: string; email: string }[];
    mantencion: { nombre: string; tipo: string; fecha: Date; descripcion?: string; centro: string; activos: string[] };
  }): Promise<void> {
    const portalUrl = this.config.get<string>('PORTAL_URL') ?? 'http://localhost:4200';
    const fecha = params.mantencion.fecha.toLocaleDateString('es-CL', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

    for (const dest of params.destinatarios) {
      try {
        await this.transporter.sendMail({
          from: this.from,
          to: dest.email,
          subject: `Nueva mantención programada — ${params.mantencion.centro}`,
          html: nuevaMantencionHtml({
            destinatario: dest.nombre,
            nombre:       params.mantencion.nombre,
            tipo:         params.mantencion.tipo,
            fecha,
            descripcion:  params.mantencion.descripcion,
            centro:       params.mantencion.centro,
            activos:      params.mantencion.activos,
            portalUrl,
          }),
        });
        this.logger.log(`Notificación de mantención enviada a ${dest.email}`);
      } catch (err: unknown) {
        const mensaje = err instanceof Error ? err.message : String(err);
        this.logger.error(`Error al notificar mantención a ${dest.email}: ${mensaje}`);
      }
    }
  }

  async notificarNuevaSolicitud(params: {
    destinatarios: { nombre: string; email: string }[];
    solicitud: { nombre: string; tipo: string; descripcion?: string; centro: string };
  }): Promise<void> {
    const portalUrl = this.config.get<string>('PORTAL_URL') ?? 'http://localhost:4200';

    for (const dest of params.destinatarios) {
      try {
        await this.transporter.sendMail({
          from: this.from,
          to: dest.email,
          subject: `Nueva solicitud de documentos — ${params.solicitud.centro}`,
          html: nuevaSolicitudHtml({
            destinatario: dest.nombre,
            nombre:       params.solicitud.nombre,
            tipo:         params.solicitud.tipo,
            descripcion:  params.solicitud.descripcion,
            centro:       params.solicitud.centro,
            portalUrl,
          }),
        });
        this.logger.log(`Notificación de solicitud enviada a ${dest.email}`);
      } catch (err: unknown) {
        const mensaje = err instanceof Error ? err.message : String(err);
        this.logger.error(`Error al notificar solicitud a ${dest.email}: ${mensaje}`);
      }
    }
  }

  async notificarRechazoSolicitud(params: {
    destinatarios: { nombre: string; email: string }[];
    solicitud: { nombre: string; tipo: string; motivo_rechazo: string; centro: string };
  }): Promise<void> {
    const portalUrl = this.config.get<string>('PORTAL_URL') ?? 'http://localhost:4200';

    for (const dest of params.destinatarios) {
      try {
        await this.transporter.sendMail({
          from: this.from,
          to: dest.email,
          subject: `Solicitud rechazada — ${params.solicitud.nombre}`,
          html: solicitudRechazadaHtml({
            destinatario:   dest.nombre,
            nombre:         params.solicitud.nombre,
            tipo:           params.solicitud.tipo,
            motivo_rechazo: params.solicitud.motivo_rechazo,
            centro:         params.solicitud.centro,
            portalUrl,
          }),
        });
        this.logger.log(`Notificación de rechazo enviada a ${dest.email}`);
      } catch (err: unknown) {
        const mensaje = err instanceof Error ? err.message : String(err);
        this.logger.error(`Error al notificar rechazo a ${dest.email}: ${mensaje}`);
      }
    }
  }

  async notificarNuevaNoticia(params: {
    destinatarios: { nombre: string; email: string }[];
    noticia: { titulo: string; resumen: string; enlace: string; seccion: string };
  }): Promise<void> {
    const portalUrl = this.config.get<string>('PORTAL_URL') ?? 'http://localhost:4200';

    for (const dest of params.destinatarios) {
      try {
        await this.transporter.sendMail({
          from: this.from,
          to:   dest.email,
          subject: `[${params.noticia.seccion.charAt(0).toUpperCase() + params.noticia.seccion.slice(1)}] ${params.noticia.titulo}`,
          html: nuevaNoticiaHtml({
            destinatario: dest.nombre,
            titulo:   params.noticia.titulo,
            resumen:  params.noticia.resumen,
            enlace:   params.noticia.enlace,
            seccion:  params.noticia.seccion,
            portalUrl,
          }),
        });
        this.logger.log(`Notificación de noticia enviada a ${dest.email}`);
      } catch (err: unknown) {
        const mensaje = err instanceof Error ? err.message : String(err);
        this.logger.error(`Error al notificar noticia a ${dest.email}: ${mensaje}`);
      }
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
      });
      this.logger.log(`Correo de bienvenida enviado a ${params.email}`);
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error al enviar correo a ${params.email}: ${mensaje}`);
    }
  }
}
