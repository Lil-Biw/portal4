import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { ActividadesService } from './actividades.service';
import { Roles } from '../common/guards/guards';

@Controller('actividades')
@Roles('super_admin', 'admin_smartclarity')
export class ActividadesAdminController {
  constructor(private readonly svc: ActividadesService) {}

  @Get()
  findAll(
    @Query('centro_costo_id') centroCostoId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Req() req?: Request,
  ) {
    const user = (req as any)?.user;
    if (user?.rol === 'admin_smartclarity' && user?.cliente_id) {
      return this.svc.findAllByEmpresa(user.cliente_id, centroCostoId, desde, hasta);
    }
    return this.svc.findAll(centroCostoId, desde, hasta);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }
}
