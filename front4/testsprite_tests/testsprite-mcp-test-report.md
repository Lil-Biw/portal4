
# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** front4
- **Date:** 2026-07-17
- **Prepared by:** TestSprite AI Team
- **Scope:** Verificación acotada (créditos limitados, plan Free) de las dos features
  agregadas el 17 de julio de 2026: hora inicio/término en actividades y el tag de
  usuario que subió el documento en `documentos-admin-page`. No es una corrida de
  regresión completa del plan de 45 tests generado.

---

## 2️⃣ Requirement Validation Summary

### Requirement: Actividad — hora inicio y hora término

#### Test TC011 Crear actividad futura visible en el calendario
- **Test Code:** [TC011_Crear_actividad_futura_visible_en_el_calendario.py](./TC011_Crear_actividad_futura_visible_en_el_calendario.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/fe745b9e-2d4f-4329-9e44-44f871195ac6/c3c905d1-a0aa-40f6-af7e-e8794c457d45
- **Status:** ✅ Passed
- **Analysis / Findings:** Creó una actividad con Hora inicio `09:00` y Hora término
  `11:30` en el wizard (paso Información), confirmó que "Hora término" queda
  deshabilitado hasta setear "Hora inicio", completó el resto del wizard y guardó.
  Cambió el calendario a vista Semana para inspeccionar el bloque resultante.
---

#### Test TC030 Actualizar una actividad existente
- **Test Code:** [TC030_Actualizar_una_actividad_existente.py](./TC030_Actualizar_una_actividad_existente.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/fe745b9e-2d4f-4329-9e44-44f871195ac6/c009172b-0147-4ef0-bb60-7f86c00f9fa5
- **Status:** ✅ Passed
- **Analysis / Findings:** Abrió una actividad existente cuyo bloque ya se renderizaba
  como "08:00–13:00" (confirma que `rangoHora()` funciona en producción/dev real, no
  solo en build), editó "Hora término" a `14:30` y luego a `15:00` en corridas
  sucesivas del wizard, guardó y volvió a vista Semana para confirmar el cambio.

### Requirement: Tag "quién subió" en Documentos (admin)

#### Test TC009 Subir un documento válido y verlo en el listado
- **Test Code:** [TC009_Subir_un_documento_vlido_y_verlo_en_el_listado.py](./TC009_Subir_un_documento_vlido_y_verlo_en_el_listado.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/fe745b9e-2d4f-4329-9e44-44f871195ac6/4db189d7-1d18-4ad1-9f07-2f8f5acc52c9
- **Status:** ✅ Passed
- **Analysis / Findings:** Subió un PDF nuevo en `documentos-admin-page` (empresa
  AgroSur Ltda.) y verificó que la fila muestra el pill con el nombre del usuario
  logueado ("AndresAdmin") junto al texto "Subido: ...". No se llegó a ejecutar,
  dentro de este mismo test, el chequeo negativo en modo consumidor (queda como
  gap, ver sección 4).

---

## 3️⃣ Coverage & Matching Metrics

- **100%** de los tests corridos pasaron (3/3). Corrida acotada por límite de
  créditos (plan Free, 49 créditos) — no cubre el plan completo de 45 tests
  generado para el resto de la app.

| Requirement                                      | Total Tests | ✅ Passed | ❌ Failed |
|---------------------------------------------------|-------------|-----------|-----------|
| Actividad — hora inicio y hora término            | 2           | 2         | 0         |
| Tag "quién subió" en Documentos (admin)           | 1           | 1         | 0         |

---

## 4️⃣ Key Gaps / Risks

- **Sin chequeo negativo en modo consumidor:** no se verificó explícitamente que
  `documentos-consumidor-page` NO muestre el pill de usuario (requisito explícito
  del spec `docs/superpowers/specs/2026-07-17-tag-subido-por-documentos-design.md`).
  Pendiente de verificación manual o en una corrida futura con más créditos.
- **Sin verificación de "Todos los centros" / "Todos los proyectos" / "Vencidos":**
  el spec pide confirmar el pill en las 4 vistas de `documentos-admin-page`; esta
  corrida solo cubrió la vista principal (por empresa).
- **Sin test de la altura proporcional del bloque como aserción dura:** el veredicto
  de "bloque más alto para actividad más larga" lo dio el juez de IA de TestSprite
  en base a capturas de pantalla durante la corrida (dashboard), no una aserción de
  píxeles verificable localmente en el `.py` generado (que solo trae un
  `assert current_url` trivial).
- **Backend no cubierto:** esta corrida fue solo frontend (decisión explícita para
  ahorrar créditos). El DTO `hora_termino` y el `resolverSubidoPorNombre` del
  backend no tienen test automatizado propio.
