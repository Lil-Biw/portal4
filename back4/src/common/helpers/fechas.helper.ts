// Medianoche UTC de la fecha actual EN CHILE (ms epoch). Las fechas de término
// se guardan date-only a medianoche UTC, así que restar esto da días de
// calendario chilenos correctos sin importar a qué hora corra el cron: con la
// fecha UTC a secas, una corrida entre las ~21:00 y las 23:59 de Chile (ya es
// el día siguiente en UTC) adelantaría los avisos un día.
export function hoyUtcChile(): number {
  const [y, m, d] = new Date()
    .toLocaleDateString('en-CA', { timeZone: 'America/Santiago' })
    .split('-')
    .map(Number);
  return Date.UTC(y, m - 1, d);
}
