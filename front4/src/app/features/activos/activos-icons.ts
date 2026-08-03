export interface ColorActivo {
  valor: string;
  label: string;
  icono: string;
}

export const COLORES_ACTIVO: ColorActivo[] = [
  { valor: '#ef4444', label: 'Rojo',   icono: 'camara'            },
  { valor: '#22c55e', label: 'Verde',  icono: 'caja-registradora' },
  { valor: '#3b82f6', label: 'Azul',   icono: 'servidor'          },
  { valor: '#8b5cf6', label: 'Morado', icono: 'red'               },
  { valor: '#f59e0b', label: 'Ambar',  icono: 'generador'         },
  { valor: '#0095d6', label: 'Cian',   icono: 'computador'        },
];

export function clavePorColor(color: string): string {
  const match = COLORES_ACTIVO.find(
    c => c.valor.toLowerCase() === color.toLowerCase()
  );
  return match?.icono ?? 'computador';
}

export const ICONOS_ACTIVO = [
  'calendario', 'check', 'llave', 'alerta', 'reunion', 'documento',
  'herramienta', 'camion', 'electricidad', 'extintor', 'casco', 'limpieza',
] as const;

export function resolverIconoActivo(icono?: string, color?: string): string {
  if (icono && (ICONOS_ACTIVO as readonly string[]).includes(icono)) {
    return icono;
  }
  return clavePorColor(color ?? '');
}
