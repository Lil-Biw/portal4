import {
  Controller, Get, Post, Delete, Param, Body, Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AsignarPermisoDto } from './permisos.dto';
import { PermisosService } from './permisos.service';
import { Roles } from '../common/guards/guards';

@Controller('permisos')
@Roles('super_admin', 'admin_smartclarity')
export class PermisosController {
  constructor(private readonly permisosService: PermisosService) {}

  @Post()
  asignar(@Body() dto: AsignarPermisoDto, @Req() req: Request) {
    const asignadoPor = (req as any).user.sub as string;
    return this.permisosService.asignar(dto, asignadoPor);
  }

  @Get('usuario/:usuarioId')
  findByUsuario(@Param('usuarioId') usuarioId: string) {
    return this.permisosService.findByUsuario(usuarioId);
  }

  @Get('centro/:centroId')
  findByCentro(@Param('centroId') centroId: string) {
    return this.permisosService.findByCentro(centroId);
  }

  @Delete('usuario/:usuarioId/centro/:centroId')
  revocar(
    @Param('usuarioId') usuarioId: string,
    @Param('centroId') centroId: string,
  ) {
    return this.permisosService.revocar(usuarioId, centroId);
  }
}
