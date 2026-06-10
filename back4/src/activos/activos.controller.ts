import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ActivosService } from './activos.service';
import { CreateActivoDto, UpdateActivoDto } from './activos.dto';
import { EmpresaAccessGuard, Roles } from '../common/guards/guards';

@Controller('empresas/:empresaId/centros/:centroId/activos')
@UseGuards(EmpresaAccessGuard)
export class ActivosController {
  constructor(private readonly activosService: ActivosService) {}

  @Get()
  findAll(@Param('centroId') centroId: string) {
    return this.activosService.findAll(centroId);
  }

  @Get(':activoId')
  findOne(@Param('activoId') activoId: string) {
    return this.activosService.findOne(activoId);
  }

  @Post()
  @Roles('super_admin', 'admin_smartclarity')
  create(@Param('centroId') centroId: string, @Body() dto: CreateActivoDto) {
    return this.activosService.create({ ...dto, centro_costo_id: centroId });
  }

  @Put(':activoId')
  @Roles('super_admin', 'admin_smartclarity')
  update(@Param('activoId') activoId: string, @Body() dto: UpdateActivoDto) {
    return this.activosService.update(activoId, dto);
  }

  @Delete(':activoId')
  @Roles('super_admin', 'admin_smartclarity')
  remove(@Param('activoId') activoId: string) {
    return this.activosService.remove(activoId);
  }
}
