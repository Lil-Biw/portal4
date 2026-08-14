import {
  Controller, Get, Post, Put, Delete, Patch,
  Param, Body, Query, UseGuards, Res, Req,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { Response } from 'express';
import { sendFile } from '../common/helpers/send-file.helper';
import { FileInterceptor } from '@nestjs/platform-express';
import { OPCIONES_SUBIDA } from '../common/constants/upload.constants';
import { CentrosCostosService } from './centros-costos.service';
import { CreateCentroCostoDto, UpdateCentroCostoDto, UpdateScoreSmartclarityDto, VencerDocumentoCentroDto } from './centros-costos.dto';
import { EmpresaAccessGuard, Roles, Public, RequiereAccion } from '../common/guards/guards';

interface JwtUser {
  sub: string;
  email: string;
  rol: string;
  cliente_id?: string;
}

@Controller('empresas/:empresaId/centros')
@UseGuards(EmpresaAccessGuard)
export class CentrosCostosController {
  constructor(private readonly centrosCostosService: CentrosCostosService) {}

  @Post()
  @RequiereAccion('centros', 'crear')
  create(@Param('empresaId') empresaId: string, @Body() dto: CreateCentroCostoDto) {
    return this.centrosCostosService.create({ ...dto, cliente_id: empresaId });
  }

  @Get()
  findAll(
    @Param('empresaId') empresaId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Req() req?: Request,
  ) {
    const user = (req as any)?.user as JwtUser;
    return this.centrosCostosService.findAllByCliente(empresaId, +page, +limit, user && { sub: user.sub, rol: user.rol });
  }

  @Get(':centroId')
  findOne(@Param('empresaId') empresaId: string, @Param('centroId') centroId: string, @Req() req: Request) {
    const user = (req as any)?.user as JwtUser;
    return this.centrosCostosService.findOne(centroId, empresaId, user && { sub: user.sub, rol: user.rol });
  }

  @Put(':centroId')
  @RequiereAccion('centros', 'editar')
  update(@Param('empresaId') empresaId: string, @Param('centroId') centroId: string, @Body() dto: UpdateCentroCostoDto) {
    return this.centrosCostosService.update(centroId, dto, empresaId);
  }

  @Put(':centroId/score-smartclarity')
  @RequiereAccion('centros', 'editar')
  updateScore(
    @Param('empresaId') empresaId: string,
    @Param('centroId') centroId: string,
    @Body() dto: UpdateScoreSmartclarityDto,
  ) {
    return this.centrosCostosService.updateScoreSmartclarity(centroId, dto.valores, empresaId);
  }

  @Post(':centroId/foto')
  @RequiereAccion('centros', 'editar')
  @UseInterceptors(FileInterceptor('archivo', OPCIONES_SUBIDA))
  subirFoto(
    @Param('empresaId') empresaId: string,
    @Param('centroId') centroId: string,
    @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
  ) {
    if (!archivo) throw new BadRequestException('No se proporcionó archivo');
    return this.centrosCostosService.subirFoto(centroId, archivo, empresaId);
  }

  @Get(':centroId/foto')
  @Public()
  async servirFoto(@Param('centroId') centroId: string, @Res() res: Response) {
    const { buffer, tipo_mime, nombre } = await this.centrosCostosService.servirFoto(centroId);
    sendFile(res, buffer, tipo_mime, nombre, true);
  }

  @Delete(':centroId')
  @RequiereAccion('centros', 'eliminar')
  remove(@Param('empresaId') empresaId: string, @Param('centroId') centroId: string) {
    return this.centrosCostosService.remove(centroId, empresaId);
  }

  @Post(':centroId/documentos')
  @RequiereAccion('docCentro', 'subir')
  @UseInterceptors(FileInterceptor('archivo', OPCIONES_SUBIDA))
  subirDocumento(
    @Param('empresaId') empresaId: string,
    @Param('centroId') centroId: string,
    @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
    @Body('nombre_display') nombreDisplay?: string,
    @Body('categoria') categoria?: string,
    @Body('link_url') linkUrl?: string,
    @Req() req?: Request,
  ) {
    if (!archivo && !linkUrl) throw new BadRequestException('Debes adjuntar un archivo o un link');
    const rolUploader = (req as any)?.user?.rol as string | undefined;
    const usuarioId  = (req as any)?.user?.sub as string | undefined;
    return this.centrosCostosService.agregarDocumento(centroId, { archivo, linkUrl }, nombreDisplay, categoria, usuarioId, rolUploader, empresaId);
  }

  @Get(':centroId/documentos')
  listarDocumentos(@Param('empresaId') empresaId: string, @Param('centroId') centroId: string, @Req() req: Request) {
    const user = (req as any)?.user as JwtUser;
    return this.centrosCostosService.listarDocumentos(centroId, empresaId, user && { sub: user.sub, rol: user.rol });
  }

  @Get(':centroId/documentos/:docId')
  async descargarDocumento(
    @Param('empresaId') empresaId: string,
    @Param('centroId') centroId: string,
    @Param('docId') docId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const user = (req as any)?.user as JwtUser;
    const { buffer, tipo_mime, nombre_display } = await this.centrosCostosService.servirDocumento(centroId, docId, empresaId, user && { sub: user.sub, rol: user.rol });
    sendFile(res, buffer, tipo_mime, nombre_display);
  }

  @Patch(':centroId/documentos/:docId')
  @RequiereAccion('docCentro', 'editarCategoria')
  actualizarDocumento(
    @Param('empresaId') empresaId: string,
    @Param('centroId') centroId: string,
    @Param('docId') docId: string,
    @Body('categoria') categoria: string | undefined,
    @Body('nombre_display') nombreDisplay: string | undefined,
    @Req() req: Request,
  ) {
    const user = (req as any)?.user as JwtUser;
    const solicitante = user && { sub: user.sub, rol: user.rol };
    if (nombreDisplay !== undefined) {
      if (!nombreDisplay.trim()) throw new BadRequestException('Debes indicar un nombre');
      return this.centrosCostosService.renombrarDocumento(centroId, docId, nombreDisplay.trim(), empresaId, solicitante);
    }
    if (!categoria?.trim()) throw new BadRequestException('Debes indicar una categoría');
    return this.centrosCostosService.actualizarDocumento(centroId, docId, categoria.trim(), empresaId, solicitante);
  }

  @Delete(':centroId/documentos/:docId')
  @RequiereAccion('docCentro', 'eliminar')
  eliminarDocumento(
    @Param('empresaId') empresaId: string,
    @Param('centroId') centroId: string,
    @Param('docId') docId: string,
    @Req() req: Request,
  ) {
    const user = (req as any)?.user as JwtUser;
    return this.centrosCostosService.eliminarDocumento(centroId, docId, empresaId, user && { sub: user.sub, rol: user.rol });
  }

  @Patch(':centroId/documentos/:docId/vencer')
  @RequiereAccion('docCentro', 'vencer')
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
