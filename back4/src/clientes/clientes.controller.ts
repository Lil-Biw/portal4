import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ForbiddenException,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { sendFile } from '../common/helpers/send-file.helper';
import { FileInterceptor } from '@nestjs/platform-express';
import { OPCIONES_SUBIDA } from '../common/constants/upload.constants';
import { ClientesService } from './clientes.service';
import { CreateClienteDto, UpdateClienteDto, UpdateScoreSmartclarityDto, UpdateConfigGraficoDto, VencerDocumentoEmpresaDto } from './clientes.dto';
import { Roles, Public } from '../common/guards/guards';

interface JwtUser {
  sub: string;
  email: string;
  rol: string;
  cliente_id?: string;
}

@Controller('empresas')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  private assertEmpresaPermitida(user: JwtUser, empresaId: string) {
    if (user?.rol === 'super_admin' || user?.rol === 'admin_smartclarity') return;
    if (!user?.cliente_id || user.cliente_id !== empresaId) {
      throw new ForbiddenException('No puedes ver ni modificar otra empresa');
    }
  }

  @Post()
  @Roles('super_admin')
  create(@Body() dto: CreateClienteDto) {
    return this.clientesService.create(dto);
  }

  @Get()
  async findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '30',
    @Req() req: Request,
  ) {
    const user = (req as any).user as JwtUser;
    if (user?.rol !== 'super_admin' && user?.rol !== 'admin_smartclarity') {
      if (!user?.cliente_id)
        throw new ForbiddenException('Tu usuario no tiene empresa asignada');
      const cliente = await this.clientesService.findOne(user.cliente_id);
      return { data: [cliente], total: 1, page: +page, pages: 1 };
    }
    return this.clientesService.findAll(+page, +limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request) {
    this.assertEmpresaPermitida((req as any).user as JwtUser, id);
    return this.clientesService.findOne(id);
  }

  @Put(':id')
  @Roles('super_admin', 'admin_smartclarity')
  update(@Param('id') id: string, @Body() dto: UpdateClienteDto) {
    return this.clientesService.update(id, dto);
  }

  @Put(':id/score-smartclarity')
  @Roles('super_admin', 'admin_smartclarity')
  updateScore(
    @Param('id') id: string,
    @Body() dto: UpdateScoreSmartclarityDto,
  ) {
    return this.clientesService.updateScoreSmartclarity(id, dto.valores);
  }

  @Patch(':id/config-grafico')
  @Roles('super_admin', 'admin_smartclarity')
  updateConfigGrafico(
    @Param('id') id: string,
    @Body() dto: UpdateConfigGraficoDto,
  ) {
    return this.clientesService.updateConfigGrafico(id, dto.mostrar_grafico_promedio);
  }

  @Delete(':id')
  @Roles('super_admin')
  remove(@Param('id') id: string) {
    return this.clientesService.remove(id);
  }

  @Post(':id/logo')
  @Roles('super_admin', 'admin_smartclarity')
  @UseInterceptors(FileInterceptor('archivo', OPCIONES_SUBIDA))
  subirLogo(
    @Param('id') id: string,
    @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
  ) {
    if (!archivo) throw new BadRequestException('No se proporcionó archivo');
    return this.clientesService.subirLogo(id, archivo);
  }

  @Get(':id/logo')
  @Public()
  async servirLogo(@Param('id') id: string, @Res() res: Response) {
    const { buffer, tipo_mime, nombre } =
      await this.clientesService.servirLogo(id);
    sendFile(res, buffer, tipo_mime, nombre, true);
  }

  @Post(':id/imagen')
  @Roles('super_admin', 'admin_smartclarity')
  @UseInterceptors(FileInterceptor('archivo', OPCIONES_SUBIDA))
  subirImagen(
    @Param('id') id: string,
    @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
  ) {
    if (!archivo) throw new BadRequestException('No se proporcionó archivo');
    return this.clientesService.subirImagen(id, archivo);
  }

  @Get(':id/imagen')
  @Public()
  async servirImagen(@Param('id') id: string, @Res() res: Response) {
    const { buffer, tipo_mime, nombre } =
      await this.clientesService.servirImagen(id);
    sendFile(res, buffer, tipo_mime, nombre, true);
  }

  @Post(':id/documentos')
  @Roles('super_admin', 'admin_smartclarity', 'usuario')
  @UseInterceptors(FileInterceptor('archivo', OPCIONES_SUBIDA))
  subirDocumento(
    @Param('id') id: string,
    @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
    @Body('nombre_display') nombreDisplay?: string,
    @Body('categoria') categoria?: string,
    @Body('link_url') linkUrl?: string,
    @Req() req?: Request,
  ) {
    const user = (req as any).user as JwtUser;
    this.assertEmpresaPermitida(user, id);
    if (!archivo && !linkUrl) throw new BadRequestException('Debes adjuntar un archivo o un link');
    return this.clientesService.agregarDocumento(
      id,
      { archivo, linkUrl },
      nombreDisplay,
      categoria,
      user?.rol,
      user?.sub,
    );
  }

  @Get(':id/documentos')
  listarDocumentos(@Param('id') id: string, @Req() req: Request) {
    this.assertEmpresaPermitida((req as any).user as JwtUser, id);
    return this.clientesService.listarDocumentos(id);
  }

  @Get(':id/documentos/:docId')
  async descargarDocumento(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    this.assertEmpresaPermitida((req as any).user as JwtUser, id);
    const { buffer, tipo_mime, nombre_display } =
      await this.clientesService.servirDocumento(id, docId);
    sendFile(res, buffer, tipo_mime, nombre_display);
  }

  @Patch(':id/documentos/:docId')
  @Roles('super_admin', 'admin_smartclarity')
  actualizarDocumento(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Body('categoria') categoria: string,
    @Req() req: Request,
  ) {
    this.assertEmpresaPermitida((req as any).user as JwtUser, id);
    if (!categoria?.trim()) throw new BadRequestException('Debes indicar una categoría');
    return this.clientesService.actualizarDocumento(id, docId, categoria.trim());
  }

  @Delete(':id/documentos/:docId')
  @Roles('super_admin', 'admin_smartclarity')
  eliminarDocumento(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Req() req: Request,
  ) {
    this.assertEmpresaPermitida((req as any).user as JwtUser, id);
    return this.clientesService.eliminarDocumento(id, docId);
  }

  @Patch(':id/documentos/:docId/vencer')
  @Roles('super_admin', 'admin_smartclarity', 'usuario')
  async vencerDocumento(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Body() dto: VencerDocumentoEmpresaDto,
    @Req() req: Request,
  ) {
    this.assertEmpresaPermitida((req as any).user as JwtUser, id);
    return this.clientesService.vencerDocumento(id, docId, dto.empresa_nombre, dto.notificacion);
  }
}
