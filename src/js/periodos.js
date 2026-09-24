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

  const UNIDADES = ["mes", "semana"];
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
    q.unidad = UNIDADES.indexOf(q.unidad) >= 0 ? q.unidad : "mes";
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
  /** Número de semana ISO (1..53) de una fecha. */
  function semanaISO(d) {
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dia = (t.getDay() + 6) % 7;                 /* 0 = lunes */
    t.setDate(t.getDate() - dia + 3);                 /* el jueves de esa semana */
    const primerJueves = new Date(t.getFullYear(), 0, 4);
    const d0 = (primerJueves.getDay() + 6) % 7;
    primerJueves.setDate(primerJueves.getDate() - d0 + 3);
    return 1 + Math.round((t - primerJueves) / 604800000);
  }

  /** Fecha de comienzo del periodo i: el día 1 del mes, o el lunes de la semana. */
  function fecha(p, i) {
    const q = normalizar(p);
    const partes = q.inicio.split("-").map(Number);
    const k = Math.round(N().num(i));
    if (q.unidad === "semana") {
      const primero = new Date(partes[0], partes[1] - 1, 1);
      const dia = primero.getDay();                     /* 0 = domingo */
      const lunes = new Date(partes[0], partes[1] - 1, 1 + (dia === 0 ? -6 : 1 - dia));
      return new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 7 * k);
    }
    return new Date(partes[0], partes[1] - 1 + k, 1);
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

  /** Rótulo automático del periodo: "OCT" (mes), "S37" (semana) o "T4" (trimestre). */
  function etiquetaAuto(p, i) {
    const q = normalizar(p);
    const d = fecha(q, i);
    if (q.unidad === "semana") return "S" + semanaISO(d);
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
  /** Banda intermedia de trimestres: sólo con semanas, para no perderse en 52 columnas. */
  function bandasTrimestre(p) {
    const q = normalizar(p);
    if (q.unidad !== "semana") return null;
    const cols = columnas(q);
    const out = [];
    cols.forEach(c => {
      const d = fecha(q, c.periodos[0]);
      const t = (d.getFullYear() * 4) + Math.floor(d.getMonth() / 3);
      const ult = out[out.length - 1];
      if (ult && ult.clave === t) { ult.n++; }
      else out.push({ clave: t, n: 1, texto: "T" + (Math.floor(d.getMonth() / 3) + 1) + " " + d.getFullYear() });
    });
    return out;
  }

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
  /** "6 meses · octubre de 2026 — marzo de 2027" o "26 semanas · …". */
  function duracionLegibleUnidad(p) {
    const q = normalizar(p);
    const n = q.n;
    if (q.unidad === "semana") return n + " " + N().plural(n, "semana") + " · " + rangoLegible(q);
    return N().plural(n, "mes") + " · " + rangoLegible(q);
  }

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

  /* ---------- Días y horas laborables ---------- */

  /* Caché: el cálculo de días laborables se pide una vez por celda y no cambia
     mientras no cambien el mes ni la jornada. */
  const CACHE_LAB = {};
  const CACHE_HORAS = {};

  /** Días del mes del periodo i. */
  function diasDelMes(p, i) {
    const f = fecha(p, i);
    return new Date(f.getFullYear(), f.getMonth() + 1, 0).getDate();
  }

  /** Días laborables del periodo i (los días de la semana que se trabajan). */
  /** Días laborables del periodo: los del mes, o los de la semana (7 días desde el lunes). */
  function diasLaborables(p, i, diasSemana) {
    const q = normalizar(p);
    const f = fecha(q, i);
    const dias = (Array.isArray(diasSemana) && diasSemana.length) ? diasSemana : [1, 2, 3, 4, 5];
    const clave = q.unidad + "|" + N().mesISO(f) + "-" + f.getDate() + "|" + dias.join(",");
    if (CACHE_LAB[clave] !== undefined) return CACHE_LAB[clave];
    const total = q.unidad === "semana" ? 7 : new Date(f.getFullYear(), f.getMonth() + 1, 0).getDate();
    let n = 0;
    for (let d = 0; d < total; d++) {
      const wd = new Date(f.getFullYear(), f.getMonth(), f.getDate() + d).getDay();   /* 0=domingo */
      if (dias.indexOf(wd === 0 ? 7 : wd) >= 0) n++;
    }
    CACHE_LAB[clave] = n;
    return n;
  }

  /** Horas laborables del periodo i: días laborables × horas por día. */
  /** Horas laborables de un periodo: cada día con SUS horas, y los festivos fuera.
      El viernes puede ser más corto y el 12 de octubre no cuenta. */
  function horasLaborables(p, i, jornada) {
    const j = jornada || {};
    const dias = (Array.isArray(j.diasSemana) && j.diasSemana.length) ? j.diasSemana : [1, 2, 3, 4, 5];
    const horasDia = N().acota(j.horasDia === undefined ? 8 : j.horasDia, 0, 24);
    const porDia = (j.horasPorDia && typeof j.horasPorDia === "object") ? j.horasPorDia : null;
    const festivos = Array.isArray(j.festivos) ? j.festivos : [];
    const q = normalizar(p);
    const f = fecha(q, i);
    const anio = f.getFullYear();
    const huella = dias.join(",") + "|" + horasDia + "|" +
      (porDia ? [1, 2, 3, 4, 5, 6, 7].map(d => N().num(porDia[d])).join(",") : "") + "|" +
      festivos.filter(x => x && String(x.fecha).slice(0, 4) === String(anio)).map(x => String(x.fecha).slice(5)).join(",");
    const clave = q.unidad + "|" + N().mesISO(f) + "-" + f.getDate() + "|" + huella;
    if (CACHE_HORAS[clave] !== undefined) return CACHE_HORAS[clave];
    const total = q.unidad === "semana" ? 7 : new Date(f.getFullYear(), f.getMonth() + 1, 0).getDate();
    const esFiesta = (PL.festivos && PL.festivos.esFestivo) ? PL.festivos.esFestivo : function () { return false; };
    let h = 0;
    for (let d = 0; d < total; d++) {
      const dd = new Date(f.getFullYear(), f.getMonth(), f.getDate() + d);
      const wd = dd.getDay() === 0 ? 7 : dd.getDay();
      if (dias.indexOf(wd) < 0) continue;
      if (esFiesta(festivos, dd)) continue;
      h += porDia ? N().num(porDia[wd]) : horasDia;
    }
    CACHE_HORAS[clave] = N().r2(h);
    return CACHE_HORAS[clave];
  }

  PL.periodos = {
    UNIDADES: UNIDADES, semanaISO: semanaISO, bandasTrimestre: bandasTrimestre,
    duracionLegibleUnidad: duracionLegibleUnidad,
    diasDelMes: diasDelMes, diasLaborables: diasLaborables, horasLaborables: horasLaborables,
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
