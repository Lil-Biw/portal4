import { Logger } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { MailService } from '../../mail/mail.service';

export async function notificarDocumentoSubido(params: {
  contexto: string;
  nombre: string;
  categoria: string;
  usuarioId?: string;
  usuarioModel: Model<{ nombre: string; email: string; rol: string; activo: boolean }>;
  mailService: MailService;
  logger: Logger;
}): Promise<void> {
  const admins = await params.usuarioModel
    .find({ rol: { $in: ['admin_smartclarity', 'super_admin'] }, activo: true })
    .select('nombre email')
    .lean();
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
    destinatarios: admins.map(a => ({ nombre: (a as any).nombre, email: (a as any).email })),
    documento: { nombre: params.nombre, categoria: params.categoria, contexto: params.contexto, subioPor },
  });
}
