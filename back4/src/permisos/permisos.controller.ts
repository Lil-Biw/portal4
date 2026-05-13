import {
  Controller, Get, Post, Delete, Param, Body,
} from '@nestjs/common';
import { AsignarPermisoDto } from './permisos.dto';
import { PermisosService } from './permisos.service';

@Controller('permisos')
export class PermisosController {
  constructor(private readonly permisosService: PermisosService) {}

  @Post()
  asignar(@Body() dto: AsignarPermisoDto) {
    return this.permisosService.asignar(dto);
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
