import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Cliente, CreateClienteDto } from '../../../../shared/models/cliente.model';

@Component({
  selector: 'app-cliente-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './cliente-form.component.html',
})
export class ClienteFormComponent implements OnChanges {
  @Input() initial: Cliente | null = null;
  @Input() submitLabel = 'Guardar';
  @Output() submitted = new EventEmitter<CreateClienteDto>();
  @Output() logoFile = new EventEmitter<File | null>();

  form: CreateClienteDto = this.empty();
  logoPreview: string | null = null;
  private _logoFile: File | null = null;

  ngOnChanges(): void {
    this.form = this.initial
      ? {
          razon_social: this.initial.razon_social,
          rut: this.initial.rut,
          email_contacto: this.initial.email_contacto,
          telefono: this.initial.telefono ?? '',
          direccion: { ...this.initial.direccion },
        }
      : this.empty();
    this.logoPreview = this.initial?.logo_url ?? null;
    this._logoFile = null;
  }

  onLogoSelected(ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0] ?? null;
    this._logoFile = file;
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => { this.logoPreview = e.target?.result as string; };
      reader.readAsDataURL(file);
    } else {
      this.logoPreview = this.initial?.logo_url ?? null;
    }
  }

  submit(): void {
    this.logoFile.emit(this._logoFile);
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
