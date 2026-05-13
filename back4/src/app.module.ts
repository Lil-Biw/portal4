import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
// AuthModule removed for DB-only testing
import { ClientesModule } from './clientes/clientes.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { CentrosCostosModule } from './centros-costos/centros-costos.module';
import { ProyectosModule } from './proyectos/proyectos.module';
import { PermisosModule } from './permisos/permisos.module';
import { DocumentosModule } from './documentos/documentos.module';

@Module({
  imports: [
    // Variables de entorno disponibles en todo el proyecto
    ConfigModule.forRoot({ 
      isGlobal: true,
      envFilePath: '.env'
    }),

    // Multer para manejo de archivos
    MulterModule.register({
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
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
  ],
})
export class AppModule {}
