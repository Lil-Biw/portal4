import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ProyectosService } from './proyectos.service';
import { EmpresaAccessGuard } from '../common/guards/guards';

@Controller('empresas/:empresaId/proyectos')
@UseGuards(EmpresaAccessGuard)
export class ProyectosEmpresaController {
  constructor(private readonly svc: ProyectosService) {}

  @Get()
  findAll(
    @Param('empresaId') empresaId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '100',
  ) {
    return this.svc.findAllByCliente(empresaId, +page, +limit);
  }
}
