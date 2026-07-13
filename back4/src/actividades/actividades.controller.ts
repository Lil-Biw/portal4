import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, Req, Res, UseGuards,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { sendFile } from '../common/helpers/send-file.helper';
import { FileInterceptor } from '@nestjs/platform-express';
import { OPCIONES_SUBIDA } from '../common/constants/upload.constants';
import { ActividadesService } from './actividades.service';
import { CreateActividadDto, UpdateActividadDto } from './actividades.dto';
import { EmpresaAccessGuard, Roles } from '../common/guards/guards';

@Controller('empresas/:empresaId/centros/:centroId/actividades')
@UseGuards(EmpresaAccessGuard)
export class ActividadesController {
  constructor(private readonly service: ActividadesService) {}

  @Get()
  findAll(
    @Param('centroId') centroId: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.service.findAll(centroId, desde, hasta);
  }

  @Get(':actividadId')
  findOne(@Param('actividadId') actividadId: string) {
    return this.service.findOne(actividadId);
  }

  @Post()
  @Roles('super_admin', 'admin_smartclarity')
  create(@Param('centroId') centroId: string, @Body() dto: CreateActividadDto) {
    return this.service.create({ ...dto, centro_costo_id: centroId });
  }

  @Put(':actividadId')
  @Roles('super_admin', 'admin_smartclarity')
  update(@Param('actividadId') actividadId: string, @Body() dto: UpdateActividadDto) {
    return this.service.update(actividadId, dto);
  }

  @Delete(':actividadId')
  @Roles('super_admin', 'admin_smartclarity')
  remove(@Param('actividadId') actividadId: string) {
    return this.service.remove(actividadId);
  }

  @Get(':actividadId/documentos')
  listarDocumentos(@Param('actividadId') actividadId: string) {
    return this.service.listarDocumentos(actividadId);
  }

  @Post(':actividadId/documentos')
  @Roles('super_admin', 'admin_smartclarity')
  @UseInterceptors(FileInterceptor('archivo', OPCIONES_SUBIDA))
  subirDocumento(
    @Param('actividadId') actividadId: string,
    @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
    @Body('nombre_display') nombreDisplay?: string,
    @Body('link_url') linkUrl?: string,
  ) {
    if (!archivo && !linkUrl) throw new BadRequestException('Debes adjuntar un archivo o un link');
    return this.service.subirDocumento(actividadId, { archivo, linkUrl }, nombreDisplay);
  }

  @Delete(':actividadId/documentos/:docId')
  @Roles('super_admin', 'admin_smartclarity')
  eliminarDocumento(
    @Param('actividadId') actividadId: string,
    @Param('docId') docId: string,
  ) {
    return this.service.eliminarDocumento(actividadId, docId);
  }

  @Get(':actividadId/documentos/:docId')
  async descargarDocumento(
    @Param('actividadId') actividadId: string,
    @Param('docId') docId: string,
    @Res() res: Response,
  ) {
    const { buffer, tipo_mime, nombre_display } = await this.service.servirDocumento(actividadId, docId);
    sendFile(res, buffer, tipo_mime, nombre_display);
  }
}

@Controller('empresas/:empresaId/actividades')
@UseGuards(EmpresaAccessGuard)
export class ActividadesEmpresaController {
  constructor(private readonly svc: ActividadesService) {}

  @Get()
  findAll(@Param('empresaId') empresaId: string) {
    return this.svc.findAllByEmpresa(empresaId);
  }
}

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
