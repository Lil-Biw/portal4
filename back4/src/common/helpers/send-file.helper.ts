import { Response } from 'express';

export function sendFile(
  res: Response,
  buffer: Buffer,
  tipo_mime: string,
  nombre: string,
  inline = false,
): void {
  res.setHeader('Content-Type', tipo_mime);
  res.setHeader(
    'Content-Disposition',
    `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(nombre)}"`,
  );
  res.send(buffer);
}
