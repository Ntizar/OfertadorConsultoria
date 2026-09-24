"use strict";
/* =====================================================================
   Planifica v4 — NÚCLEO
   Utilidades puras: números, texto, ids y redondeo. Sin DOM, sin estado.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});

  /* ---------- Números ---------- */

  /** Número desde cualquier entrada, aceptando la coma decimal española. */
  function num(v) {
    if (typeof v === "number") return isFinite(v) ? v : 0;
    const n = parseFloat(String(v === null || v === undefined ? "" : v).replace(",", "."));
    return isFinite(n) ? n : 0;
  }

  /** Redondeo a 2 decimales con criterio Excel (normaliza a 15 dígitos significativos
      antes de redondear). Es lo que hace que los totales cuadren al céntimo. */
  function r2(n) {
    const v = num(n);
    if (!isFinite(v)) return 0;
    const c1 = parseFloat(v.toPrecision(15));
    return Math.round(parseFloat((c1 * 100).toPrecision(15))) / 100;
  }

  function suma(lista, fn) {
    let s = 0;
    if (!lista || !lista.length) return 0;
    for (let i = 0; i < lista.length; i++) s += num(fn ? fn(lista[i]) : lista[i]);
    return s;
  }

  function sumaR2(lista, fn) { return r2(suma(lista, fn)); }

  /** Acota al rango [min, max]. */
  function acota(n, min, max) {
    const v = num(n);
    if (!isFinite(v)) return min;
    return v < min ? min : (v > max ? max : v);
  }

  function entre(n, min, max) { return acota(n, min, max); }

  /* ---------- Texto ---------- */

  const ENTIDADES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

  function esc(s) {
    return String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, c => ENTIDADES[c]);
  }

  function texto(s, alt) {
    const t = String(s === null || s === undefined ? "" : s).trim();
    return t || (alt || "");
  }

  function lista(v) { return Array.isArray(v) ? v : []; }

  function uid(prefijo) { return prefijo + Math.random().toString(36).slice(2, 9); }

  function slug(s) {
    return String(s || "oferta").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "oferta";
  }

  function capitaliza(s) {
    const t = String(s || "");
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  /* Plurales irregulares del castellano: 6 "mes" no es «6 mess». */
  const IRREGULARES = { mes: "meses", vez: "veces", año: "años", día: "días", persona: "personas" };

  function plural(n, singular, plural_) {
    return num(n) === 1 ? singular : (plural_ || IRREGULARES[singular] || singular + "s");
  }

  /* ---------- Fechas ---------- */

  /** Mes local en formato aaaa-mm (01..12 con relleno). */
  function mesISO(d) {
    const f = d || new Date();
    return f.getFullYear() + "-" + ("0" + (f.getMonth() + 1)).slice(-2);
  }

  /** Día local en formato aaaa-mm-dd.
      NUNCA usar toISOString() sobre una fecha local: pasa a UTC y en España
      (UTC+1/+2) devuelve el DÍA ANTERIOR — desplazaba todos los meses. */
  function diaISO(d) {
    const f = d || new Date();
    return mesISO(f) + "-" + ("0" + f.getDate()).slice(-2);
  }

  function hoyISO() { return diaISO(new Date()); }

  function fechaCorta(iso) {
    if (!iso) return "";
    const p = String(iso).split("-");
    if (p.length < 3) return String(iso);
    return p[2] + "/" + p[1] + "/" + p[0];
  }

  /** dd/mm/aaaa → aaaa-mm-dd (para inputs type="date"). */
  function fechaISO(corta) {
    const m = String(corta || "").match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (!m) return "";
    const a = m[3].length === 2 ? "20" + m[3] : m[3];
    return a + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2);
  }

  function fechaLarga(iso) {
    if (!iso) return "";
    const d = new Date(String(iso) + "T12:00:00");
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  }

  function fechaDeValidez(fechaISO_, dias) {
    const d = fechaISO_ ? new Date(String(fechaISO_) + "T12:00:00") : new Date();
    if (isNaN(d.getTime())) return "";
    d.setDate(d.getDate() + (num(dias) || 30));
    return diaISO(d);
  }

  /** "2026-10" válido, o el mes actual. */
  function normalizarMesISO(v) {
    const m = String(v || "").match(/^(\d{4})-(\d{1,2})$/);
    if (!m) return mesISO(new Date());
    const mes = acota(m[2], 1, 12);
    return m[1] + "-" + ("0" + mes).slice(-2);
  }

  /* ---------- Formato ---------- */

  function fmtImporte(n, moneda) {
    return r2(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + (moneda || "€");
  }

  function fmtHoras(n) {
    const v = Math.round(num(n) * 100) / 100;
    return v.toLocaleString("es-ES", { maximumFractionDigits: 2 }) + " h";
  }

  function fmtNum(n, dec) {
    return num(n).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: dec === undefined ? 2 : dec });
  }

  function fmtPct(n) {
    return fmtNum(n, 2) + " %";
  }

  /* ---------- Objetos ---------- */

  function clonar(o) { return JSON.parse(JSON.stringify(o)); }

  PL.nucleo = {
    num: num, r2: r2, suma: suma, sumaR2: sumaR2, acota: acota, entre: entre,
    esc: esc, texto: texto, lista: lista, uid: uid, slug: slug, capitaliza: capitaliza, plural: plural,
    hoyISO: hoyISO, mesISO: mesISO, diaISO: diaISO, fechaCorta: fechaCorta, fechaISO: fechaISO, fechaLarga: fechaLarga,
    fechaDeValidez: fechaDeValidez, normalizarMesISO: normalizarMesISO,
    fmtImporte: fmtImporte, fmtHoras: fmtHoras, fmtNum: fmtNum, fmtPct: fmtPct,
    clonar: clonar
  };
})(typeof window !== "undefined" ? window : globalThis);
