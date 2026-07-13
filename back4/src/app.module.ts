import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { JwtAuthGuard, RolesGuard, PermisosGuard } from './common/guards/guards';
import { S3Module } from './common/s3/s3.module';
import { AuthModule } from './auth/auth.module';
import { ClientesModule } from './clientes/clientes.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { CentrosCostosModule } from './centros-costos/centros-costos.module';
import { ProyectosModule } from './proyectos/proyectos.module';
import { PermisosModule } from './permisos/permisos.module';
import { SolicitudesModule } from './solicitudes/solicitudes.module';
import { TiposActividadModule } from './tipos-actividad/tipos-actividad.module';
import { TiposActivoModule } from './tipos-activo/tipos-activo.module';
import { TiposProyectoModule } from './tipos-proyecto/tipos-proyecto.module';
import { ActividadesModule } from './actividades/actividades.module';
import { ActivosModule } from './activos/activos.module';
import { NoticiasModule } from './noticias/noticias.module';
import { DocumentosVencidosModule } from './documentos-vencidos/documentos-vencidos.module';
import { TareasModule } from './tareas/tareas.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/portal_clientes'),
    S3Module,
    AuthModule,
    ClientesModule,
    UsuariosModule,
    CentrosCostosModule,
    ProyectosModule,
    PermisosModule,
    SolicitudesModule,
    TiposActividadModule,
    TiposActivoModule,
    TiposProyectoModule,
    ActividadesModule,
    ActivosModule,
    NoticiasModule,
    DocumentosVencidosModule,
    TareasModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermisosGuard },
  ],
})
export class AppModule {}
