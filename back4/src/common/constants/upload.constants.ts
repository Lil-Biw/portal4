import { memoryStorage } from 'multer';

// Los archivos se suben a S3, pero multer los buferiza completos en RAM
// (memoryStorage) antes de enviarlos — el límite protege la memoria del proceso.
export const MAX_DOCUMENTO_BYTES = 20 * 1024 * 1024;

// busboy (usado por multer 2.x) decodifica el parámetro `filename` del header
// Content-Disposition como latin1 y no admite configurar otro charset — pero los
// navegadores mandan esos bytes en UTF-8. Sin esto, "calibración.pdf" llega como
// "calibraciÃ³n.pdf" (mojibake). Re-decodificar es un no-op seguro para nombres
// 100% ASCII.
function corregirEncodingNombre(
  _req: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
): void {
  file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
  callback(null, true);
}

// Opciones compartidas por todos los FileInterceptor de subida de archivos.
export const OPCIONES_SUBIDA = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_DOCUMENTO_BYTES },
  fileFilter: corregirEncodingNombre,
};
