import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  readonly base = environment.apiUrl;

  url(path: string): string {
    return `${this.base}${path}`;
  }
}
