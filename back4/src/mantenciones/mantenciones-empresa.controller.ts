import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { MantencionesService } from './mantenciones.service';
import { EmpresaAccessGuard } from '../common/guards/guards';

@Controller('empresas/:empresaId/mantenciones')
@UseGuards(EmpresaAccessGuard)
export class MantencionesEmpresaController {
  constructor(private readonly svc: MantencionesService) {}

  @Get()
  findAll(@Param('empresaId') empresaId: string) {
    return this.svc.findAllByEmpresa(empresaId);
  }
}
