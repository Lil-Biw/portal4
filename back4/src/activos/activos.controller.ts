import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, Req, UseGuards, Res,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { sendFile } from '../common/helpers/send-file.helper';
import { FileInterceptor } from '@nestjs/platform-express';
import { OPCIONES_SUBIDA } from '../common/constants/upload.constants';
import { ActivosService } from './activos.service';
import { CreateActivoDto, UpdateActivoDto } from './activos.dto';
import { EmpresaAccessGuard, Roles } from '../common/guards/guards';
import { ActividadesService } from '../actividades/actividades.service';

@Controller('empresas/:empresaId/centros/:centroId/activos')
@UseGuards(EmpresaAccessGuard)
export class ActivosController {
  constructor(
    private readonly activosService: ActivosService,
    private readonly actividadesService: ActividadesService,
  ) {}

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

  @Get(':activoId/documentos')
  listarDocumentos(@Param('activoId') activoId: string) {
    return this.activosService.listarDocumentos(activoId);
  }

  @Post(':activoId/documentos')
  @Roles('super_admin', 'admin_smartclarity')
  @UseInterceptors(FileInterceptor('archivo', OPCIONES_SUBIDA))
  subirDocumento(
    @Param('activoId') activoId: string,
    @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
    @Body('nombre_display') nombreDisplay?: string,
    @Body('link_url') linkUrl?: string,
  ) {
    if (!archivo && !linkUrl) throw new BadRequestException('Debes adjuntar un archivo o un link');
    return this.activosService.subirDocumento(activoId, { archivo, linkUrl }, nombreDisplay);
  }

  @Delete(':activoId/documentos/:docId')
  @Roles('super_admin', 'admin_smartclarity')
  eliminarDocumento(
    @Param('activoId') activoId: string,
    @Param('docId') docId: string,
  ) {
    return this.activosService.eliminarDocumento(activoId, docId);
  }

  @Get(':activoId/documentos/:docId')
  async descargarDocumento(
    @Param('activoId') activoId: string,
    @Param('docId') docId: string,
    @Res() res: Response,
  ) {
    const { buffer, tipo_mime, nombre_display } = await this.activosService.servirDocumento(activoId, docId);
    sendFile(res, buffer, tipo_mime, nombre_display);
  }

  @Get(':activoId/historial')
  historial(@Param('activoId') activoId: string) {
    return this.actividadesService.findByActivo(activoId);
  }
}

@Controller('activos')
@Roles('super_admin', 'admin_smartclarity')
export class ActivosAdminController {
  constructor(
    private readonly svc: ActivosService,
    private readonly actividadesSvc: ActividadesService,
  ) {}

  @Get()
  findAll(
    @Query('centro_costo_id') centroCostoId?: string,
    @Req() req?: Request,
  ) {
    const user = (req as any)?.user;
    if (user?.rol === 'admin_smartclarity' && user?.cliente_id) {
      return this.svc.findAllByEmpresa(user.cliente_id, centroCostoId);
    }
    return this.svc.findAll(centroCostoId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Get(':id/historial')
  historial(@Param('id') id: string, @Req() req: Request) {
    const user = (req as any)?.user;
    if (user?.rol === 'admin_smartclarity' && user?.cliente_id) {
      return this.actividadesSvc.findByActivoForEmpresa(id, user.cliente_id);
    }
    return this.actividadesSvc.findByActivo(id);
  }
}
