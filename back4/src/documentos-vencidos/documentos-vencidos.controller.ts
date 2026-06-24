import { Controller, Get, Query } from '@nestjs/common';
import { DocumentosVencidosService } from './documentos-vencidos.service';

@Controller('documentos-vencidos')
export class DocumentosVencidosController {
  constructor(private readonly service: DocumentosVencidosService) {}

  @Get()
  listar(
    @Query('empresaId') empresaId: string,
    @Query('centroId')   centroId?: string,
    @Query('proyectoId') proyectoId?: string,
  ) {
    return this.service.listarUltimos20(empresaId, centroId, proyectoId);
  }
}
