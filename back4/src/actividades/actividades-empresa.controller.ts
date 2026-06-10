import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ActividadesService } from './actividades.service';
import { EmpresaAccessGuard } from '../common/guards/guards';

@Controller('empresas/:empresaId/actividades')
@UseGuards(EmpresaAccessGuard)
export class ActividadesEmpresaController {
  constructor(private readonly svc: ActividadesService) {}

  @Get()
  findAll(@Param('empresaId') empresaId: string) {
    return this.svc.findAllByEmpresa(empresaId);
  }
}
