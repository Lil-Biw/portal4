import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, UseGuards, Res,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ProyectosService } from './proyectos.service';
import { CreateProyectoDto, UpdateProyectoDto } from './proyectos.dto';
import { EmpresaAccessGuard, Roles } from '../common/guards/guards';

@Controller('empresas/:empresaId/centros/:centroId/proyectos')
@UseGuards(EmpresaAccessGuard)
export class ProyectosController {
  constructor(private readonly proyectosService: ProyectosService) {}

  @Post()
  @Roles('super_admin')
  create(
    @Param('empresaId') empresaId: string,
    @Param('centroId') centroId: string,
    @Body() dto: CreateProyectoDto,
  ) {
    return this.proyectosService.create({ ...dto, cliente_id: empresaId, centro_costo_id: centroId });
  }

  @Get()
  findAll(
    @Param('centroId') centroId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.proyectosService.findAllByCentro(centroId, +page, +limit);
  }

  @Get(':proyectoId')
  findOne(@Param('proyectoId') proyectoId: string) {
    return this.proyectosService.findOne(proyectoId);
  }

  @Put(':proyectoId')
  @Roles('super_admin')
  update(@Param('proyectoId') proyectoId: string, @Body() dto: UpdateProyectoDto) {
    return this.proyectosService.update(proyectoId, dto);
  }

  @Delete(':proyectoId')
  @Roles('super_admin')
  remove(@Param('proyectoId') proyectoId: string) {
    return this.proyectosService.remove(proyectoId);
  }

  @Post(':proyectoId/documentos')
  @Roles('super_admin')
  @UseInterceptors(FileInterceptor('archivo', { storage: memoryStorage() }))
  subirDocumento(
    @Param('proyectoId') proyectoId: string,
    @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
    @Body('nombre_display') nombreDisplay?: string,
  ) {
    if (!archivo) throw new BadRequestException('No se proporcionó archivo');
    return this.proyectosService.agregarDocumento(proyectoId, archivo, nombreDisplay);
  }

  @Get(':proyectoId/documentos')
  listarDocumentos(@Param('proyectoId') proyectoId: string) {
    return this.proyectosService.listarDocumentos(proyectoId);
  }

  @Get(':proyectoId/documentos/:docId')
  async descargarDocumento(
    @Param('proyectoId') proyectoId: string,
    @Param('docId') docId: string,
    @Res() res: Response,
  ) {
    const { buffer, tipo_mime, nombre_display } = await this.proyectosService.servirDocumento(proyectoId, docId);
    res.setHeader('Content-Type', tipo_mime);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nombre_display)}"`);
    res.send(buffer);
  }

  @Delete(':proyectoId/documentos/:docId')
  @Roles('super_admin')
  eliminarDocumento(
    @Param('proyectoId') proyectoId: string,
    @Param('docId') docId: string,
  ) {
    return this.proyectosService.eliminarDocumento(proyectoId, docId);
  }
}
