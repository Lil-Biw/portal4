export interface ColorProyecto {
  valor: string;
  label: string;
  icono: string;
}

export const COLORES_PROYECTO: ColorProyecto[] = [
  { valor: '#0095d6', label: 'Azul',    icono: 'carpeta'  },
  { valor: '#22c55e', label: 'Verde',   icono: 'objetivo' },
  { valor: '#f59e0b', label: 'Ámbar',   icono: 'cohete'   },
  { valor: '#ef4444', label: 'Rojo',    icono: 'bandera'  },
  { valor: '#8b5cf6', label: 'Morado',  icono: 'maletin'  },
  { valor: '#6366f1', label: 'Índigo',  icono: 'grafico'  },
];

export function clavePorColorProyecto(color: string): string {
  const match = COLORES_PROYECTO.find(
    c => c.valor.toLowerCase() === color.toLowerCase()
  );
  return match?.icono ?? 'carpeta';
}

export const ICONOS_PROYECTO = [
  'calendario', 'check', 'llave', 'alerta', 'reunion', 'documento',
  'herramienta', 'camion', 'electricidad', 'extintor', 'casco', 'limpieza',
] as const;

export function resolverIconoProyecto(icono?: string, color?: string): string {
  if (icono && (ICONOS_PROYECTO as readonly string[]).includes(icono)) {
    return icono;
  }
  return clavePorColorProyecto(color ?? '');
}
