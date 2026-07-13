import { createHash } from 'crypto';
import { Types } from 'mongoose';

// _id determinístico con la misma derivación que scripts/seed-demo-data.js
// (md5 del label → primeros 24 hex). Así el seed y la app generan los mismos ids.
function fixedId(label: string): Types.ObjectId {
  return new Types.ObjectId(createHash('md5').update(label).digest('hex').slice(0, 24));
}

// Catálogo oficial y CERRADO de tipos de proyecto ECLARITI (A–K).
// TiposProyectoService sincroniza la colección con esta lista al arrancar:
// upserta estos 11 y elimina cualquier otro tipo. Para modificar el catálogo,
// editar este archivo — no existe CRUD por API.
export const CATALOGO_TIPOS_PROYECTO: { _id: Types.ObjectId; nombre: string; color: string }[] = [
  { _id: fixedId('tipo-proyecto:iot-eclariti'),                    nombre: 'A. IOT – ECLARITI',                            color: '#0095d6' },
  { _id: fixedId('tipo-proyecto:ingenieria-auditorias'),           nombre: 'B. INGENIERÍA Y AUDITORÍAS',                   color: '#ae3ec9' },
  { _id: fixedId('tipo-proyecto:construccion-obras-nuevas'),       nombre: 'C. CONSTRUCCIÓN DE OBRAS NUEVAS',              color: '#e8590c' },
  { _id: fixedId('tipo-proyecto:normalizacion-instalaciones'),     nombre: 'D. NORMALIZACIÓN DE INSTALACIONES EXISTENTES', color: '#f08c00' },
  { _id: fixedId('tipo-proyecto:mantencion-bancos-condensadores'), nombre: 'E. MANTENCIÓN DE BANCOS DE CONDENSADORES',     color: '#2f9e44' },
  { _id: fixedId('tipo-proyecto:mantencion-otros-equipos'),        nombre: 'F. MANTENCIÓN DE OTROS EQUIPOS ELÉCTRICOS',    color: '#12b886' },
  { _id: fixedId('tipo-proyecto:contratos-mantencion-integral'),   nombre: 'G. CONTRATOS DE MANTENCIÓN INTEGRAL',          color: '#1971c2' },
  { _id: fixedId('tipo-proyecto:sistemas-gestion-energia'),        nombre: 'H. SISTEMAS DE GESTIÓN DE LA ENERGÍA (SGE)',   color: '#7048e8' },
  { _id: fixedId('tipo-proyecto:balance-nacional-energia'),        nombre: 'I. BALANCE NACIONAL DE ENERGÍA (BNE)',         color: '#c92a2a' },
  { _id: fixedId('tipo-proyecto:venta-equipos-suministro'),        nombre: 'J. VENTA DE EQUIPOS – SOLO SUMINISTRO',        color: '#495057' },
  { _id: fixedId('tipo-proyecto:capacitacion-entrenamiento'),      nombre: 'K. CAPACITACIÓN Y ENTRENAMIENTO',              color: '#d6336c' },
];
