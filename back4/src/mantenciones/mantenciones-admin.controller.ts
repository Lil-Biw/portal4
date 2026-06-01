import { Controller, Get, Param, Query } from '@nestjs/common';
import { MantencionesService } from './mantenciones.service';
import { Roles } from '../common/guards/guards';

@Controller('mantenciones')
@Roles('super_admin')
export class MantencionesAdminController {
  constructor(private readonly svc: MantencionesService) {}

  @Get()
  findAll(
    @Query('centro_costo_id') centroCostoId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.svc.findAll(centroCostoId, desde, hasta);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }
}
