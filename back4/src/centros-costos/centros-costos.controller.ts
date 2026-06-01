import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { CentrosCostosService } from './centros-costos.service';
import { CreateCentroCostoDto, UpdateCentroCostoDto, AgregarDocumentoDto } from './centros-costos.dto';
import { EmpresaAccessGuard, Roles } from '../common/guards/guards';

@Controller('empresas/:empresaId/centros')
@UseGuards(EmpresaAccessGuard)
export class CentrosCostosController {
  constructor(private readonly centrosCostosService: CentrosCostosService) {}

  @Post()
  @Roles('super_admin')
  create(@Param('empresaId') empresaId: string, @Body() dto: CreateCentroCostoDto) {
    return this.centrosCostosService.create({ ...dto, cliente_id: empresaId });
  }

  @Get()
  findAll(
    @Param('empresaId') empresaId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.centrosCostosService.findAllByCliente(empresaId, +page, +limit);
  }

  @Get(':centroId')
  findOne(@Param('centroId') centroId: string) {
    return this.centrosCostosService.findOne(centroId);
  }

  @Put(':centroId')
  @Roles('super_admin')
  update(@Param('centroId') centroId: string, @Body() dto: UpdateCentroCostoDto) {
    return this.centrosCostosService.update(centroId, dto);
  }

  @Delete(':centroId')
  @Roles('super_admin')
  remove(@Param('centroId') centroId: string) {
    return this.centrosCostosService.remove(centroId);
  }

  @Post(':centroId/documentos')
  @Roles('super_admin')
  agregarDocumento(
    @Param('centroId') centroId: string,
    @Body() dto: AgregarDocumentoDto,
  ) {
    return this.centrosCostosService.agregarDocumento(centroId, dto);
  }

  @Delete(':centroId/documentos/:docId')
  @Roles('super_admin')
  eliminarDocumento(
    @Param('centroId') centroId: string,
    @Param('docId') docId: string,
  ) {
    return this.centrosCostosService.eliminarDocumento(centroId, docId);
  }
}
