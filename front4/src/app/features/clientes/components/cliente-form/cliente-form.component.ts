import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Cliente, CreateClienteDto } from '../../../../shared/models/cliente.model';
import { ApiService } from '../../../../core/services/api.service';

@Component({
  selector: 'app-cliente-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './cliente-form.component.html',
})
export class ClienteFormComponent implements OnChanges {
  private readonly api = inject(ApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() initial: Cliente | null = null;
  @Input() submitLabel = 'Guardar';
  @Input() saving = false;
  @Output() submitted = new EventEmitter<CreateClienteDto>();
  @Output() logoFile = new EventEmitter<File | null>();

  form: CreateClienteDto = this.empty();
  logoPreview: string | null = null;
  private _logoFile: File | null = null;

  private resolveLogoUrl(url?: string): string | null {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    const origin = new URL(this.api.base).origin;
    return `${origin}${url}`;
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
    this.logoPreview = this.resolveLogoUrl(this.initial?.logo_url);
    this._logoFile = null;
  }

  onLogoSelected(ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0] ?? null;
    this._logoFile = file;
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => { this.logoPreview = e.target?.result as string; this.cdr.markForCheck(); };
      reader.readAsDataURL(file);
    } else {
      this.logoPreview = this.resolveLogoUrl(this.initial?.logo_url);
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
