import {
  Controller, Get, Post, Put, Delete,
  Param, Body, UseGuards, Res,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ActivosService } from './activos.service';
import { CreateActivoDto, UpdateActivoDto } from './activos.dto';
import { EmpresaAccessGuard, Roles } from '../common/guards/guards';

@Controller('empresas/:empresaId/centros/:centroId/activos')
@UseGuards(EmpresaAccessGuard)
export class ActivosController {
  constructor(private readonly activosService: ActivosService) {}

  @Get()
  findAll(@Param('centroId') centroId: string) {
    return this.activosService.findAll(centroId);
  }

  @Get(':activoId')
  findOne(@Param('activoId') activoId: string) {
    return this.activosService.findOne(activoId);
  }

  @Post()
  @Roles('super_admin', 'admin_smartclarity')
  create(@Param('centroId') centroId: string, @Body() dto: CreateActivoDto) {
    return this.activosService.create({ ...dto, centro_costo_id: centroId });
  }

  @Put(':activoId')
  @Roles('super_admin', 'admin_smartclarity')
  update(@Param('activoId') activoId: string, @Body() dto: UpdateActivoDto) {
    return this.activosService.update(activoId, dto);
  }

  @Delete(':activoId')
  @Roles('super_admin', 'admin_smartclarity')
  remove(@Param('activoId') activoId: string) {
    return this.activosService.remove(activoId);
  }

  @Post(':activoId/documentos')
  @Roles('super_admin', 'admin_smartclarity')
  @UseInterceptors(FileInterceptor('archivo', { storage: memoryStorage() }))
  subirDocumento(
    @Param('activoId') activoId: string,
    @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
    @Body('nombre_display') nombreDisplay?: string,
  ) {
    if (!archivo) throw new BadRequestException('No se proporcionó archivo');
    return this.activosService.subirDocumento(activoId, archivo, nombreDisplay);
  }

  @Delete(':activoId/documentos/:nombre')
  @Roles('super_admin', 'admin_smartclarity')
  eliminarDocumento(
    @Param('activoId') activoId: string,
    @Param('nombre') nombre: string,
  ) {
    return this.activosService.eliminarDocumento(activoId, nombre);
  }

  @Get(':activoId/documentos/:nombre')
  async descargarDocumento(
    @Param('activoId') activoId: string,
    @Param('nombre') nombre: string,
    @Res() res: Response,
  ) {
    const { buffer, tipo_mime, nombre_display } = await this.activosService.servirDocumento(activoId, nombre);
    res.setHeader('Content-Type', tipo_mime);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nombre_display)}"`);
    res.send(buffer);
  }
}
