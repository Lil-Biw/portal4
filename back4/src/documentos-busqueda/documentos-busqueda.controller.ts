import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { EmpresaAccessGuard, Roles } from '../common/guards/guards';
import { DocumentosBusquedaService, NivelBusqueda } from './documentos-busqueda.service';

function nivelValido(nivel?: string): NivelBusqueda {
  return nivel === 'centro' || nivel === 'proyecto' ? nivel : 'empresa';
}

function listaCategorias(categorias?: string): string[] | undefined {
  return categorias ? categorias.split(',').map(c => c.trim()).filter(Boolean) : undefined;
}

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
    return this.service.buscar(nivelValido(nivel), listaCategorias(categorias), nombre);
  }
}

// Variante para el perfil consumidor: misma búsqueda cascada, pero acotada a la
// empresa del route param (EmpresaAccessGuard exige que coincida con la del usuario;
// super_admin/admin_smartclarity pasan siempre).
// Nombre de ruta con guion (no anidado bajo /documentos) para no colisionar con
// GET /empresas/:id/documentos/:docId (ahí "busqueda-total" matchearía como :docId).
@Controller('empresas/:empresaId/documentos-busqueda-total')
@UseGuards(EmpresaAccessGuard)
export class DocumentosBusquedaEmpresaController {
  constructor(private readonly service: DocumentosBusquedaService) {}

  @Get()
  buscar(
    @Param('empresaId') empresaId: string,
    @Query('nivel') nivel?: string,
    @Query('categorias') categorias?: string,
    @Query('nombre') nombre?: string,
  ) {
    return this.service.buscar(nivelValido(nivel), listaCategorias(categorias), nombre, empresaId);
  }
}
