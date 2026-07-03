import { Controller, ForbiddenException, Get, Param, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Roles } from '../common/guards/guards';
import { DocumentosVencidosService } from './documentos-vencidos.service';

interface JwtUser {
  rol?: string;
  cliente_id?: string;
}

@Controller('documentos-vencidos')
export class DocumentosVencidosController {
  constructor(private readonly service: DocumentosVencidosService) {}

  // Retorna el cliente_id del usuario si su acceso está restringido a su
  // propia empresa, o undefined si es admin global.
  private empresaRestringida(req: Request): string | undefined {
    const user = (req as { user?: JwtUser }).user;
    if (user?.rol === 'super_admin' || user?.rol === 'admin_smartclarity') return undefined;
    if (!user?.cliente_id) throw new ForbiddenException('Tu usuario no tiene empresa asignada');
    return String(user.cliente_id);
  }

  @Get()
  @Roles('super_admin', 'admin_smartclarity', 'usuario')
  listar(
    @Query('empresaId')  empresaId: string,
    @Req() req: Request,
    @Query('centroId')   centroId?: string,
    @Query('proyectoId') proyectoId?: string,
    @Query('tipo')       tipo?: string,
  ) {
    const restringida = this.empresaRestringida(req);
    if (restringida && restringida !== String(empresaId)) {
      throw new ForbiddenException('No puedes ver documentos de otra empresa');
    }
    return this.service.listarUltimos20(empresaId, centroId, proyectoId, tipo);
  }

  @Get(':id')
  @Roles('super_admin', 'admin_smartclarity', 'usuario')
  async descargar(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const { buffer, tipo_mime, nombre_display } = await this.service.descargar(
      id,
      this.empresaRestringida(req),
    );
    res.set({
      'Content-Type': tipo_mime || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(nombre_display)}"`,
    });
    res.send(buffer);
  }
}
