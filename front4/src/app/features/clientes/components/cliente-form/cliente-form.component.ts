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

  form: CreateClienteDto = this.empty();

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
  }

  submit(): void {
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
