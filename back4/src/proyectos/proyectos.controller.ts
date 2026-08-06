import {
  Controller, Get, Post, Put, Delete, Patch,
  Param, Body, Query, UseGuards, Res, Req,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { sendFile } from '../common/helpers/send-file.helper';
import { FileInterceptor } from '@nestjs/platform-express';
import { OPCIONES_SUBIDA } from '../common/constants/upload.constants';
import { ProyectosService } from './proyectos.service';
import { CreateProyectoDto, UpdateProyectoDto, VencerDocumentoProyectoDto } from './proyectos.dto';
import { EmpresaAccessGuard, Roles } from '../common/guards/guards';

@Controller('empresas/:empresaId/centros/:centroId/proyectos')
@UseGuards(EmpresaAccessGuard)
export class ProyectosController {
  constructor(private readonly proyectosService: ProyectosService) {}

  @Post()
  @Roles('super_admin', 'admin_smartclarity')
  create(
    @Param('empresaId') empresaId: string,
    @Param('centroId') centroId: string,
    @Body() dto: CreateProyectoDto,
  ) {
    const centro_costo_ids = dto.centro_costo_ids?.length ? dto.centro_costo_ids : [centroId];
    return this.proyectosService.create({ ...dto, cliente_id: empresaId, centro_costo_ids });
  }

  @Get()
  findAll(
    @Param('centroId') centroId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '500',
  ) {
    return this.proyectosService.findAllByCentro(centroId, +page, +limit);
  }

  @Get(':proyectoId')
  findOne(@Param('proyectoId') proyectoId: string) {
    return this.proyectosService.findOne(proyectoId);
  }

  @Put(':proyectoId')
  @Roles('super_admin', 'admin_smartclarity')
  update(@Param('proyectoId') proyectoId: string, @Body() dto: UpdateProyectoDto) {
    return this.proyectosService.update(proyectoId, dto);
  }

  @Delete(':proyectoId')
  @Roles('super_admin', 'admin_smartclarity')
  remove(@Param('proyectoId') proyectoId: string) {
    return this.proyectosService.remove(proyectoId);
  }

  @Post(':proyectoId/documentos')
  @Roles('super_admin', 'admin_smartclarity', 'usuario')
  @UseInterceptors(FileInterceptor('archivo', OPCIONES_SUBIDA))
  subirDocumento(
    @Param('proyectoId') proyectoId: string,
    @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
    @Body('nombre_display') nombreDisplay?: string,
    @Body('categoria') categoria?: string,
    @Body('link_url') linkUrl?: string,
    @Req() req?: Request,
  ) {
    if (!archivo && !linkUrl) throw new BadRequestException('Debes adjuntar un archivo o un link');
    const rolUploader = (req as any)?.user?.rol as string | undefined;
    const usuarioId  = (req as any)?.user?.sub as string | undefined;
    return this.proyectosService.agregarDocumento(proyectoId, { archivo, linkUrl }, nombreDisplay, categoria, usuarioId, rolUploader);
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
    sendFile(res, buffer, tipo_mime, nombre_display);
  }

  @Patch(':proyectoId/documentos/:docId')
  @Roles('super_admin', 'admin_smartclarity')
  actualizarDocumento(
    @Param('proyectoId') proyectoId: string,
    @Param('docId') docId: string,
    @Body('categoria') categoria: string,
  ) {
    if (!categoria?.trim()) throw new BadRequestException('Debes indicar una categoría');
    return this.proyectosService.actualizarDocumento(proyectoId, docId, categoria.trim());
  }

  @Delete(':proyectoId/documentos/:docId')
  @Roles('super_admin', 'admin_smartclarity', 'usuario')
  eliminarDocumento(
    @Param('proyectoId') proyectoId: string,
    @Param('docId') docId: string,
  ) {
    return this.proyectosService.eliminarDocumento(proyectoId, docId);
  }

  @Patch(':proyectoId/documentos/:docId/vencer')
  @Roles('super_admin', 'admin_smartclarity')
  vencerDocumento(
    @Param('empresaId')  empresaId:  string,
    @Param('centroId')   centroId:   string,
    @Param('proyectoId') proyectoId: string,
    @Param('docId')      docId:      string,
    @Body() dto: VencerDocumentoProyectoDto,
  ) {
    return this.proyectosService.vencerDocumento(
      proyectoId, docId, empresaId, centroId,
      dto.empresa_nombre, dto.centro_nombre, dto.proyecto_nombre,
      dto.notificacion,
    );
  }
}

@Controller('proyectos')
@Roles('super_admin', 'admin_smartclarity')
export class ProyectosAdminController {
  constructor(private readonly svc: ProyectosService) {}

  @Get()
  findAll(@Query('page') page = '1', @Query('limit') limit = '500', @Query('estado') estado?: string) {
    return this.svc.findAll(+page, +limit, estado);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }
}

@Controller('empresas/:empresaId/proyectos')
@UseGuards(EmpresaAccessGuard)
export class ProyectosEmpresaController {
  constructor(private readonly svc: ProyectosService) {}

  @Get()
  findAll(
    @Param('empresaId') empresaId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '500',
  ) {
    return this.svc.findAllByCliente(empresaId, +page, +limit);
  }
}
