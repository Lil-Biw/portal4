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

// Condiciones ($or) bajo las que un admin_smartclarity está suscrito a un scope
// dado: tiene el toggle "todas" activo (o no lo ha configurado nunca, default
// histórico), o está suscrito explícitamente a la empresa completa, o al
// centro/proyecto puntual del evento. `soloSuscritos: true` omite el toggle
// (usado por los recordatorios de vencimiento, donde el default true del
// toggle spamearía a todo admin).
//
// Reutilizar esta función en cualquier punto que arme un `$or` de
// destinatarios de notificación para admin_smartclarity — construir la
// condición a mano ahí duplica esta lógica y es lo que causó que 6 puntos de
// envío de correo (ver back4/tofix.md #17) ignoraran por completo las
// preferencias de suscripción del admin.
export function condicionSuscripcionAdmin(
  params: { empresaId: Types.ObjectId; centroId?: Types.ObjectId; proyectoId?: Types.ObjectId },
  opciones?: { soloSuscritos?: boolean },
): Record<string, unknown>[] {
  const or: Record<string, unknown>[] = [{ empresas_suscritas: params.empresaId }];
  if (!opciones?.soloSuscritos) {
    or.unshift({ notificar_todas_empresas: { $ne: false } });
  }
  if (params.centroId) or.push({ centros_suscritos: params.centroId });
  if (params.proyectoId) or.push({ proyectos_suscritos: params.proyectoId });
  return or;
}

export async function resolverAdminsSuscritos(
  usuarioModel: Model<UsuarioSuscriptor>,
  scope: ScopeDocumento,
  opciones?: { soloSuscritos?: boolean },
): Promise<{ nombre: string; email: string }[]> {
  const or = condicionSuscripcionAdmin(
    {
      empresaId: new Types.ObjectId(scope.empresaId),
      centroId: scope.tipo === 'centro' ? new Types.ObjectId(scope.centroId) : undefined,
      proyectoId: scope.tipo === 'proyecto' ? new Types.ObjectId(scope.proyectoId) : undefined,
    },
    opciones,
  );

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
