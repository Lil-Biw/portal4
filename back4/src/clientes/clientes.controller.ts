import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query,
  UseInterceptors, UploadedFile, BadRequestException, Res,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ClientesService } from './clientes.service';
import { CreateClienteDto, UpdateClienteDto } from './clientes.dto';
import { Roles, Public } from '../common/guards/guards';

@Controller('empresas')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Post()
  @Roles('super_admin')
  create(@Body() dto: CreateClienteDto) {
    return this.clientesService.create(dto);
  }

  @Get()
  findAll(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.clientesService.findAll(+page, +limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clientesService.findOne(id);
  }

  @Put(':id')
  @Roles('super_admin')
  update(@Param('id') id: string, @Body() dto: UpdateClienteDto) {
    return this.clientesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('super_admin')
  remove(@Param('id') id: string) {
    return this.clientesService.remove(id);
  }

  @Post(':id/logo')
  @Roles('super_admin')
  @UseInterceptors(FileInterceptor('archivo', { storage: memoryStorage() }))
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
    const { buffer, tipo_mime, nombre } = await this.clientesService.servirLogo(id);
    res.setHeader('Content-Type', tipo_mime);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(nombre)}"`);
    res.send(buffer);
  }

  @Post(':id/documentos')
  @Roles('super_admin', 'admin_cliente')
  @UseInterceptors(FileInterceptor('archivo', { storage: memoryStorage() }))
  subirDocumento(
    @Param('id') id: string,
    @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
    @Body('nombre_display') nombreDisplay?: string,
    @Body('categoria') categoria?: string,
  ) {
    if (!archivo) throw new BadRequestException('No se proporcionó archivo');
    return this.clientesService.agregarDocumento(id, archivo, nombreDisplay, categoria);
  }

  @Get(':id/documentos')
  listarDocumentos(@Param('id') id: string) {
    return this.clientesService.listarDocumentos(id);
  }

  @Get(':id/documentos/:docId')
  async descargarDocumento(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Res() res: Response,
  ) {
    const { buffer, tipo_mime, nombre_display } = await this.clientesService.servirDocumento(id, docId);
    res.setHeader('Content-Type', tipo_mime);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nombre_display)}"`);
    res.send(buffer);
  }

  @Delete(':id/documentos/:docId')
  @Roles('super_admin', 'admin_cliente')
  eliminarDocumento(@Param('id') id: string, @Param('docId') docId: string) {
    return this.clientesService.eliminarDocumento(id, docId);
  }
}
