import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { CentrosCostosService } from '../centros-costos/centros-costos.service';
import { ProyectosService } from '../proyectos/proyectos.service';

interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

interface DocMeta {
  nombre_display: string;
  categoria: string;
}

interface MetadataMap {
  [filename: string]: DocMeta;
}

@Injectable()
export class DocumentosService {
  private readonly baseDir = process.env['NODE_ENV'] === 'production'
    ? path.join('/tmp', 'uploads')
    : path.join(process.cwd(), 'uploads');

  constructor(
    private readonly centrosService: CentrosCostosService,
    private readonly proyectosService: ProyectosService,
  ) {
    fs.mkdirSync(this.baseDir, { recursive: true });
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

  private getMetaPath(dirPath: string): string {
    return path.join(dirPath, 'metadata.json');
  }

  private readMeta(dirPath: string): MetadataMap {
    const metaPath = this.getMetaPath(dirPath);
    if (!fs.existsSync(metaPath)) return {};
    try {
      return JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as MetadataMap;
    } catch {
      return {};
    }
  }

  private writeMeta(dirPath: string, meta: MetadataMap): void {
    fs.writeFileSync(this.getMetaPath(dirPath), JSON.stringify(meta, null, 2), 'utf-8');
  }

  async subirDocumento(
    tipo: 'empresa' | 'centro' | 'proyecto',
    archivo: UploadedFile,
    empresa_nombre?: string,
    centro_nombre?: string,
    proyecto_nombre?: string,
    centro_id?: string,
    proyecto_id?: string,
    nombre_display?: string,
    categoria?: string,
  ): Promise<{ nombre: string; nombre_display: string; categoria: string; url: string; tamano_bytes: number; tipo_mime: string }> {
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

    const resolvedNombre = nombre_display?.trim() || archivo.originalname;
    const resolvedCategoria = categoria || 'Otros';

    const meta = this.readMeta(fullDirPath);
    meta[nombre] = { nombre_display: resolvedNombre, categoria: resolvedCategoria };
    this.writeMeta(fullDirPath, meta);

    const url = `/uploads/${contextPath}/${nombre}`.replace(/\\/g, '/');
    const result = { nombre, nombre_display: resolvedNombre, categoria: resolvedCategoria, url, tipo_mime: archivo.mimetype, tamano_bytes: archivo.size };

    if (tipo === 'centro' && centro_id) {
      await this.centrosService.agregarDocumento(centro_id, {
        nombre: result.nombre,
        url: result.url,
        tipo_mime: result.tipo_mime,
        tamano_bytes: result.tamano_bytes,
      });
    } else if (tipo === 'proyecto' && proyecto_id) {
      await this.proyectosService.agregarDocumento(proyecto_id, {
        nombre: result.nombre,
        url: result.url,
        tipo_mime: result.tipo_mime,
      });
    }

    return result;
  }

  listarDocumentos(
    tipo: 'empresa' | 'centro' | 'proyecto',
    empresa_nombre?: string,
    centro_nombre?: string,
    proyecto_nombre?: string,
  ): { nombre: string; nombre_display: string; categoria: string; url: string; tamano_bytes: number }[] {
    const contextPath = this.getContextPath(tipo, empresa_nombre, centro_nombre, proyecto_nombre);
    const fullDirPath = path.join(this.baseDir, contextPath);

    if (!fs.existsSync(fullDirPath)) return [];

    const meta = this.readMeta(fullDirPath);
    return fs.readdirSync(fullDirPath)
      .filter(f => f !== 'metadata.json')
      .map((filename) => {
        const stats = fs.statSync(path.join(fullDirPath, filename));
        const fileMeta = meta[filename] ?? { nombre_display: filename, categoria: 'Otros' };
        return {
          nombre: filename,
          nombre_display: fileMeta.nombre_display,
          categoria: fileMeta.categoria,
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
    const fullDirPath = path.join(this.baseDir, contextPath);
    const filePath = path.join(fullDirPath, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      const meta = this.readMeta(fullDirPath);
      delete meta[filename];
      this.writeMeta(fullDirPath, meta);
      return true;
    }
    return false;
  }
}
