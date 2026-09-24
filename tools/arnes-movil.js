"use strict";
/* Arnes de desborde movil para Planifica (diagnostico).
   Se inyecta al final del HTML compilado. Recorre cada pestana, mide el
   desborde horizontal del documento, de cada contenedor con scroll y de las
   tablas, y deja el resultado en un <pre id="__res"> para leerlo con --dump-dom. */
(function () {
  const PESTANAS = ["trabajo", "oferta", "perfiles", "carga", "resumen", "informe", "ajustes"];

  function describe(el) {
    const cls = (el.className && typeof el.className === "string")
      ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
      : "";
    const txt = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
    return el.tagName.toLowerCase() + cls + (txt ? " «" + txt + "»" : "");
  }

  function caja(el) {
    const cs = getComputedStyle(el);
    return {
      el: describe(el),
      ancho: Math.round(el.getBoundingClientRect().width),
      hijo: el.firstElementChild ? describe(el.firstElementChild) : null
    };
  }

  function mide() {
    const vw = document.documentElement.clientWidth;
    const doc = document.scrollingElement;
    const fuera = [];
    document.querySelectorAll("body *").forEach(el => {
      if (el.closest("[hidden]")) return;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return;
      if (el.closest(".pa-gantt-scroll, .pa-tabla-horas, .nz-table-wrap")) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0) return;
      if (r.right > vw + 1 || r.left < -1) {
        fuera.push({ el: describe(el), izq: Math.round(r.left), der: Math.round(r.right) });
      }
    });
    const scrolls = [];
    document.querySelectorAll(".pa-gantt-scroll, .pa-tabla-horas, .nz-table-wrap").forEach(el => {
      scrolls.push({
        el: describe(el),
        visible: el.clientWidth,
        contenido: el.scrollWidth,
        desborda: el.scrollWidth > el.clientWidth + 1,
        scrolleable: getComputedStyle(el).overflowX,
        padre: el.parentElement ? describe(el.parentElement) : null
      });
    });
    const tablas = [];
    document.querySelectorAll("table").forEach(t => {
      const r = t.getBoundingClientRect();
      const ths = t.querySelectorAll("thead th").length;
      tablas.push({
        el: describe(t).slice(0, 60),
        columnas: ths || (t.querySelector("tr") ? t.querySelector("tr").children.length : 0),
        ancho: Math.round(r.width),
        display: getComputedStyle(t).display,
        celdaDisplay: t.querySelector("td") ? getComputedStyle(t.querySelector("td")).display : null,
        nowrap: t.querySelector("td") ? getComputedStyle(t.querySelector("td")).whiteSpace : null,
        desborda: r.right > vw + 1
      });
    });
    /* Barra de navegacion y pestanas: lo primero que se corta. */
    const barras = [];
    document.querySelectorAll(".nz-navbar, .nz-tabs, .nz-tabs__panel, main, .nz-container").forEach(el => {
      barras.push({ el: describe(el).slice(0, 40), visible: el.clientWidth, contenido: el.scrollWidth,
        wrap: getComputedStyle(el).flexWrap, overflowX: getComputedStyle(el).overflowX });
    });
    /* Quien ensancha el documento: el elemento mas profundo que pasa del viewport. */
    let culpable = null;
    document.querySelectorAll("body *").forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 && !el.closest(".pa-gantt-scroll, .pa-tabla-horas, .nz-table-wrap")) {
        if (!culpable || el.contains(culpable) === false) culpable = culpable || el;
      }
    });
    return {
      anchoVentana: vw,
      escala: window.devicePixelRatio,
      media720: window.matchMedia("(max-width:720px)").matches,
      media640: window.matchMedia("(max-width:640px)").matches,
      overflowDocumento: doc.scrollWidth > doc.clientWidth + 1,
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      barras: barras,
      elementosFuera: fuera.slice(0, 20),
      totalFuera: fuera.length,
      contenedoresConScroll: scrolls,
      tablas: tablas
    };
  }

  function paso(i, salida) {
    if (i >= PESTANAS.length) {
      const pre = document.createElement("pre");
      pre.id = "__res";
      pre.textContent = "@@RES@@\n" + JSON.stringify(salida) + "\n@@FIN@@";
      pre.style.display = "none";
      document.body.appendChild(pre);
      document.title = "LISTO";
      return;
    }
    const p = PESTANAS[i];
    const boton = document.querySelector('#pa-tabs .nz-tabs__tab[data-tab="' + p + '"]');
    if (boton) boton.click();
    setTimeout(() => {
      let datos;
      try { datos = mide(); } catch (e) { datos = { error: String(e) }; }
      datos.pestana = p;
      datos.resumen = {
        fuera: datos.totalFuera,
        tablasQueDesbordan: (datos.tablas || []).filter(t => t.desborda).length,
        contenedoresQueDesbordan: (datos.contenedoresConScroll || []).filter(s => s.desborda).length
      };
      delete datos.elementosFuera;
      salida.push(datos);
      paso(i + 1, salida);
    }, 240);
  }

  window.addEventListener("load", () => {
    setTimeout(() => paso(0, []), 700);
  });
})();
