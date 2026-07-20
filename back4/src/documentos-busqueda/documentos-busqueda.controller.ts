import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/guards/guards';
import { DocumentosBusquedaService, NivelBusqueda } from './documentos-busqueda.service';

@Controller('documentos/busqueda-total')
export class DocumentosBusquedaController {
  constructor(private readonly service: DocumentosBusquedaService) {}

  @Get()
  @Roles('super_admin', 'admin_smartclarity')
  buscar(
    @Query('nivel') nivel?: string,
    @Query('categorias') categorias?: string,
    @Query('nombre') nombre?: string,
  ) {
    const nivelValido: NivelBusqueda = nivel === 'centro' || nivel === 'proyecto' ? nivel : 'empresa';
    const listaCategorias = categorias
      ? categorias.split(',').map(c => c.trim()).filter(Boolean)
      : undefined;
    return this.service.buscar(nivelValido, listaCategorias, nombre);
  }
}
