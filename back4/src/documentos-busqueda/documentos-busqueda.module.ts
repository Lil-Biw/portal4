import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DocumentosBusquedaController } from './documentos-busqueda.controller';
import { DocumentosBusquedaService } from './documentos-busqueda.service';
import { ClienteSchema } from '../clientes/clientes.schema';
import { DocClienteSchema } from '../clientes/doc-cliente.schema';
import { CentroCostoSchema } from '../centros-costos/centros-costos.schema';
import { DocCentroCostoSchema } from '../centros-costos/doc-centro-costo.schema';
import { ProyectoSchema } from '../proyectos/proyectos.schema';
import { DocProyectoSchema } from '../proyectos/doc-proyecto.schema';
import { UsuarioSchema } from '../usuarios/usuarios.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Cliente', schema: ClienteSchema },
      { name: 'DocCliente', schema: DocClienteSchema },
      { name: 'CentroCosto', schema: CentroCostoSchema },
      { name: 'DocCentroCosto', schema: DocCentroCostoSchema },
      { name: 'Proyecto', schema: ProyectoSchema },
      { name: 'DocProyecto', schema: DocProyectoSchema },
      { name: 'Usuario', schema: UsuarioSchema },
    ]),
  ],
  controllers: [DocumentosBusquedaController],
  providers: [DocumentosBusquedaService],
})
export class DocumentosBusquedaModule {}
