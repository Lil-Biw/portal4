import {
  Controller, Get, Post, Put, Delete, Patch,
  Param, Body, Query, UseGuards, Res, Req,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { Response } from 'express';
import { sendFile } from '../common/helpers/send-file.helper';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CentrosCostosService } from './centros-costos.service';
import { CreateCentroCostoDto, UpdateCentroCostoDto, UpdateScoreSmartclarityDto, VencerDocumentoCentroDto } from './centros-costos.dto';
import { EmpresaAccessGuard, Roles } from '../common/guards/guards';

@Controller('empresas/:empresaId/centros')
@UseGuards(EmpresaAccessGuard)
export class CentrosCostosController {
  constructor(private readonly centrosCostosService: CentrosCostosService) {}

  @Post()
  @Roles('super_admin', 'admin_smartclarity')
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
  @Roles('super_admin', 'admin_smartclarity')
  update(@Param('centroId') centroId: string, @Body() dto: UpdateCentroCostoDto) {
    return this.centrosCostosService.update(centroId, dto);
  }

  @Put(':centroId/score-smartclarity')
  @Roles('super_admin', 'admin_smartclarity')
  updateScore(
    @Param('centroId') centroId: string,
    @Body() dto: UpdateScoreSmartclarityDto,
  ) {
    return this.centrosCostosService.updateScoreSmartclarity(centroId, dto.valores);
  }

  @Delete(':centroId')
  @Roles('super_admin', 'admin_smartclarity')
  remove(@Param('centroId') centroId: string) {
    return this.centrosCostosService.remove(centroId);
  }

  @Post(':centroId/documentos')
  @Roles('super_admin', 'admin_smartclarity', 'usuario')
  @UseInterceptors(FileInterceptor('archivo', { storage: memoryStorage() }))
  subirDocumento(
    @Param('centroId') centroId: string,
    @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
    @Body('nombre_display') nombreDisplay?: string,
    @Body('categoria') categoria?: string,
    @Req() req?: Request,
  ) {
    if (!archivo) throw new BadRequestException('No se proporcionó archivo');
    const rolUploader = (req as any)?.user?.rol as string | undefined;
    const usuarioId  = (req as any)?.user?.sub as string | undefined;
    return this.centrosCostosService.agregarDocumento(centroId, archivo, nombreDisplay, categoria, usuarioId, rolUploader);
  }

  @Get(':centroId/documentos')
  listarDocumentos(@Param('centroId') centroId: string) {
    return this.centrosCostosService.listarDocumentos(centroId);
  }

  @Get(':centroId/documentos/:docId')
  async descargarDocumento(
    @Param('centroId') centroId: string,
    @Param('docId') docId: string,
    @Res() res: Response,
  ) {
    const { buffer, tipo_mime, nombre_display } = await this.centrosCostosService.servirDocumento(centroId, docId);
    sendFile(res, buffer, tipo_mime, nombre_display);
  }

  @Delete(':centroId/documentos/:docId')
  @Roles('super_admin', 'admin_smartclarity', 'usuario')
  eliminarDocumento(
    @Param('centroId') centroId: string,
    @Param('docId') docId: string,
  ) {
    return this.centrosCostosService.eliminarDocumento(centroId, docId);
  }

  @Patch(':centroId/documentos/:docId/vencer')
  @Roles('super_admin', 'admin_smartclarity')
  vencerDocumento(
    @Param('empresaId') empresaId: string,
    @Param('centroId') centroId: string,
    @Param('docId') docId: string,
    @Body() dto: VencerDocumentoCentroDto,
  ) {
    return this.centrosCostosService.vencerDocumento(centroId, docId, empresaId, dto.empresa_nombre, dto.centro_nombre, dto.notificacion);
  }
}

@Controller('centros-costos')
@Roles('super_admin', 'admin_smartclarity')
export class CentrosCostosAdminController {
  constructor(private readonly svc: CentrosCostosService) {}

  @Get()
  findAll(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.svc.findAll(+page, +limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }
}
