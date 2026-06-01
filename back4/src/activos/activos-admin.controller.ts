import { Controller, Get, Param, Query } from '@nestjs/common';
import { ActivosService } from './activos.service';
import { Roles } from '../common/guards/guards';

@Controller('activos')
@Roles('super_admin')
export class ActivosAdminController {
  constructor(private readonly svc: ActivosService) {}

  @Get()
  findAll(@Query('centro_costo_id') centroCostoId?: string) {
    return this.svc.findAll(centroCostoId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }
}
