import {
  Controller,
  Post,
  Get,
  Delete,
  UseInterceptors,
  UploadedFile,
  Body,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DocumentosService } from './documentos.service';
import { SubirDocumentoDto } from './documentos.dto';

@Controller('documentos')
export class DocumentosController {
  constructor(private readonly documentosService: DocumentosService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('archivo', { storage: memoryStorage() }))
  subirDocumento(
    @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
    @Body() dto: SubirDocumentoDto,
  ) {
    if (!archivo) {
      throw new BadRequestException('No se proporcionó archivo');
    }
    return this.documentosService.subirDocumento(
      dto.tipo,
      archivo,
      dto.empresa_nombre,
      dto.centro_nombre,
      dto.proyecto_nombre,
      dto.centro_id,
      dto.proyecto_id,
    );
  }

  @Get('listar')
  listarDocumentos(
    @Query('tipo') tipo: 'empresa' | 'centro' | 'proyecto',
    @Query('empresa_nombre') empresa_nombre?: string,
    @Query('centro_nombre') centro_nombre?: string,
    @Query('proyecto_nombre') proyecto_nombre?: string,
  ) {
    return this.documentosService.listarDocumentos(tipo, empresa_nombre, centro_nombre, proyecto_nombre);
  }

  @Delete('eliminar/:filename')
  eliminarDocumento(
    @Param('filename') filename: string,
    @Query('tipo') tipo: 'empresa' | 'centro' | 'proyecto',
    @Query('empresa_nombre') empresa_nombre?: string,
    @Query('centro_nombre') centro_nombre?: string,
    @Query('proyecto_nombre') proyecto_nombre?: string,
  ) {
    const eliminado = this.documentosService.eliminarDocumento(
      tipo,
      filename,
      empresa_nombre,
      centro_nombre,
      proyecto_nombre,
    );
    return { eliminado, filename };
  }
}
