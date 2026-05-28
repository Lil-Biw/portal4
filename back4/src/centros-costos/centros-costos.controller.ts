import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query,
} from '@nestjs/common';
import { CentrosCostosService } from './centros-costos.service';
import { CreateCentroCostoDto, UpdateCentroCostoDto, AgregarDocumentoDto } from './centros-costos.dto';
import { Roles } from '../common/guards/guards';

@Controller('centros-costos')
export class CentrosCostosController {
  constructor(private readonly centrosCostosService: CentrosCostosService) {}

  @Post()
  @Roles('super_admin')
  create(@Body() dto: CreateCentroCostoDto) {
    return this.centrosCostosService.create(dto);
  }

  @Get()
  findAll(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.centrosCostosService.findAll(+page, +limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.centrosCostosService.findOne(id);
  }

  @Put(':id')
  @Roles('super_admin')
  update(@Param('id') id: string, @Body() dto: UpdateCentroCostoDto) {
    return this.centrosCostosService.update(id, dto);
  }

  @Delete(':id')
  @Roles('super_admin')
  remove(@Param('id') id: string) {
    return this.centrosCostosService.remove(id);
  }

  @Post(':centroCostoId/documentos')
  @Roles('super_admin')
  agregarDocumento(
    @Param('centroCostoId') id: string,
    @Body() dto: AgregarDocumentoDto,
  ) {
    return this.centrosCostosService.agregarDocumento(id, dto);
  }

  @Delete(':centroCostoId/documentos/:docId')
  @Roles('super_admin')
  eliminarDocumento(
    @Param('centroCostoId') centroCostoId: string,
    @Param('docId') docId: string,
  ) {
    return this.centrosCostosService.eliminarDocumento(centroCostoId, docId);
  }
}
