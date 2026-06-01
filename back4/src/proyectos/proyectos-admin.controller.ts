import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProyectosService } from './proyectos.service';
import { Roles } from '../common/guards/guards';

@Controller('proyectos')
@Roles('super_admin')
export class ProyectosAdminController {
  constructor(private readonly svc: ProyectosService) {}

  @Get()
  findAll(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.svc.findAll(+page, +limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }
}
