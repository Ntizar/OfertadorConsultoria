"use strict";
/* =====================================================================
   Planifica v3 — NÚCLEO
   Utilidades puras: números, texto, fechas y formato. Sin DOM y sin
   estado global. Todo lo que necesiten los demás módulos pasa por aquí.

   Patrón de módulo: IIFE que expone su API en PL.<módulo>, para poder
   concatenar los ficheros en un único HTML (file:// no admite módulos ES)
   sin dejar variables globales sueltas.
   ===================================================================== */
(function (raiz) {
  const PL = (raiz.PL = raiz.PL || {});

  /* ---------- Números ---------- */

  /** Número a partir de cualquier entrada, aceptando la coma decimal española. */
  function num(v) {
    const s = (v === null || v === undefined) ? "" : String(v);
    const n = parseFloat(s.replace(",", "."));
    return isFinite(n) ? n : 0;
  }

  /** Redondeo a 2 decimales con criterio Excel: se normaliza a 15 dígitos
      significativos antes de redondear, de modo que 0.1+0.2 no arrastre el
      error binario (es lo que hace que los totales cuadren al céntimo). */
  function r2(n) {
    const v = num(n);
    if (!isFinite(v)) return 0;
    const c1 = parseFloat(v.toPrecision(15));
    return Math.round(parseFloat((c1 * 100).toPrecision(15))) / 100;
  }

  function suma(lista, fn) {
    let s = 0;
    const l = Array.isArray(lista) ? lista : [];
    for (let i = 0; i < l.length; i++) s += num(fn ? fn(l[i]) : l[i]);
    return s;
  }

  function suma2(lista, fn) { return r2(suma(lista, fn)); }

  /** Acota un número al rango [min, max]. */
  function acota(n, min, max) {
    const v = num(n);
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  /* ---------- Texto ---------- */

  function esc(s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function uid(prefijo) { return prefijo + Math.random().toString(36).slice(2, 9); }

  /** Texto apto para nombre de fichero. */
  function slug(s) {
    return String(s || "oferta").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "oferta";
  }

  function texto(s, alt) { const t = String(s === null || s === undefined ? "" : s).trim(); return t || (alt || ""); }

  function lista(v) { return Array.isArray(v) ? v : []; }

  /* ---------- Fechas y meses ---------- */

  function hoyISO() { return new Date().toISOString().slice(0, 10); }

  function mesActualISO() { return new Date().toISOString().slice(0, 7); }

  function hoyLargo() {
    return new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  }

  /** "2026-03" → {a:2026, m:3}. Tolera entradas vacías o fuera de rango. */
  function partirFechaInicio(fi) {
    const partes = String(fi || "").split("-").map(Number);
    const a = partes[0] || new Date().getFullYear();
    const m = Math.min(12, Math.max(1, partes[1] || 1));
    return { a: a, m: m };
  }

  /** Primer día del mes i-ésimo del proyecto (i empieza en 0). */
  function fechaDeMes(fi, i) {
    const p = partirFechaInicio(fi);
    return new Date(p.a, p.m - 1 + Math.max(0, Math.round(num(i))), 1);
  }

  function etiquetaMes(fi, i) {
    return fechaDeMes(fi, i).toLocaleDateString("es-ES", { month: "short", year: "2-digit" }).replace(".", "");
  }

  function anioDeMes(fi, i) { return fechaDeMes(fi, i).getFullYear(); }

  /** Fecha de fin de validez de una oferta, formateada en corto. */
  function fechaValidez(pr) {
    try {
      const f = pr && pr.fecha ? new Date(pr.fecha + "T12:00:00") : new Date();
      if (isNaN(f.getTime())) return "—";
      f.setDate(f.getDate() + (num(pr && pr.validezDias) || 30));
      return f.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
    } catch (e) { return "—"; }
  }

  /** Etiqueta legible del mes de entrega de un entregable ("mar 26"). */
  function etiquetaMesEntrega(pr, mes) {
    if (mes === null || mes === undefined || mes === "") return "sin fecha";
    return etiquetaMes(pr && pr.fechaInicio, num(mes));
  }

  /* ---------- Formato ---------- */

  function fmtImporte(n, moneda) {
    return r2(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " " + (moneda || "€");
  }

  function fmtHoras(n) {
    return (Math.round(num(n) * 100) / 100).toLocaleString("es-ES", { maximumFractionDigits: 2 }) + " h";
  }

  function fmtPct(n) {
    return (Math.round(num(n) * 100) / 100).toLocaleString("es-ES", { maximumFractionDigits: 2 }) + " %";
  }

  function fmtNum(n) {
    return num(n).toLocaleString("es-ES", { maximumFractionDigits: 2 });
  }

  /* ---------- Objetos ---------- */

  function clonar(o) { return JSON.parse(JSON.stringify(o)); }

  PL.nucleo = {
    num: num, r2: r2, suma: suma, suma2: suma2, acota: acota,
    esc: esc, uid: uid, slug: slug, texto: texto, lista: lista,
    hoyISO: hoyISO, mesActualISO: mesActualISO, hoyLargo: hoyLargo,
    partirFechaInicio: partirFechaInicio, fechaDeMes: fechaDeMes, etiquetaMes: etiquetaMes,
    anioDeMes: anioDeMes, fechaValidez: fechaValidez, etiquetaMesEntrega: etiquetaMesEntrega,
    fmtImporte: fmtImporte, fmtHoras: fmtHoras, fmtPct: fmtPct, fmtNum: fmtNum,
    clonar: clonar
  };
})(typeof window !== "undefined" ? window : globalThis);
