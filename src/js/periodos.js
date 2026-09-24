"use strict";
/* =====================================================================
   Planifica v4 — PERIODOS
   El calendario de la oferta: mes de inicio, número de periodos, zoom de
   visualización y RÓTULOS EDITABLES a mano.

   Formato por defecto (nada de "oct 26 / nov 26" repitiendo el año):
       |        2026        |      2027      |   ← banda de año
       | OCT | NOV | DIC | ENE | FEB | MAR |   ← columna de periodo
   El usuario puede renombrar cualquier columna ("Fase 1", "S1", "Trim. 1")
   y volver al automático cuando quiera. El zoom agrupa en trimestres
   naturales para vistas macro.

   Sin DOM. Todo lo que pinta el calendario pasa por aquí.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});
  const N = () => PL.nucleo;

  const ZOOMS = ["mes", "trimestre"];
  const MIN_PERIODOS = 1, MAX_PERIODOS = 60;

  /** Objeto de periodos por defecto: 12 meses desde el mes siguiente. */
  function porDefecto() {
    const d = new Date();
    const inicio = N().mesISO(new Date(d.getFullYear(), d.getMonth() + 1, 1));
    return { inicio: inicio, n: 12, zoom: "mes", etiquetas: {} };
  }

  function normalizar(p, nHoras) {
    const q = (p && typeof p === "object") ? p : {};
    q.inicio = N().normalizarMesISO(q.inicio);
    /* Si las líneas de horas traen más periodos que el calendario, manda el calendario
       pero se respeta el máximo real para no perder datos al cargar. */
    const n = N().acota(q.n === undefined ? 12 : q.n, MIN_PERIODOS, MAX_PERIODOS);
    q.n = nHoras ? Math.max(n, N().acota(nHoras, MIN_PERIODOS, MAX_PERIODOS)) : n;
    q.zoom = ZOOMS.indexOf(q.zoom) >= 0 ? q.zoom : "mes";
    q.etiquetas = (q.etiquetas && typeof q.etiquetas === "object" && !Array.isArray(q.etiquetas)) ? q.etiquetas : {};
    Object.keys(q.etiquetas).forEach(k => {
      const i = parseInt(k, 10);
      if (isNaN(i) || i < 0 || i >= q.n) { delete q.etiquetas[k]; return; }
      q.etiquetas[k] = N().texto(q.etiquetas[k], "");
      if (!q.etiquetas[k]) delete q.etiquetas[k];
    });
    return q;
  }

  /* ---------- Fechas de cada periodo ---------- */

  /** Primer día del periodo i (0 = el primero del calendario). */
  function fecha(p, i) {
    const q = normalizar(p);
    const partes = q.inicio.split("-").map(Number);
    return new Date(partes[0], partes[1] - 1 + Math.round(N().num(i)), 1);
  }

  function meses(p) { return normalizar(p).n; }

  /** Índice del periodo que contiene una fecha dada (o -1 si cae fuera). */
  function indiceDe(p, fecha_) {
    const q = normalizar(p);
    const d = (fecha_ instanceof Date) ? fecha_ : new Date(fecha_);
    if (isNaN(d.getTime())) return -1;
    const partes = q.inicio.split("-").map(Number);
    const dif = (d.getFullYear() - partes[0]) * 12 + (d.getMonth() - (partes[1] - 1));
    return (dif >= 0 && dif < q.n) ? dif : -1;
  }

  /* ---------- Etiquetas ---------- */

  /** Rótulo automático del periodo: "OCT" (mes) o "T4" (trimestre). */
  function etiquetaAuto(p, i) {
    const q = normalizar(p);
    const d = fecha(q, i);
    if (q.zoom === "trimestre") return "T" + (Math.floor(d.getMonth() / 3) + 1);
    /* Columna estrecha del Gantt: mes corto en MAYÚSCULAS, sin el año
       (el año va en su propia banda de cabecera). */
    return d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "").toUpperCase();
  }

  function estaEditada(p, i) {
    const q = normalizar(p);
    return !!q.etiquetas[i];
  }

  /** Rótulo que se pinta: el editado a mano o el automático. */
  function etiqueta(p, i) {
    const q = normalizar(p);
    return q.etiquetas[i] || etiquetaAuto(q, i);
  }

  function editar(p, i, texto_) {
    const q = normalizar(p);
    const t = N().texto(texto_, "");
    if (!t) delete q.etiquetas[i];
    else q.etiquetas[i] = t.slice(0, 14);
    return q;
  }

  function volverAuto(p, i) {
    const q = normalizar(p);
    delete q.etiquetas[i];
    return q;
  }

  function volverTodoAuto(p) {
    const q = normalizar(p);
    q.etiquetas = {};
    return q;
  }

  function cuantasEditadas(p) { return Object.keys(normalizar(p).etiquetas).length; }

  /* ---------- Columnas y bandas (para la cabecera del Gantt) ---------- */

  /**
   * Columnas visibles del calendario. En zoom "mes", una por periodo; en
   * "trimestre", agrupadas por trimestre natural (una columna puede contener
   * 1, 2 o 3 periodos si el rango corta a mitad de trimestre).
   */
  function columnas(p) {
    const q = normalizar(p);
    const cols = [];
    for (let i = 0; i < q.n; i++) {
      const d = fecha(q, i);
      const anio = d.getFullYear();
      if (q.zoom === "trimestre") {
        const t = Math.floor(d.getMonth() / 3);
        const clave = anio + "-T" + t;
        const ult = cols[cols.length - 1];
        if (ult && ult.clave === clave) { ult.periodos.push(i); continue; }
        cols.push({
          clave: clave, anio: anio, trimestre: t + 1, periodos: [i],
          etiqueta: q.etiquetas[i] || ("T" + (t + 1)),
          editada: !!q.etiquetas[i]
        });
      } else {
        cols.push({
          clave: "p" + i, anio: anio, periodos: [i],
          etiqueta: etiqueta(q, i), editada: estaEditada(q, i), indice: i
        });
      }
    }
    return cols;
  }

  /** Bandas de año que agrupan las columnas (para no repetir el año en cada una). */
  function bandas(p) {
    const cols = columnas(p);
    const out = [];
    cols.forEach(c => {
      const ult = out[out.length - 1];
      if (ult && ult.anio === c.anio) { ult.n++; ult.columnas.push(c); }
      else out.push({ anio: c.anio, n: 1, columnas: [c] });
    });
    return out;
  }

  /* ---------- Rangos legibles ---------- */

  function mesLargo(p, i) {
    const d = fecha(p, i);
    return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  }

  function mesCorto(p, i) {
    const d = fecha(p, i);
    return d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "") + " " + d.getFullYear();
  }

  function rango(p) {
    const q = normalizar(p);
    return { desde: fecha(q, 0), hasta: fecha(q, q.n - 1) };
  }

  /** "octubre 2026 — marzo 2027" */
  function rangoLegible(p) {
    const q = normalizar(p);
    return mesLargo(q, 0) + " — " + mesLargo(q, q.n - 1);
  }

  /** "6 meses · octubre 2026 — marzo 2027" */
  function duracionLegible(p) {
    const q = normalizar(p);
    return q.n + " " + N().plural(q.n, "mes") + " · " + rangoLegible(q);
  }

  /** "en el mes 3 de 6 (dic 2026)" */
  function posicionLegible(p, i) {
    const q = normalizar(p);
    const k = N().acota(i, 0, q.n - 1);
    return "mes " + (k + 1) + " de " + q.n + " (" + mesCorto(q, k).toLowerCase() + ")";
  }

  /* ---------- Cambios del calendario ---------- */

  function conInicio(p, inicio) {
    const q = normalizar(p);
    q.inicio = N().normalizarMesISO(inicio);
    return q;
  }

  function conN(p, n) {
    const q = normalizar(p);
    const nuevo = Math.round(N().acota(n, MIN_PERIODOS, MAX_PERIODOS));
    /* Al acortar se descartan las etiquetas de periodos que ya no existen. */
    Object.keys(q.etiquetas).forEach(k => { if (parseInt(k, 10) >= nuevo) delete q.etiquetas[k]; });
    q.n = nuevo;
    return q;
  }

  function conZoom(p, zoom) {
    const q = normalizar(p);
    q.zoom = ZOOMS.indexOf(zoom) >= 0 ? zoom : "mes";
    return q;
  }

  function siguienteZoom(zoom) { return ZOOMS[(ZOOMS.indexOf(zoom) + 1) % ZOOMS.length]; }

  /** Desplaza el calendario k periodos (mueve el inicio). */
  function desplazar(p, k) {
    const q = normalizar(p);
    return conInicio(q, N().mesISO(fecha(q, Math.round(N().num(k)))));
  }

  PL.periodos = {
    ZOOMS: ZOOMS, MIN: MIN_PERIODOS, MAX: MAX_PERIODOS,
    porDefecto: porDefecto, normalizar: normalizar,
    fecha: fecha, meses: meses, indiceDe: indiceDe,
    etiquetaAuto: etiquetaAuto, etiqueta: etiqueta, estaEditada: estaEditada,
    editar: editar, volverAuto: volverAuto, volverTodoAuto: volverTodoAuto, cuantasEditadas: cuantasEditadas,
    columnas: columnas, bandas: bandas,
    mesLargo: mesLargo, mesCorto: mesCorto, rango: rango, rangoLegible: rangoLegible,
    duracionLegible: duracionLegible, posicionLegible: posicionLegible,
    conInicio: conInicio, conN: conN, conZoom: conZoom, siguienteZoom: siguienteZoom, desplazar: desplazar
  };
})(typeof window !== "undefined" ? window : globalThis);
