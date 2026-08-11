import { Component, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Cliente, CreateClienteDto } from '../../../../shared/models/cliente.model';
import { ApiService } from '../../../../core/services/api.service';
import { ImageUploadComponent } from '../../../../shared/components/image-upload/image-upload.component';

@Component({
  selector: 'app-cliente-form',
  standalone: true,
  imports: [FormsModule, ImageUploadComponent],
  templateUrl: './cliente-form.component.html',
})
export class ClienteFormComponent implements OnChanges {
  private readonly api = inject(ApiService);

  @Input() initial: Cliente | null = null;
  @Input() submitLabel = 'Guardar';
  @Input() saving = false;
  @Output() submitted = new EventEmitter<CreateClienteDto>();
  @Output() logoFile = new EventEmitter<File | null>();
  @Output() imagenFile = new EventEmitter<File | null>();

  form: CreateClienteDto = this.empty();
  protected _logoFile: File | null = null;
  protected _imagenFile: File | null = null;

  // El backend no devuelve el binario de logo/imagen en el cliente (solo tipo_mime/nombre,
  // ver clientes.service.ts findAll/findOne con .select('-logo.contenido -imagen.contenido'))
  // — hay que pedirlos a los endpoints dedicados GET /empresas/:id/logo|imagen.
  protected resolveLogoUrl(cliente: Cliente | null): string | null {
    if (!cliente?._id || !cliente?.logo?.tipo_mime) return null;
    return this.api.url(`/empresas/${cliente._id}/logo`);
  }

  protected resolveImagenUrl(cliente: Cliente | null): string | null {
    if (!cliente?._id || !cliente?.imagen?.tipo_mime) return null;
    return this.api.url(`/empresas/${cliente._id}/imagen`);
  }

  ngOnChanges(): void {
    this.form = this.initial
      ? {
          razon_social: this.initial.razon_social,
          rut: this.initial.rut,
          email_contacto: this.initial.email_contacto,
          telefono: this.initial.telefono ?? '',
          direccion: {
            calle:  this.initial.direccion?.calle  ?? '',
            ciudad: this.initial.direccion?.ciudad ?? '',
            region: this.initial.direccion?.region ?? '',
            pais:   this.initial.direccion?.pais   ?? 'Chile',
          },
        }
      : this.empty();
    this._logoFile = null;
    this._imagenFile = null;
  }

  submit(): void {
    this.logoFile.emit(this._logoFile);
    this.imagenFile.emit(this._imagenFile);
    this.submitted.emit(this.form);
  }

  private empty(): CreateClienteDto {
    return {
      razon_social: '',
      rut: '',
      email_contacto: '',
      telefono: '',
      direccion: { calle: '', ciudad: '', region: '', pais: 'Chile' },
    };
  }
}
