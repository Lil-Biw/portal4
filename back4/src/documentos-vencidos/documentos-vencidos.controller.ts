import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { Roles } from '../common/guards/guards';
import { DocumentosVencidosService } from './documentos-vencidos.service';

@Controller('documentos-vencidos')
export class DocumentosVencidosController {
  constructor(private readonly service: DocumentosVencidosService) {}

  @Get()
  @Roles('super_admin', 'admin_smartclarity', 'usuario')
  listar(
    @Query('empresaId')  empresaId: string,
    @Query('centroId')   centroId?: string,
    @Query('proyectoId') proyectoId?: string,
    @Query('tipo')       tipo?: string,
  ) {
    return this.service.listarUltimos20(empresaId, centroId, proyectoId, tipo);
  }

  @Get(':id')
  @Roles('super_admin', 'admin_smartclarity', 'usuario')
  async descargar(@Param('id') id: string, @Res() res: Response) {
    const { buffer, tipo_mime, nombre_display } = await this.service.descargar(id);
    res.set({
      'Content-Type': tipo_mime || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(nombre_display)}"`,
    });
    res.send(buffer);
  }
}
