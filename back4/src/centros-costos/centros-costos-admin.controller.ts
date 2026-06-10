import { Controller, Get, Param, Query } from '@nestjs/common';
import { CentrosCostosService } from './centros-costos.service';
import { Roles } from '../common/guards/guards';

@Controller('centros-costos')
@Roles('super_admin', 'admin_smartclarity')
export class CentrosCostosAdminController {
  constructor(private readonly svc: CentrosCostosService) {}

  @Get()
  findAll(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.svc.findAll(+page, +limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }
}
