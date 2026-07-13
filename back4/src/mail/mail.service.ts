import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import { nuevoUsuarioHtml } from './templates/nuevo-usuario.template';
import { nuevaActividadHtml } from './templates/nueva-actividad.template';
import { nuevaSolicitudHtml } from './templates/nueva-solicitud.template';
import { solicitudRechazadaHtml } from './templates/solicitud-rechazada.template';
import { solicitudCompletadaHtml } from './templates/solicitud-completada.template';
import { nuevaNoticiaHtml } from './templates/nueva-noticia.template';
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
    actividad: { nombre: string; tipo: string; fecha: Date; descripcion?: string; jerarquia: ContextoJerarquico; activos: string[]; documentos?: string[] };
  }): Promise<void> {
    const portalUrl = this.config.get<string>('PORTAL_URL') ?? 'http://localhost:4200';
    const fecha = params.actividad.fecha.toLocaleDateString('es-CL', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      timeZone: 'UTC',
    });
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
