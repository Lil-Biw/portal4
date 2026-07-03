import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    const bucket = this.configService.get<string>('S3_BUCKET_NAME');
    const region = this.configService.get<string>('AWS_REGION');
    if (!bucket || !region) {
      throw new Error(
        'Faltan variables de entorno S3_BUCKET_NAME y/o AWS_REGION — requeridas para el almacenamiento de archivos en S3',
      );
    }
    this.bucket = bucket;
    this.client = new S3Client({ region });
  }

  async subir(key: string, buffer: Buffer, mimetype: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
      }),
    );
  }

  async descargar(key: string): Promise<Buffer> {
    let response;
    try {
      response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      if (name === 'NoSuchKey' || name === 'NotFound') {
        throw new NotFoundException(`Archivo no encontrado en S3: ${key}`);
      }
      throw err;
    }
    const stream = response.Body as AsyncIterable<Uint8Array>;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async eliminar(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
