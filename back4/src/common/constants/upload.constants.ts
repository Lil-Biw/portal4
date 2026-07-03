import { memoryStorage } from 'multer';

// Los archivos se suben a S3, pero multer los buferiza completos en RAM
// (memoryStorage) antes de enviarlos — el límite protege la memoria del proceso.
export const MAX_DOCUMENTO_BYTES = 20 * 1024 * 1024;

// Opciones compartidas por todos los FileInterceptor de subida de archivos.
export const OPCIONES_SUBIDA = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_DOCUMENTO_BYTES },
};
