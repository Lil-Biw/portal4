export interface Direccion {
  calle?: string;
  ciudad?: string;
  region?: string;
  pais?: string;
}

export interface Cliente {
  _id: string;
  razon_social: string;
  rut: string;
  email_contacto: string;
  telefono?: string;
  direccion?: Direccion;
  activo: boolean;
  logo?: { tipo_mime: string; nombre: string };
  logo_url?: string;
  creado_en?: string;
  actualizado_en?: string;
}

export interface CreateClienteDto {
  razon_social: string;
  rut: string;
  email_contacto: string;
  telefono?: string;
  direccion?: Direccion;
}

export type UpdateClienteDto = Partial<CreateClienteDto>;
