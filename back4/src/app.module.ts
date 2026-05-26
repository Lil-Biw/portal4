import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
// AuthModule removed for DB-only testing
import { ClientesModule } from './clientes/clientes.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { CentrosCostosModule } from './centros-costos/centros-costos.module';
import { ProyectosModule } from './proyectos/proyectos.module';
import { PermisosModule } from './permisos/permisos.module';
import { DocumentosModule } from './documentos/documentos.module';
import { SolicitudesModule } from './solicitudes/solicitudes.module';
import { TiposMantencionModule } from './tipos-mantencion/tipos-mantencion.module';
import { MantencionesModule } from './mantenciones/mantenciones.module';
import { ActivosModule } from './activos/activos.module';
import { NoticiasModule } from './noticias/noticias.module';

@Module({
  imports: [
    // Variables de entorno disponibles en todo el proyecto
    ConfigModule.forRoot({ 
      isGlobal: true,
      envFilePath: '.env'
    }),

    // Conexión a MongoDB
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/portal_clientes'),

    // Módulos de negocio
    ClientesModule,
    UsuariosModule,
    CentrosCostosModule,
    ProyectosModule,
    PermisosModule,
    DocumentosModule,
    SolicitudesModule,
    TiposMantencionModule,
    MantencionesModule,
    ActivosModule,
    NoticiasModule,
  ],
})
export class AppModule {}
