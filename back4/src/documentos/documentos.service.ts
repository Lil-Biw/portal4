import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { CentrosCostosService } from '../centros-costos/centros-costos.service';

interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
import { ProyectosService } from '../proyectos/proyectos.service';

@Injectable()
export class DocumentosService {
  private readonly baseDir = path.join(process.cwd(), 'uploads');

  constructor(
    private readonly centrosService: CentrosCostosService,
    private readonly proyectosService: ProyectosService,
  ) {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private getContextPath(
    tipo: 'empresa' | 'centro' | 'proyecto',
    empresa_nombre?: string,
    centro_nombre?: string,
    proyecto_nombre?: string,
  ): string {
    const base = empresa_nombre || 'empresa';
    if (tipo === 'centro' && centro_nombre) {
      return path.join(base, 'centros-costos', centro_nombre, 'documentos');
    }
    if (tipo === 'proyecto' && centro_nombre && proyecto_nombre) {
      return path.join(base, 'centros-costos', centro_nombre, 'proyectos', proyecto_nombre);
    }
    return path.join(base, 'documentos');
  }

  async subirDocumento(
    tipo: 'empresa' | 'centro' | 'proyecto',
    archivo: UploadedFile,
    empresa_nombre?: string,
    centro_nombre?: string,
    proyecto_nombre?: string,
    centro_id?: string,
    proyecto_id?: string,
  ): Promise<{ nombre: string; url: string; tamano_bytes: number; tipo_mime: string }> {
    if (archivo.mimetype !== 'application/pdf') {
      throw new Error('Solo se permiten archivos PDF');
    }

    const contextPath = this.getContextPath(tipo, empresa_nombre, centro_nombre, proyecto_nombre);
    const fullDirPath = path.join(this.baseDir, contextPath);

    if (!fs.existsSync(fullDirPath)) {
      fs.mkdirSync(fullDirPath, { recursive: true });
    }

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const nombre = `${timestamp}_${randomString}_${archivo.originalname}`;
    const filePath = path.join(fullDirPath, nombre);

    fs.writeFileSync(filePath, archivo.buffer);

    const url = `/uploads/${contextPath}/${nombre}`.replace(/\\/g, '/');
    const meta = { nombre, url, tipo_mime: archivo.mimetype, tamano_bytes: archivo.size };

    if (tipo === 'centro' && centro_id) {
      await this.centrosService.agregarDocumento(centro_id, {
        nombre: meta.nombre,
        url: meta.url,
        tipo_mime: meta.tipo_mime,
        tamano_bytes: meta.tamano_bytes,
      });
    } else if (tipo === 'proyecto' && proyecto_id) {
      await this.proyectosService.agregarDocumento(proyecto_id, {
        nombre: meta.nombre,
        url: meta.url,
        tipo_mime: meta.tipo_mime,
      });
    }

    return meta;
  }

  listarDocumentos(
    tipo: 'empresa' | 'centro' | 'proyecto',
    empresa_nombre?: string,
    centro_nombre?: string,
    proyecto_nombre?: string,
  ): { nombre: string; url: string; tamano_bytes: number }[] {
    const contextPath = this.getContextPath(tipo, empresa_nombre, centro_nombre, proyecto_nombre);
    const fullDirPath = path.join(this.baseDir, contextPath);

    if (!fs.existsSync(fullDirPath)) return [];

    return fs.readdirSync(fullDirPath).map((filename) => {
      const stats = fs.statSync(path.join(fullDirPath, filename));
      return {
        nombre: filename,
        url: `/uploads/${contextPath}/${filename}`.replace(/\\/g, '/'),
        tamano_bytes: stats.size,
      };
    });
  }

  eliminarDocumento(
    tipo: 'empresa' | 'centro' | 'proyecto',
    filename: string,
    empresa_nombre?: string,
    centro_nombre?: string,
    proyecto_nombre?: string,
  ): boolean {
    const contextPath = this.getContextPath(tipo, empresa_nombre, centro_nombre, proyecto_nombre);
    const filePath = path.join(this.baseDir, contextPath, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  }
}
