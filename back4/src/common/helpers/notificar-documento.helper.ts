import { Logger } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { MailService } from '../../mail/mail.service';
import { ContextoJerarquico } from '../../mail/templates/jerarquia';

export type ScopeDocumento =
  | { tipo: 'empresa'; empresaId: string }
  | { tipo: 'centro'; empresaId: string; centroId: string }
  | { tipo: 'proyecto'; empresaId: string; proyectoId: string };

type UsuarioSuscriptor = {
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  notificar_todas_empresas?: boolean;
  empresas_suscritas?: Types.ObjectId[];
  centros_suscritos?: Types.ObjectId[];
  proyectos_suscritos?: Types.ObjectId[];
};

// Un admin recibe la notificación si: tiene el toggle "todas" activo (o no lo ha
// configurado nunca, default histórico), o si está suscrito explícitamente
// a la empresa completa, o al centro/proyecto puntual del evento.
export async function resolverAdminsSuscritos(
  usuarioModel: Model<UsuarioSuscriptor>,
  scope: ScopeDocumento,
): Promise<{ nombre: string; email: string }[]> {
  const or: Record<string, unknown>[] = [
    { notificar_todas_empresas: { $ne: false } },
    { empresas_suscritas: new Types.ObjectId(scope.empresaId) },
  ];
  if (scope.tipo === 'centro') {
    or.push({ centros_suscritos: new Types.ObjectId(scope.centroId) });
  } else if (scope.tipo === 'proyecto') {
    or.push({ proyectos_suscritos: new Types.ObjectId(scope.proyectoId) });
  }

  const admins = await usuarioModel
    .find({ rol: { $in: ['admin_smartclarity', 'super_admin'] }, activo: true, $or: or })
    .select('nombre email')
    .lean();
  return admins.map(a => ({ nombre: (a as any).nombre, email: (a as any).email }));
}

export async function notificarDocumentoSubido(params: {
  jerarquia: ContextoJerarquico;
  nombre: string;
  categoria: string;
  usuarioId?: string;
  scope: ScopeDocumento;
  usuarioModel: Model<UsuarioSuscriptor>;
  mailService: MailService;
  logger: Logger;
}): Promise<void> {
  const admins = await resolverAdminsSuscritos(params.usuarioModel, params.scope);
  if (!admins.length) return;

  let subioPor: string | undefined;
  if (params.usuarioId && Types.ObjectId.isValid(params.usuarioId)) {
    const uploader = await params.usuarioModel
      .findById(params.usuarioId)
      .select('nombre')
      .lean();
    subioPor = uploader ? (uploader as any).nombre : undefined;
  }

  await params.mailService.notificarNuevoDocumento({
    destinatarios: admins,
    documento: { nombre: params.nombre, categoria: params.categoria, jerarquia: params.jerarquia, subioPor },
  });
}

export async function notificarSolicitudCompletada(params: {
  jerarquia: ContextoJerarquico;
  nombre: string;
  tipo: string;
  usuarioId?: string;
  scope: ScopeDocumento;
  usuarioModel: Model<UsuarioSuscriptor>;
  mailService: MailService;
  logger: Logger;
}): Promise<void> {
  const admins = await resolverAdminsSuscritos(params.usuarioModel, params.scope);
  if (!admins.length) return;

  let completadoPor: string | undefined;
  if (params.usuarioId && Types.ObjectId.isValid(params.usuarioId)) {
    const usuario = await params.usuarioModel
      .findById(params.usuarioId)
      .select('nombre')
      .lean();
    completadoPor = usuario ? (usuario as any).nombre : undefined;
  }

  await params.mailService.notificarSolicitudCompletada({
    destinatarios: admins,
    solicitud: { nombre: params.nombre, tipo: params.tipo, jerarquia: params.jerarquia, completadoPor },
  });
}
