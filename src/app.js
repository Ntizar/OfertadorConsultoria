"use strict";
/* =====================================================================
   Planifica v2 — Ofertas y planificación de proyectos (marca blanca)
   App 100% autónoma: sin CDN, sin servidor, datos en localStorage.
   UI: Aurora 7 (packs incrustados). Datos: modelo de oferta completo.
   ===================================================================== */

/* ---------- Utilidades ---------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const uid = p => p + Math.random().toString(36).slice(2, 9);
const esc = s => String(s ?? "").replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num = v => { const n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : 0; };
const r2 = n => {
  /* Redondeo estilo Excel: normaliza a 15 dígitos significativos antes de redondear. */
  const v = num(n);
  if (!isFinite(v)) return 0;
  const c1 = parseFloat(v.toPrecision(15));
  return Math.round(parseFloat((c1 * 100).toPrecision(15))) / 100;
};
const CLAVE = "planifica:estado:v2";
const CLAVE_V1 = "planifica:estado:v1";
let guardadoTimer = null;
function guardar(){
  clearTimeout(guardadoTimer);
  guardadoTimer = setTimeout(() => {
    try {
      ESTADO.pestana = pestanaActual;
      localStorage.setItem(CLAVE, JSON.stringify(ESTADO));
      const el = $("#pa-guardado"); if (el){ el.textContent = "Guardado ✓"; setTimeout(()=>{ el.textContent=""; }, 1500); }
    } catch(e) { toast("No se pudo guardar: almacenamiento lleno"); }
    renderInforme();
  }, 200);
}
let toastEl = null;
function toast(m){
  if (!toastEl){ toastEl = document.createElement("div"); toastEl.id = "pa-toast"; document.body.appendChild(toastEl); }
  toastEl.textContent = m; toastEl.classList.add("is-visible");
  clearTimeout(toastEl._tm); toastEl._tm = setTimeout(()=>toastEl.classList.remove("is-visible"), 2600);
}
function descargar(nombre, contenido, tipo){
  const blob = new Blob([contenido], {type: tipo || "application/octet-stream"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 400);
}
function slug(s){ return String(s||"oferta").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40) || "oferta"; }
function hoyISO(){ return new Date().toISOString().slice(0,10); }
function hoy(){ return new Date().toLocaleDateString("es-ES", {day:"2-digit",month:"long",year:"numeric"}); }
function fechaValidez(pr){
  try {
    const f = pr.fecha ? new Date(pr.fecha + "T12:00:00") : new Date();
    f.setDate(f.getDate() + (num(pr.validezDias) || 30));
    return f.toLocaleDateString("es-ES", {day:"2-digit",month:"short",year:"numeric"});
  } catch(e){ return "—"; }
}

/* ---------- Modelo de datos v2 ---------- */
const CATEGORIAS_PERFIL = ["Dirección de proyecto","Consultoría senior","Consultoría media","Consultoría junior","Perfil técnico","Soporte y administración","Otro"];
const ESTADOS_OFERTA = {
  borrador:  { texto: "Borrador",  badge: "nz-badge--neutral"  },
  enviada:   { texto: "Enviada",   badge: "nz-badge--brand"    },
  aprobada:  { texto: "Aprobada",  badge: "nz-badge--success"  },
  descartada:{ texto: "Descartada",badge: "nz-badge--danger"   }
};
function nuevoPerfil(nombre, tarifa, categoria, esDefecto){
  return { id: uid("pf_"), nombre: nombre || "Nuevo perfil", unidades: "h", tarifa: num(tarifa),
           categoria: categoria || "Otro", esDefecto: !!esDefecto };
}
function perfilesDefecto(){
  /* IDs FIJOS: restaurar-perfil y ↺ Defectos necesitan encontrar el original por id. */
  const defs = [
    ["pf_dir-proy",     "Dirección de proyecto",      "Jefe/a de proyecto", 60],
    ["pf_senior-15",    "Consultoría senior",          "Consultor/a senior (+15 años)", 65],
    ["pf_senior-10",    "Consultoría senior",          "Consultor/a senior (10–15 años)", 55],
    ["pf_media-5",      "Consultoría media",           "Consultor/a (5–10 años)", 48],
    ["pf_junior-2",     "Consultoría junior",          "Consultor/a junior (2–5 años)", 42],
    ["pf_tecnico-tic",  "Perfil técnico",              "Personal técnico TIC", 50],
    ["pf_admin-proy",   "Soporte y administración",    "Administrativo/a de proyecto", 32]
  ];
  return defs.map(d => ({ id: d[0], nombre: d[2], unidades: "h", tarifa: d[3], categoria: d[1], esDefecto: true }));
}
function plantillasDefecto(){
  return [{
    id: "pl_estandar", nombre: "Oferta estándar de servicios", esDefecto: true,
    desc: "Análisis, diseño, ejecución, pruebas y gestión de proyecto",
    tareas: [
      { nombre: "1. Análisis y planificación", subtareas: ["1.1 Reunión de arranque","1.2 Análisis de requisitos","1.3 Plan de trabajo"] },
      { nombre: "2. Diseño de la solución",    subtareas: ["2.1 Arquitectura de la solución","2.2 Diseño funcional"] },
      { nombre: "3. Ejecución",                subtareas: ["3.1 Desarrollo / ejecución","3.2 Revisiones de calidad"] },
      { nombre: "4. Pruebas y entrega",        subtareas: ["4.1 Pruebas y validación","4.2 Documentación y entrega"] },
      { nombre: "5. Gestión de proyecto",      subtareas: ["5.1 Seguimiento y coordinación"] }
    ]
  }];
}
function nuevoProyecto(nombre){
  return {
    id: uid("pr_"), nombre: nombre || "Oferta sin título",
    cliente: { nombre: "", contacto: "", ref: "" },
    estado: "borrador", fecha: hoyISO(), validezDias: 30,
    fechaInicio: new Date().toISOString().slice(0,7), meses: 12,
    descripcion: "", condicionesPago: "",
    impuestos: { tipo: "iva", tasa: 21, incluido: false },
    descuento: { tipo: "", valor: 0 },
    gastos: [], tareas: []
  };
}
function nuevaTarea(nombre){ return { id: uid("ta_"), nombre: nombre || "Nueva tarea", subtareas: [] }; }
function nuevaSub(nombre){ return { id: uid("sb_"), nombre: nombre || "Nueva subtarea", lineas: [] }; }
function nuevaLinea(perfilId, meses){ const h={}; for(let i=0;i<meses;i++) h["m"+i]=0; return { id: uid("ln_"), perfilId: perfilId||"", horas: h }; }
function lCon(linea, horas){ for (const k in horas) linea.horas[k] = horas[k]; return linea; }

function proyectoEjemplo(perfiles){
  const porNombre = n => perfiles.find(p => p.nombre.includes(n));
  const jp = porNombre("Jefe"), sen = porNombre("senior (+15"), med = porNombre("(5–10"), jru = porNombre("junior"), tec = porNombre("técnico TIC");
  const mesQueViene = (()=>{ const d=new Date(); return new Date(d.getFullYear(), d.getMonth()+1, 1).toISOString().slice(0,7); })();
  const p = nuevoProyecto("Ejemplo — Rediseño de web corporativa");
  p.guia = true;
  p.cliente = { nombre: "Cliente de ejemplo, S.L.", contacto: "Ana García · ana@cliente.es", ref: "EF/2026-042" };
  p.fechaInicio = mesQueViene; p.meses = 6;
  p.descripcion = "Rediseño completo de la web corporativa con nueva identidad visual y gestión de contenidos.";
  p.condicionesPago = "50% a la firma de la oferta, 50% a la entrega.";
  p.impuestos = { tipo: "iva", tasa: 21, incluido: false };
  p.descuento = { tipo: "%", valor: 5 };
  p.gastos = [
    { id: uid("g_"), nombre: "Licencias y herramientas (6 meses)", unidades: 6, precio: 45 },
    { id: uid("g_"), nombre: "Formación del equipo cliente", unidades: 1, precio: 900 }
  ];
  const t1 = nuevaTarea("1. Análisis y diseño");
  const s1 = nuevaSub("1.1 Descubrimiento y requisitos");
  s1.lineas = [lCon(nuevaLinea(jp.id,6), {"m0":4,"m1":2}), lCon(nuevaLinea(sen.id,6), {"m0":12,"m1":10,"m2":4}), lCon(nuevaLinea(med.id,6), {"m0":16,"m1":12,"m2":6})];
  const s2 = nuevaSub("1.2 Diseño UX/UI");
  s2.lineas = [lCon(nuevaLinea(med.id,6), {"m1":20,"m2":24,"m3":10}), lCon(nuevaLinea(tec.id,6), {"m1":8,"m2":8})];
  t1.subtareas = [s1, s2];
  const t2 = nuevaTarea("2. Desarrollo y lanzamiento");
  const s3 = nuevaSub("2.1 Desarrollo front-end");
  s3.lineas = [lCon(nuevaLinea(jru.id,6), {"m2":40,"m3":60,"m4":40}), lCon(nuevaLinea(tec.id,6), {"m3":20,"m4":20})];
  const s4 = nuevaSub("2.2 Pruebas y publicación");
  s4.lineas = [lCon(nuevaLinea(sen.id,6), {"m4":6}), lCon(nuevaLinea(jru.id,6), {"m4":16,"m5":8})];
  t2.subtareas = [s3, s4];
  p.tareas = [t1, t2];
  return p;
}

/* Normalización defensiva: acepta proyectos v1 y v2 y garantiza consistencia */
function normalizarProyecto(p, esMigracionV1){
  if (!p || typeof p !== "object") return nuevoProyecto("Oferta reparada");
  p.id = p.id || uid("pr_");
  p.nombre = p.nombre || "Oferta sin título";
  if (typeof p.cliente === "string") p.cliente = { nombre: p.cliente, contacto: "", ref: "" };
  p.cliente = (p.cliente && typeof p.cliente === "object") ? p.cliente : { nombre:"", contacto:"", ref:"" };
  p.cliente.nombre = p.cliente.nombre || ""; p.cliente.contacto = p.cliente.contacto || ""; p.cliente.ref = p.cliente.ref || "";
  p.estado = ESTADOS_OFERTA[p.estado] ? p.estado : "borrador";
  p.fecha = p.fecha || hoyISO();
  p.validezDias = Math.max(0, Math.round(num(p.validezDias) || 30));
  p.fechaInicio = p.fechaInicio || new Date().toISOString().slice(0,7);
  p.meses = Math.max(1, Math.min(60, Math.round(num(p.meses) || 12)));
  p.descripcion = p.descripcion || ""; p.condicionesPago = p.condicionesPago || "";
  /* En migración v1, un proyecto sin impuestos definidos se queda SIN impuestos
     (los presupuestos antiguos no los llevaban); en v2 el default es IVA 21%. */
  if (esMigracionV1 && !p.impuestos){
    p.impuestos = { tipo: "ninguno", tasa: 0, incluido: false };
  } else {
    p.impuestos = (p.impuestos && typeof p.impuestos === "object") ? p.impuestos : { tipo:"iva", tasa:21, incluido:false };
  }
  if (!["iva","irpf","ninguno"].includes(p.impuestos.tipo)) p.impuestos.tipo = "iva";
  p.impuestos.tasa = Math.max(0, Math.min(100, num(p.impuestos.tasa ?? 21)));
  p.impuestos.incluido = !!p.impuestos.incluido;
  p.descuento = (p.descuento && typeof p.descuento === "object") ? p.descuento : { tipo:"", valor:0 };
  if (!["","%","fijo"].includes(p.descuento.tipo)) p.descuento.tipo = "";
  p.descuento.valor = Math.max(0, num(p.descuento.valor));
  p.gastos = Array.isArray(p.gastos) ? p.gastos : [];
  p.gastos.forEach(g => { g.id = g.id || uid("g_"); g.nombre = g.nombre || "Concepto"; g.unidades = num(g.unidades); g.precio = num(g.precio); });
  p.tareas = Array.isArray(p.tareas) ? p.tareas : [];
  p.tareas.forEach(t => {
    t.id = t.id || uid("ta_"); t.nombre = t.nombre || "Tarea";
    t.subtareas = Array.isArray(t.subtareas) ? t.subtareas : [];
    t.subtareas.forEach(s => {
      s.id = s.id || uid("sb_"); s.nombre = s.nombre || "Subtarea";
      if (typeof s._abierta !== "boolean") s._abierta = false;
      s.lineas = Array.isArray(s.lineas) ? s.lineas : [];
      s.lineas.forEach(l => {
        l.id = l.id || uid("ln_"); l.perfilId = l.perfilId || "";
        const orig = (l.horas && typeof l.horas === "object") ? l.horas : {};
        const h = l.horas = {};
        for (let i = 0; i < p.meses; i++) h["m"+i] = num(orig["m"+i]);
      });
    });
  });
  return p;
}

function estadoInicial(){
  const perfiles = perfilesDefecto();
  return {
    version: 2,
    marca: { nombre: "Planifica", sub: "Ofertas y planificación de proyectos", moneda: "€", logo: "" },
    mostrarImportes: true,
    perfiles, perfilesInactivos: [],
    plantillas: plantillasDefecto(),
    proyectos: [proyectoEjemplo(perfiles)],
    activo: null,
    pestana: "estructura"
  };
}
let ESTADO = null;
function proyectoActivo(){ return ESTADO.proyectos.find(p => p.id === ESTADO.activo) || ESTADO.proyectos[0] || null; }
function perfilPorId(id){ return ESTADO.perfiles.find(p => p.id === id) || ESTADO.perfilesInactivos.find(p => p.id === id); }
function normalizarPerfil(p){
  p.id = p.id || uid("pf_");
  p.nombre = p.nombre || "Perfil";
  p.unidades = p.unidades || "h";
  p.tarifa = num(p.tarifa);
  p.categoria = CATEGORIAS_PERFIL.includes(p.categoria) ? p.categoria : "Otro";
  p.esDefecto = !!p.esDefecto;
  return p;
}
function normalizarPlantilla(pl){
  pl.id = pl.id || uid("pl_");
  pl.nombre = pl.nombre || "Plantilla";
  pl.desc = pl.desc || "";
  pl.esDefecto = !!pl.esDefecto;
  pl.tareas = Array.isArray(pl.tareas) ? pl.tareas.map(t => ({
    nombre: String(t.nombre || "Tarea"),
    subtareas: Array.isArray(t.subtareas) ? t.subtareas.map(s => String(s)) : []
  })) : [];
  return pl;
}

/* ---------- Cálculos ---------- */
const inicioProyecto = pr => { const [a,m] = String(pr.fechaInicio||"2026-01").split("-").map(Number); return {a: a||2026, m: m||1}; };
function etiquetaMes(pr, i){
  const {a, m} = inicioProyecto(pr);
  return new Date(a, m - 1 + i, 1).toLocaleDateString("es-ES", {month:"short", year:"2-digit"}).replace(".", "");
}
function anioMes(pr, i){ const {a, m} = inicioProyecto(pr); return new Date(a, m - 1 + i, 1).getFullYear(); }
function lineaHoras(l){ return Object.values(l.horas||{}).reduce((s,v)=>s+num(v),0); }
function tarifaDe(id){ const p = perfilPorId(id); return p ? num(p.tarifa) : 0; }
function lineaImporte(l){ return r2(lineaHoras(l) * tarifaDe(l.perfilId)); }
function subHoras(s){ return (s.lineas||[]).reduce((a,l)=>a+lineaHoras(l),0); }
function subImporte(s){ return r2((s.lineas||[]).reduce((a,l)=>a+lineaImporte(l),0)); }
function tareaHoras(t){ return (t.subtareas||[]).reduce((a,s)=>a+subHoras(s),0); }
function tareaImporte(t){ return r2((t.subtareas||[]).reduce((a,s)=>a+subImporte(s),0)); }
function horasProyecto(pr){ return (pr.tareas||[]).reduce((a,t)=>a+tareaHoras(t),0); }
function importeProyecto(pr){ return r2((pr.tareas||[]).reduce((a,t)=>a+tareaImporte(t),0)); }
function gastosTotal(pr){ return r2((pr.gastos||[]).reduce((a,g)=>a+num(g.unidades)*num(g.precio),0)); }
function subtotalProyecto(pr){ return r2(importeProyecto(pr) + gastosTotal(pr)); }
function descuentoImporte(pr){
  const base = subtotalProyecto(pr);
  if (pr.descuento && pr.descuento.tipo === "%") return r2(base * num(pr.descuento.valor) / 100);
  if (pr.descuento && pr.descuento.tipo === "fijo") return r2(Math.min(base, num(pr.descuento.valor)));
  return 0;
}
function baseImponible(pr){ return r2(subtotalProyecto(pr) - descuentoImporte(pr)); }
function impuestoImporte(pr){
  const t = pr.impuestos || {};
  if (!t.tipo || t.tipo === "ninguno" || !num(t.tasa)) return 0;
  const base = baseImponible(pr);
  if (t.tipo === "irpf") return r2(-base * num(t.tasa) / 100);
  return t.incluido ? r2(base * num(t.tasa) / (100 + num(t.tasa))) : r2(base * num(t.tasa) / 100);
}
function totalProyecto(pr){ return r2(baseImponible(pr) + impuestoImporte(pr)); }
function totalSinOcultar(pr){ return totalProyecto(pr); }
function horasPorPerfil(pr){
  const map = new Map();
  (pr.tareas||[]).forEach(t=>(t.subtareas||[]).forEach(s=>(s.lineas||[]).forEach(l=>{
    if (!l.perfilId) return;
    map.set(l.perfilId, (map.get(l.perfilId)||0) + lineaHoras(l));
  })));
  return map;
}
function importeMes(pr, i){
  let s = 0;
  (pr.tareas||[]).forEach(t=>(t.subtareas||[]).forEach(s2=>(s2.lineas||[]).forEach(l=>{
    s += num((l.horas||{})["m"+i]) * tarifaDe(l.perfilId);
  })));
  return s;
}
function horasMes(pr, i){
  let s = 0;
  (pr.tareas||[]).forEach(t=>(t.subtareas||[]).forEach(s2=>(s2.lineas||[]).forEach(l=>{
    s += num((l.horas||{})["m"+i]);
  })));
  return s;
}
function anualidades(pr){
  const map = new Map();
  for (let i=0;i<pr.meses;i++){
    const y = anioMes(pr, i);
    map.set(y, (map.get(y)||0) + importeMes(pr, i));
  }
  return map;
}
function usosPerfil(id){
  let n = 0;
  ESTADO.proyectos.forEach(pr=>(pr.tareas||[]).forEach(t=>(t.subtareas||[]).forEach(s=>(s.lineas||[]).forEach(l=>{ if(l.perfilId===id) n++; }))));
  return n;
}

/* ---------- Formato ---------- */
function fmt(n){
  const v = r2(n);
  return v.toLocaleString("es-ES", {minimumFractionDigits:2, maximumFractionDigits:2}) + " " + (ESTADO.marca.moneda || "€");
}
function fmtH(n){
  const v = Math.round(num(n)*100)/100;
  return v.toLocaleString("es-ES", {maximumFractionDigits:2}) + " h";
}
function nombreImpuesto(pr){ const t=pr.impuestos||{}; return t.tipo==="irpf" ? "IRPF" : (t.tipo==="iva" ? "IVA" : ""); }

/* ---------- Pestañas ---------- */
let pestanaActual = "estructura";
function mostrarPestana(nombre){
  pestanaActual = nombre;
  $$("#pa-tabs .nz-tabs__tab").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === nombre)));
  /* Las secciones viven DENTRO de .nz-tabs__panel: son <main> > <div> > <section>,
     así que "main>section" no encuentra nada. Se localizan por prefijo de id. */
  $$("main section[id^='sec-']").forEach(s => s.hidden = s.id !== "sec-" + nombre);
  if (nombre === "estructura") renderEstructura();
  if (nombre === "resumen") renderResumen();
  if (nombre === "cronograma") renderCronograma();
  if (nombre === "gastos") renderGastos();
  if (nombre === "informe") renderInforme();
  if (nombre === "ajustes") renderAjustes();
  guardar();
}

/* ---------- Render: cabecera, KPIs, guía ---------- */
function badgeEstado(pr){
  const e = ESTADOS_OFERTA[pr.estado] || ESTADOS_OFERTA.borrador;
  return `<span class="nz-badge ${e.badge}">${e.texto}</span>`;
}
function renderCabecera(){
  const m = ESTADO.marca;
  $("#pa-marca-nombre").textContent = m.nombre || "Planifica";
  $("#pa-pie-marca").textContent = m.nombre || "Planifica";
  document.title = (m.nombre || "Planifica") + " — Ofertas y planificación";
  const img = $("#pa-logo");
  if (m.logo){ img.src = m.logo; img.hidden = false; } else { img.hidden = true; }
  const sel = $("#pa-sel-proyecto");
  sel.innerHTML = ESTADO.proyectos.map(p =>
    `<option value="${p.id}" ${p.id===ESTADO.activo?"selected":""}>${esc(p.nombre)}${p.estado&&p.estado!=="borrador"?" · "+ESTADOS_OFERTA[p.estado].texto:""}</option>`).join("");
  document.body.classList.toggle("pa-modo-oculto", !ESTADO.mostrarImportes);
  const btn = $("#btn-importes"); if (btn) btn.textContent = ESTADO.mostrarImportes ? "👁 €" : "👁 h";
}
function updateKPIs(){
  const pr = proyectoActivo(); if (!pr) return;
  const imp = ESTADO.mostrarImportes;
  const total = totalProyecto(pr), horas = horasProyecto(pr);
  $("#kpi-total").textContent = imp ? fmt(total) : "—";
  const t = pr.impuestos||{};
  $("#kpi-total-detalle").textContent = imp ? ((t.tipo&&t.tipo!=="ninguno") ? (t.incluido ? `${nombreImpuesto(pr)} ${num(t.tasa)}% incluido` : `+ ${nombreImpuesto(pr)} ${num(t.tasa)}%`) : "sin impuestos") : "";
  $("#kpi-horas").textContent = fmtH(horas);
  const nt = (pr.tareas||[]).length, ns = (pr.tareas||[]).reduce((a,t2)=>a+(t2.subtareas||[]).length,0);
  $("#kpi-estructura").textContent = `${nt} tareas · ${ns} subtareas`;
  $("#kpi-media").textContent = imp && pr.meses ? fmt(total/pr.meses) + "/mes" : "—";
  $("#kpi-validez").textContent = pr.fecha ? `Oferta válida hasta ${fechaValidez(pr)}` : "";
  $("#kpi-cliente").textContent = pr.cliente.nombre || "—";
  $("#kpi-impuestos").textContent = [pr.cliente.ref, pr.condicionesPago].filter(Boolean).join(" · ");
  $("#pa-estado-badge").innerHTML = badgeEstado(pr);
  $("#pa-meta-proyecto").textContent = `${pr.meses} meses desde ${etiquetaMes(pr,0)}${pr.fecha ? " · " + pr.fecha : ""}`;
  $("#inp-proy-nombre").value = pr.nombre || "";
}
function renderGuia(){
  const pr = proyectoActivo();
  const cont = $("#pa-guia");
  if (!cont) return;
  if (pr && pr.guia && !ESTADO.guiaVista){
    cont.innerHTML = `
      <div class="nz-callout nz-callout--tip" style="margin-bottom:var(--nz-space-3)">
        <p><strong>Guía rápida (2 minutos):</strong></p>
        <p>1️⃣ Mira la estructura de ejemplo de abajo: tareas → subtareas → perfiles con horas por mes. Todo recalcula al instante.<br>
        2️⃣ Edita cualquier dato (nombre, horas, tarifas en <em>Ajustes</em>), añade o borra con los botones ＋ y ✕.<br>
        3️⃣ En <em>Ajustes</em> pones tu marca, tu cliente, los impuestos y guardas plantillas de tareas recurrentes.<br>
        4️⃣ En <em>Informe</em> imprimes a PDF o exportas CSV/JSON. Los 👁 € ocultan todos los importes cuando lo necesites.<br>
        Cuando la dejes a tu gusto: <em>Ajustes → guardar como plantilla</em> para reutilizarla en futuras ofertas.</p>
        <p style="margin-top:var(--nz-space-2)"><button class="nz-btn nz-btn--primary nz-btn--sm" data-acc="cerrar-guia">¡Entendido, empezar!</button></p>
      </div>`;
  } else cont.innerHTML = "";
}

/* ---------- Render: estructura ---------- */
function renderEstructura(){
  const pr = proyectoActivo();
  const cont = $("#pa-estructura");
  renderGuia();
  if (!pr){ cont.innerHTML = ""; return; }
  if (!(pr.tareas||[]).length){
    cont.innerHTML = `
      <div class="nz-empty">
        <span class="nz-empty__icon">🧱</span>
        <p class="nz-empty__title">Esta oferta todavía no tiene tareas</p>
        <p class="nz-empty__body">Empieza de cero o aplica una plantilla de tareas recurrentes (análisis → diseño → ejecución → entrega).</p>
        <button class="nz-btn nz-btn--primary nz-empty__action" data-acc="nueva-tarea">＋ Añadir tarea</button>
        <button class="nz-btn nz-btn--soft nz-empty__action" data-acc="plantilla-dialogo">📚 Usar plantilla</button>
      </div>`;
    return;
  }
  cont.innerHTML = pr.tareas.map((t, ti) => `
    <article class="nz-article pa-tarea" data-id="${t.id}">
      <div class="pa-fila">
        <input class="nz-input pa-crece2" data-campo="tarea-nombre" data-id="${t.id}" value="${esc(t.nombre)}" style="font-weight:700">
        <span class="nz-badge nz-badge--neutral pa-chip-h">${fmtH(tareaHoras(t))}</span>
        <span class="nz-badge nz-badge--brand pa-importe">${fmt(tareaImporte(t))}</span>
        <button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="nueva-sub" data-id="${t.id}" title="Añadir subtarea">＋ Subtarea</button>
        <button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="dup-tarea" data-id="${t.id}" title="Duplicar tarea">⧉</button>
        <button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="subir-tarea" data-id="${t.id}" title="Subir" ${ti===0?"disabled":""}>↑</button>
        <button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="bajar-tarea" data-id="${t.id}" title="Bajar" ${ti===pr.tareas.length-1?"disabled":""}>↓</button>
        <button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="elim-tarea" data-id="${t.id}" title="Eliminar tarea">✕</button>
      </div>
      ${t.subtareas.length ? t.subtareas.map((s, si) => htmlSub(pr, s, si, t.subtareas.length)).join("") : `<p class="pa-mini">Sin subtareas todavía. Añade la primera con «＋ Subtarea».</p>`}
    </article>`).join("");
}
function htmlSub(pr, s, si, total){
  const abierta = s._abierta;
  return `
  <div class="pa-sub" data-id="${s.id}">
    <div class="pa-sub__cab">
      <button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="toggle-sub" data-id="${s.id}" title="Plegar/desplegar" aria-label="Plegar o desplegar">${abierta?"▾":"▸"}</button>
      <input class="nz-input pa-crece" data-campo="sub-nombre" data-id="${s.id}" value="${esc(s.nombre)}">
      <span class="nz-badge nz-badge--neutral pa-chip-h">${fmtH(subHoras(s))}</span>
      <span class="nz-badge nz-badge--brand pa-importe">${fmt(subImporte(s))}</span>
      <button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="nueva-linea" data-id="${s.id}" title="Añadir perfil a esta subtarea">＋ Perfil</button>
      <button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="dup-sub" data-id="${s.id}" title="Duplicar subtarea">⧉</button>
      <button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="subir-sub" data-id="${s.id}" title="Subir" ${si===0?"disabled":""}>↑</button>
      <button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="bajar-sub" data-id="${s.id}" title="Bajar" ${si===total-1?"disabled":""}>↓</button>
      <button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="elim-sub" data-id="${s.id}" title="Eliminar subtarea">✕</button>
    </div>
    ${abierta ? `<div class="pa-sub__cuerpo">${s.lineas.length ? htmlLineas(pr, s) : `<p class="pa-mini">Subtarea vacía: añade perfiles con «＋ Perfil».</p>`}</div>` : ""}
  </div>`;
}
function htmlLineas(pr, s){
  const head = `<tr><th>Perfil</th>${Array.from({length:pr.meses},(_,i)=>`<th class="nz-table__right">${etiquetaMes(pr,i)}</th>`).join("")}<th class="nz-table__right">Horas</th>${ESTADO.mostrarImportes?`<th class="nz-table__right pa-col-importe">Importe</th>`:""}<th></th></tr>`;
  const filas = s.lineas.map(l => {
    const pf = perfilPorId(l.perfilId);
    return `<tr data-id="${l.id}">
      <td>
        <select class="nz-input nz-input--sm" data-campo="linea-perfil" data-id="${l.id}" style="min-width:170px">
          <option value="" ${!l.perfilId?"selected":""} disabled>— Elige perfil —</option>
          ${ESTADO.perfiles.map(p=>`<option value="${p.id}" ${p.id===l.perfilId?"selected":""}>${esc(p.nombre)}${p.categoria&&p.categoria!=="Otro"?" · "+p.categoria:""}</option>`).join("")}
        </select>
      </td>
      ${Array.from({length:pr.meses},(_,i)=>`<td class="nz-table__num nz-table__right"><input class="nz-input nz-input--sm pa-input-num" type="number" step="0.5" min="0" value="${num((l.horas||{})["m"+i])||""}" data-campo="horas" data-id="${l.id}" data-mes="${i}" placeholder="0"></td>`).join("")}
      <td class="nz-table__num nz-table__right nz-table__strong">${fmtH(lineaHoras(l))}</td>
      ${ESTADO.mostrarImportes?`<td class="nz-table__num nz-table__right pa-importe">${fmt(lineaImporte(l))}</td>`:""}
      <td><button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="elim-linea" data-id="${l.id}" title="Quitar perfil">✕</button></td>
    </tr>`;
  }).join("");
  return `<div class="pa-tabla-grid"><table class="nz-table nz-table--compact"><thead>${head}</thead><tbody>${filas}</tbody></table></div>`;
}

/* ---------- Render: resumen ---------- */
function renderResumen(){
  const pr = proyectoActivo(); if (!pr) return;
  const imp = ESTADO.mostrarImportes;
  const fila = (c, v, cls) => `<tr><td>${c}</td><td class="nz-table__num nz-table__right ${cls||""} ${imp?"":"pa-importe"}">${imp?fmt(v):""}</td></tr>`;
  $("#res-totales").innerHTML = `
    <article class="nz-article"><h3 class="nz-h3">Totales de la oferta</h3>
    <div class="nz-table-wrap"><table class="nz-table">
      <tbody>
        ${fila("Consultoría (horas × tarifas)", importeProyecto(pr))}
        ${fila("Gastos generales", gastosTotal(pr))}
        ${fila("Subtotal", subtotalProyecto(pr), "nz-table__strong")}
        ${(pr.descuento&&pr.descuento.tipo)?fila(`Descuento (${pr.descuento.tipo==="%"?num(pr.descuento.valor)+"%":"fijo"})`, -descuentoImporte(pr)):""}
        ${fila("Base imponible", baseImponible(pr))}
        ${fila(nombreImpuesto(pr) ? `${nombreImpuesto(pr)} ${num((pr.impuestos||{}).tasa)}%${(pr.impuestos||{}).incluido?" (incluido)":""}` : "Sin impuestos", impuestoImporte(pr))}
      </tbody>
      <tfoot><tr><td><strong>TOTAL</strong></td><td class="nz-table__num nz-table__right">${imp?fmt(totalProyecto(pr)):""}</td></tr></tfoot>
    </table></div></article>`;
  const map = horasPorPerfil(pr);
  const filas = ESTADO.perfiles.map(p => {
    const h = map.get(p.id) || 0;
    if (!h) return "";
    return `<tr><td>${esc(p.nombre)}<br><span class="pa-mini">${esc(p.categoria)}</span></td><td class="nz-table__num nz-table__right">${fmtH(h)}</td><td class="nz-table__num nz-table__right pa-importe">${imp?fmt(r2(h*num(p.tarifa))):""}</td></tr>`;
  }).join("");
  $("#res-perfiles").innerHTML = `
    <article class="nz-article"><h3 class="nz-h3">Esfuerzo por perfil</h3>
    <div class="nz-table-wrap"><table class="nz-table">
      <thead><tr><th>Perfil</th><th class="nz-table__right">Horas</th><th class="nz-table__right pa-col-importe">Importe</th></tr></thead>
      <tbody>${filas || `<tr><td colspan="3">Sin horas asignadas todavía.</td></tr>`}</tbody>
      <tfoot><tr><td>Total</td><td class="nz-table__num nz-table__right">${fmtH(horasProyecto(pr))}</td><td class="nz-table__num nz-table__right pa-col-importe">${imp?fmt(importeProyecto(pr)):""}</td></tr></tfoot>
    </table></div></article>`;
  $("#res-tareas").innerHTML = `
    <article class="nz-article"><h3 class="nz-h3">Por tareas</h3>
    <div class="nz-table-wrap"><table class="nz-table">
      <thead><tr><th>Tarea</th><th class="nz-table__right">Subtareas</th><th class="nz-table__right">Horas</th><th class="nz-table__right pa-col-importe">Importe</th></tr></thead>
      <tbody>${(pr.tareas||[]).map(t=>`<tr><td>${esc(t.nombre)}</td><td class="nz-table__num nz-table__right">${(t.subtareas||[]).length}</td><td class="nz-table__num nz-table__right">${fmtH(tareaHoras(t))}</td><td class="nz-table__num nz-table__right pa-col-importe">${imp?fmt(tareaImporte(t)):""}</td></tr>`).join("") || `<tr><td colspan="4">Sin tareas.</td></tr>`}</tbody>
      <tfoot><tr><td>Total</td><td class="nz-table__num nz-table__right">${(pr.tareas||[]).reduce((a,t)=>a+(t.subtareas||[]).length,0)}</td><td class="nz-table__num nz-table__right">${fmtH(horasProyecto(pr))}</td><td class="nz-table__num nz-table__right pa-col-importe">${imp?fmt(importeProyecto(pr)):""}</td></tr></tfoot>
    </table></div></article>`;
  updateKPIs();
}

/* ---------- Render: cronograma ---------- */
function renderCronograma(){
  const pr = proyectoActivo(); if (!pr) return;
  const imp = ESTADO.mostrarImportes;
  const valores = Array.from({length:pr.meses},(_,i)=> imp ? importeMes(pr,i) : horasMes(pr,i));
  const max = Math.max(...valores, 1);
  const cols = valores.map((v,i)=>`
    <div class="nz-chart-bar__col" title="${etiquetaMes(pr,i)}: ${imp?fmt(v):fmtH(v)}">
      <div class="nz-chart-bar__bar" style="height:${Math.max(2, v/max*100)}%"></div>
      <span class="nz-chart-bar__label">${etiquetaMes(pr,i)}</span>
    </div>`).join("");
  $("#cro-barras").innerHTML = `
    <figure class="nz-chart"><div class="nz-chart__head"><div>
      <span class="nz-chart__title">${imp?"Importe por mes":"Horas por mes"}</span>
      <span class="nz-chart__sub">${pr.meses} meses desde ${etiquetaMes(pr,0)}</span>
    </div></div>
    <div class="nz-chart__body"><div class="nz-chart-bar nz-chart-bar--sm">${cols}</div></div>
    <figcaption class="nz-chart__source">${imp?"Pasa el ratón por cada barra para ver el importe exacto.":"Modo solo tiempos: activa 👁 € para ver importes."}</figcaption></figure>`;
  const cab = `<tr><th>Tarea</th>${Array.from({length:pr.meses},(_,i)=>`<th class="nz-table__right">${etiquetaMes(pr,i)}</th>`).join("")}<th class="nz-table__right">Total</th></tr>`;
  const filas = (pr.tareas||[]).map(t=>{
    const horasMes = Array.from({length:pr.meses},()=>0);
    (t.subtareas||[]).forEach(s=>(s.lineas||[]).forEach(l=>{ for(let i=0;i<pr.meses;i++) horasMes[i]+=num((l.horas||{})["m"+i]); }));
    return `<tr><td class="nz-table__strong">${esc(t.nombre)}</td>${horasMes.map(h=>`<td class="nz-table__num nz-table__right">${h?h.toLocaleString("es-ES"):"·"}</td>`).join("")}<td class="nz-table__num nz-table__right"><strong>${fmtH(tareaHoras(t))}</strong></td></tr>`;
  }).join("");
  $("#cro-tabla").innerHTML = `<article class="nz-article"><div class="nz-table-wrap"><table class="nz-table nz-table--compact"><thead>${cab}</thead><tbody>${filas||`<tr><td colspan="2">Sin tareas.</td></tr>`}</tbody></table></div></article>`;
  updateKPIs();
}

/* ---------- Render: gastos ---------- */
function renderGastos(){
  const pr = proyectoActivo(); if (!pr) return;
  $("#gas-lista").innerHTML = (pr.gastos||[]).map(g=>`
    <div class="pa-fila-gasto" data-id="${g.id}">
      <input class="nz-input pa-crece2" data-campo="gasto-nombre" data-id="${g.id}" value="${esc(g.nombre)}" placeholder="Concepto">
      <label class="pa-mini">Uds <input class="nz-input nz-input--sm pa-input-num" type="number" step="0.01" min="0" value="${num(g.unidades)||""}" data-campo="gasto-unidades" data-id="${g.id}"></label>
      <label class="pa-mini">Precio <input class="nz-input nz-input--sm pa-input-num" type="number" step="0.01" min="0" value="${num(g.precio)||""}" data-campo="gasto-precio" data-id="${g.id}"></label>
      <strong class="pa-importe" style="min-width:100px;text-align:right">${fmt(num(g.unidades)*num(g.precio))}</strong>
      <button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="elim-gasto" data-id="${g.id}" title="Eliminar">✕</button>
    </div>`).join("") || `<p class="pa-mini">Sin gastos generales. Añade conceptos como viajes, licencias o material.</p>`;
  $("#gas-total").textContent = ESTADO.mostrarImportes ? "Gastos: " + fmt(gastosTotal(pr)) : "";
}

/* ---------- Render: informe ---------- */
function renderInforme(){
  const pr = proyectoActivo(); if (!pr) return;
  const cont = $("#informe-cuerpo"); if (!cont) return;
  const imp = ESTADO.mostrarImportes;
  const mon = ESTADO.marca.nombre || "Planifica";
  const filas = [];
  (pr.tareas||[]).forEach(t=>{
    filas.push(`<tr><td colspan="5" style="background:var(--nz-surface-2,var(--nz-surface));font-weight:800">${esc(t.nombre)}</td></tr>`);
    (t.subtareas||[]).forEach(s=>{
      filas.push(`<tr><td style="padding-left:18px">${esc(s.nombre)}</td><td></td><td class="pa-num ${imp?"":"pa-importe"}">${imp?fmt(subImporte(s)):""}</td><td class="pa-num">${fmtH(subHoras(s))}</td><td></td></tr>`);
      (s.lineas||[]).forEach(l=>{
        const pf = perfilPorId(l.perfilId);
        filas.push(`<tr><td style="padding-left:36px;color:var(--nz-text-soft)">${esc(pf?pf.nombre:"(perfil eliminado)")}</td><td class="pa-num ${imp?"":"pa-importe"}">${imp?fmt(num(pf?pf.tarifa:0)):""}</td><td class="pa-num ${imp?"":"pa-importe"}">${imp?fmt(lineaImporte(l)):""}</td><td class="pa-num">${fmtH(lineaHoras(l))}</td><td>${pr.meses} meses</td></tr>`);
      });
    });
  });
  const map = horasPorPerfil(pr);
  const resPerf = ESTADO.perfiles.filter(p=>map.get(p.id)).map(p=>`<tr><td>${esc(p.nombre)} <span class="pa-mini">(${esc(p.categoria)})</span></td><td class="pa-num">${fmtH(map.get(p.id))}</td><td class="pa-num ${imp?"":"pa-importe"}">${imp?fmt(r2(map.get(p.id)*num(p.tarifa))):""}</td></tr>`).join("");
  const anual = [...anualidades(pr).entries()].map(([y,v])=>`<tr><td>${y}</td><td class="pa-num ${imp?"":"pa-importe"}">${imp?fmt(v):""}</td></tr>`).join("");
  const t = pr.impuestos||{};
  cont.innerHTML = `
    <div class="pa-informe__cab">
      <div><div style="font-size:1.1rem;font-weight:800">${esc(mon)}</div><div class="pa-mini">${esc(ESTADO.marca.sub||"")}</div></div>
      <div class="pa-mini" style="text-align:right">${badgeEstado(pr)}<br>${pr.fecha ? "Fecha: "+pr.fecha : ""}<br>Válido hasta ${fechaValidez(pr)}</div>
    </div>
    <h1>${esc(pr.nombre)}</h1>
    <p class="pa-mini">${pr.cliente.nombre ? "Cliente: "+esc(pr.cliente.nombre)+`${pr.cliente.ref?" · Ref. "+esc(pr.cliente.ref):""} · ` : ""}Duración: ${pr.meses} meses desde ${etiquetaMes(pr,0)} · ${fmtH(horasProyecto(pr))}${pr.descripcion ? "<br>"+esc(pr.descripcion) : ""}</p>
    <h2>Detalle de tareas</h2>
    <table><thead><tr><th>Concepto</th><th class="pa-num">Tarifa</th><th class="pa-num">Importe</th><th class="pa-num">Horas</th><th>Periodo</th></tr></thead><tbody>${filas.join("")||`<tr><td colspan="5">Sin contenido.</td></tr>`}</tbody></table>
    ${pr.gastos && pr.gastos.length ? `<h2>Gastos generales</h2><table><thead><tr><th>Concepto</th><th class="pa-num">Uds</th><th class="pa-num">Precio</th><th class="pa-num">Importe</th></tr></thead><tbody>${pr.gastos.map(g=>`<tr><td>${esc(g.nombre)}</td><td class="pa-num">${num(g.unidades)}</td><td class="pa-num ${imp?"":"pa-importe"}">${imp?fmt(num(g.precio)):""}</td><td class="pa-num ${imp?"":"pa-importe"}">${imp?fmt(num(g.unidades)*num(g.precio)):""}</td></tr>`).join("")}</tbody></table>` : ""}
    <h2>Totales</h2>
    <table><tbody>
      <tr><td>Consultoría</td><td class="pa-num ${imp?"":"pa-importe"}">${imp?fmt(importeProyecto(pr)):""}</td></tr>
      ${gastosTotal(pr)?`<tr><td>Gastos generales</td><td class="pa-num ${imp?"":"pa-importe"}">${imp?fmt(gastosTotal(pr)):""}</td></tr>`:""}
      <tr><td><strong>Subtotal</strong></td><td class="pa-num ${imp?"":"pa-importe"}"><strong>${imp?fmt(subtotalProyecto(pr)):""}</strong></td></tr>
      ${(pr.descuento&&pr.descuento.tipo)?`<tr><td>Descuento (${pr.descuento.tipo==="%"?num(pr.descuento.valor)+"%":"fijo"})</td><td class="pa-num ${imp?"":"pa-importe"}">${imp?"−"+fmt(descuentoImporte(pr)):""}</td></tr>`:""}
      <tr><td>Base imponible</td><td class="pa-num ${imp?"":"pa-importe"}">${imp?fmt(baseImponible(pr)):""}</td></tr>
      ${nombreImpuesto(pr)?`<tr><td>${nombreImpuesto(pr)} ${num(t.tasa)}%${t.incluido?" (incluido)":""}</td><td class="pa-num ${imp?"":"pa-importe"}">${imp?fmt(impuestoImporte(pr)):""}</td></tr>`:""}
    </tbody><tfoot><tr><td><strong>TOTAL</strong></td><td class="pa-num ${imp?"":"pa-importe"}"><strong>${imp?fmt(totalProyecto(pr)):""}</strong></td></tr></tfoot></table>
    ${pr.condicionesPago ? `<p><strong>Condiciones de pago:</strong> ${esc(pr.condicionesPago)}</p>` : ""}
    <h2>Resumen por perfil</h2>
    <table><thead><tr><th>Perfil</th><th class="pa-num">Horas</th><th class="pa-num">Importe</th></tr></thead><tbody>${resPerf||`<tr><td colspan="3">—</td></tr>`}</tbody></table>
    <h2>Importe mensual${imp?"":""}</h2>
    <table><thead><tr><th>Mes</th><th class="pa-num">Importe</th></tr></thead><tbody>${Array.from({length:pr.meses},(_,i)=>`<tr><td>${etiquetaMes(pr,i)}</td><td class="pa-num ${imp?"":"pa-importe"}">${imp?fmt(importeMes(pr,i)):""}</td></tr>`).join("")}</tbody></table>
    <h2>Anualidades</h2>
    <table><thead><tr><th>Año</th><th class="pa-num">Importe</th></tr></thead><tbody>${anual}</tbody>
    <tfoot><tr><td><strong>TOTAL${gastosTotal(pr)?" (incluye gastos)":""}</strong></td><td class="pa-num ${imp?"":"pa-importe"}"><strong>${imp?fmt(totalProyecto(pr)):""}</strong></td></tr></tfoot></table>
    <div class="pa-informe__pie"><span>Generado con ${esc(mon)}</span><span>${hoy()}</span></div>`;
}
function imprimir(){ window.print(); }

/* ---------- Render: ajustes ---------- */
function renderAjustes(){
  const m = ESTADO.marca;
  $("#ajustes-cuerpo").innerHTML = `
    <article class="nz-article">
      <h3 class="nz-h3">Marca</h3>
      <div class="nz-formgrid nz-formgrid--2">
        <label class="nz-field"><span class="nz-field__label">Nombre de la marca</span><input class="nz-input" id="aj-marca" value="${esc(m.nombre||"")}"></label>
        <label class="nz-field"><span class="nz-field__label">Lema / subtítulo</span><input class="nz-input" id="aj-sub" value="${esc(m.sub||"")}"></label>
        <label class="nz-field"><span class="nz-field__label">Moneda</span><input class="nz-input" id="aj-moneda" value="${esc(m.moneda||"€")}" maxlength="4"></label>
        <div class="nz-field"><span class="nz-field__label">Logo</span>
          <span class="pa-fila"><button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="cargar-logo">🖼 Cargar logo</button>
          ${m.logo?`<button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="quitar-logo">Quitar</button>`:""}</span>
          <span class="nz-field__help">Se guarda dentro de tus datos (no se sube a ningún sitio).</span>
        </div>
      </div>
      <label class="nz-switch" style="margin-top:var(--nz-space-2)"><input type="checkbox" id="aj-importes" ${ESTADO.mostrarImportes?"checked":""}><span class="nz-switch__track"><span class="nz-switch__thumb"></span></span><span class="nz-switch__label">Mostrar importes (€)</span></label>
    </article>

    <article class="nz-article">
      <h3 class="nz-h3">Datos de la oferta activa</h3>
      ${camposOferta()}
    </article>

    <article class="nz-article">
      <h3 class="nz-h3">Perfiles del equipo</h3>
      <p class="pa-mini">Biblioteca global: se usan en todas tus ofertas. Los perfiles marcados como «por defecto» se pueden editar y ↺ los restaura. Exporta la biblioteca para reutilizarla en otro navegador.</p>
      <div class="pa-fila" style="margin:var(--nz-space-2) 0">
        <button class="nz-btn nz-btn--primary nz-btn--sm" data-acc="nuevo-perfil">＋ Perfil</button>
        <button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="restaurar-perfiles-defecto" title="Restaura los 7 perfiles por defecto (los tuyos se conservan)">↺ Defectos</button>
        <span class="pa-espacio"></span>
        <button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="exp-biblio">⬇ Exportar biblioteca</button>
      </div>
      ${ESTADO.perfiles.map(p=>htmlPerfil(p)).join("") || `<p class="pa-mini">Sin perfiles. Añade perfiles de tu equipo con sus tarifas.</p>`}
      ${ESTADO.perfilesInactivos.length?`<h4 class="nz-h4" style="margin-top:var(--nz-space-3)">Desactivados</h4>${ESTADO.perfilesInactivos.map(p=>`
        <div class="pa-fila-perfil"><span class="pa-crece">${esc(p.nombre)} <span class="pa-mini">(${esc(p.categoria)})</span></span>
        <button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="reactivar-perfil" data-id="${p.id}">Reactivar</button></div>`).join("")}`:""}
    </article>

    <article class="nz-article">
      <h3 class="nz-h3">Plantillas de tareas recurrentes</h3>
      <p class="pa-mini">Guarda estructuras de tareas que repites en cada oferta y aplícalas con un clic. Las de fábrica se restauran con ↺.</p>
      <div class="pa-fila" style="margin:var(--nz-space-2) 0">
        <button class="nz-btn nz-btn--primary nz-btn--sm" data-acc="guardar-plantilla">💾 Guardar estructura actual como plantilla</button>
        <button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="restaurar-plantillas-defecto">↺ Defectos</button>
      </div>
      ${(ESTADO.plantillas||[]).map(pl=>`
        <div class="pa-fila-perfil">
          <span class="pa-crece2"><strong>${esc(pl.nombre)}</strong>${pl.esDefecto?` <span class="nz-badge nz-badge--neutral">por defecto</span>`:""}<br><span class="pa-mini">${esc(pl.desc||"")} · ${pl.tareas.length} tareas</span></span>
          <button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="plantilla-dialogo" title="Aplicar plantillas a la oferta activa">Aplicar…</button>
          <button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="elim-plantilla" data-id="${pl.id}" title="Eliminar plantilla">✕</button>
        </div>`).join("") || `<p class="pa-mini">Sin plantillas.</p>`}
    </article>

    <article class="nz-article">
      <h3 class="nz-h3">Datos y copias de seguridad</h3>
      <div class="pa-fila">
        <button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="exp-json-todo">⬇ Copia completa (JSON)</button>
        <button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="imp-json">⬆ Importar JSON</button>
        <button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="exp-csv">⬇ CSV de la oferta</button>
        <button class="nz-btn nz-btn--soft nz-btn--sm" data-acc="imprimir">🖨 Informe PDF</button>
      </div>
      <p class="pa-mini" style="margin-top:var(--nz-space-2)">Todo se guarda solo en este navegador. Nadie más ve tus datos.</p>
      <div class="pa-fila" style="margin-top:var(--nz-space-3)">
        <button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="restaurar-demo">Volver al ejemplo de inicio</button>
        <button class="nz-btn nz-btn--danger nz-btn--sm" data-acc="borrar-todo">Borrar todos los datos</button>
      </div>
    </article>`;
  const pr = proyectoActivo();
}
function camposOferta(){
  const pr = proyectoActivo(); if (!pr) return "";
  const t = pr.impuestos||{}, d = pr.descuento||{};
  return `
    <div class="nz-formgrid nz-formgrid--2">
      <label class="nz-field"><span class="nz-field__label">Cliente</span><input class="nz-input" data-campo="proyecto-cliente-nombre" value="${esc(pr.cliente.nombre||"")}" placeholder="Nombre del cliente"></label>
      <label class="nz-field"><span class="nz-field__label">Persona de contacto</span><input class="nz-input" data-campo="proyecto-cliente-contacto" value="${esc(pr.cliente.contacto||"")}" placeholder="Nombre · email · teléfono"></label>
      <label class="nz-field"><span class="nz-field__label">Referencia / expediente</span><input class="nz-input" data-campo="proyecto-cliente-ref" value="${esc(pr.cliente.ref||"")}"></label>
      <label class="nz-field"><span class="nz-field__label">Estado de la oferta</span>
        <select class="nz-input" data-campo="proyecto-estado">${Object.entries(ESTADOS_OFERTA).map(([k,v])=>`<option value="${k}" ${pr.estado===k?"selected":""}>${v.texto}</option>`).join("")}</select></label>
      <label class="nz-field"><span class="nz-field__label">Fecha de la oferta</span><input class="nz-input pa-input-fecha" type="date" data-campo="proyecto-fecha" value="${esc(pr.fecha||"")}"></label>
      <label class="nz-field"><span class="nz-field__label">Validez (días)</span><input class="nz-input pa-input-num" type="number" min="0" data-campo="proyecto-validez" value="${num(pr.validezDias)||30}"></label>
      <label class="nz-field"><span class="nz-field__label">Inicio de ejecución</span><input class="nz-input pa-input-fecha" type="month" data-campo="proyecto-inicio" value="${esc(pr.fechaInicio||"")}"></label>
      <label class="nz-field"><span class="nz-field__label">Duración (meses)</span><input class="nz-input pa-input-num" type="number" min="1" max="60" data-campo="proyecto-meses" value="${pr.meses||12}"></label>
      <label class="nz-field pa-ancho"><span class="nz-field__label">Condiciones de pago</span><input class="nz-input" data-campo="proyecto-pago" value="${esc(pr.condicionesPago||"")}" placeholder="Ej.: 30% a la firma, 40% a mitad, 30% a la entrega"></label>
      <label class="nz-field pa-ancho"><span class="nz-field__label">Descripción / alcance</span><textarea class="nz-input" rows="2" data-campo="proyecto-desc">${esc(pr.descripcion||"")}</textarea></label>
      <label class="nz-field"><span class="nz-field__label">Impuesto</span>
        <select class="nz-input" data-campo="proyecto-impuesto-tipo">
          <option value="iva" ${t.tipo==="iva"?"selected":""}>IVA (se añade)</option>
          <option value="irpf" ${t.tipo==="irpf"?"selected":""}>IRPF (retención)</option>
          <option value="ninguno" ${(!t.tipo||t.tipo==="ninguno")?"selected":""}>Sin impuestos</option>
        </select></label>
      <label class="nz-field"><span class="nz-field__label">Tipo %</span><input class="nz-input pa-input-num" type="number" min="0" max="100" step="0.5" data-campo="proyecto-impuesto-tasa" value="${num(t.tasa ?? 21)}"></label>
      <label class="nz-field"><span class="nz-field__label">Descuento</span>
        <select class="nz-input" data-campo="proyecto-descuento-tipo">
          <option value="" ${!d.tipo?"selected":""}>Sin descuento</option>
          <option value="%" ${d.tipo==="%"?"selected":""}>Porcentaje</option>
          <option value="fijo" ${d.tipo==="fijo"?"selected":""}>Importe fijo</option>
        </select></label>
      <label class="nz-field"><span class="nz-field__label">Valor del descuento</span><input class="nz-input pa-input-num" type="number" min="0" step="0.01" data-campo="proyecto-descuento-valor" value="${num(d.valor)||""}"></label>
      <label class="nz-switch"><input type="checkbox" data-campo="proyecto-impuesto-incluido" ${t.incluido?"checked":""}><span class="nz-switch__track"><span class="nz-switch__thumb"></span></span><span class="nz-switch__label">Impuesto ya incluido en los precios</span></label>
    </div>`;
}
function htmlPerfil(p){
  return `
    <div class="pa-fila-perfil" data-id="${p.id}">
      <input class="nz-input pa-crece2" data-campo="perfil-nombre" data-id="${p.id}" value="${esc(p.nombre)}">
      <select class="nz-input nz-input--sm" data-campo="perfil-categoria" data-id="${p.id}" style="min-width:150px">
        ${CATEGORIAS_PERFIL.map(c=>`<option ${p.categoria===c?"selected":""}>${c}</option>`).join("")}
      </select>
      <label class="pa-mini">Tarifa <input class="nz-input nz-input--sm pa-input-num" type="number" step="0.01" min="0" value="${num(p.tarifa)||""}" data-campo="perfil-tarifa" data-id="${p.id}"></label>
      <label class="pa-mini">Ud <input class="nz-input nz-input--sm" style="width:3.5rem" value="${esc(p.unidades||"h")}" data-campo="perfil-unidades" data-id="${p.id}"></label>
      ${p.esDefecto?`<span class="nz-badge nz-badge--neutral">defecto</span><button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="restaurar-perfil" data-id="${p.id}" title="Restaurar valores de fábrica">↺</button>`:""}
      <span class="pa-mini">${usosPerfil(p.id)} usos</span>
      <button class="nz-btn nz-btn--ghost nz-btn--sm" data-acc="elim-perfil" data-id="${p.id}" title="Eliminar o desactivar perfil">✕</button>
    </div>`;
}

function cambiarMeses(n){
  const pr = proyectoActivo(); if (!pr) return;
  const m = Math.max(1, Math.min(60, Math.round(num(n))));
  pr.meses = m;
  pr.tareas.forEach(t=>t.subtareas.forEach(s=>s.lineas.forEach(l=>{
    const h = l.horas = l.horas || {};
    for (let i=0;i<m;i++) if (!(("m"+i) in h)) h["m"+i]=0;
    Object.keys(h).forEach(k=>{ const idx=parseInt(k.slice(1)); if(isNaN(idx)||idx>=m) delete h[k]; });
  })));
  renderTodo();
}

/* ---------- Orquestación de render ---------- */
function renderTodo(){
  renderCabecera(); updateKPIs(); renderEstructura(); renderResumen(); renderCronograma(); renderGastos(); renderAjustes();
}
function renderDatos(){ updateKPIs(); renderResumen(); renderCronograma(); renderGastos(); guardar(); }

/* ---------- Búsquedas ---------- */
function buscarTarea(id, pr){ const p = pr || proyectoActivo(); for (const t of (p.tareas||[])) if (t.id===id) return t; return null; }
function buscarSub(id, pr){
  const p = pr || proyectoActivo();
  for (const t of (p.tareas||[])) for (const s of (t.subtareas||[])) if (s.id===id) return {tarea:t, sub:s};
  return null;
}
function buscarLinea(id, pr){
  const p = pr || proyectoActivo();
  for (const t of (p.tareas||[])) for (const s of (t.subtareas||[])) for (const l of (s.lineas||[])) if (l.id===id) return {tarea:t, sub:s, linea:l};
  return null;
}
function clonar(obj){ return JSON.parse(JSON.stringify(obj)); }
function reIdProyecto(c){
  c.id = uid("pr_");
  c.gastos.forEach(g=>g.id=uid("g_"));
  c.tareas.forEach(t=>{t.id=uid("ta_");t.subtareas.forEach(s=>{s.id=uid("sb_");s.lineas.forEach(l=>l.id=uid("ln_"));});});
  return c;
}

/* ---------- Plantillas ---------- */
function abrirDialogoPlantillas(){
  const dlg = $("#pa-modal-plantillas"); if (!dlg) return;
  $("#pa-modal-plantillas-lista").innerHTML = (ESTADO.plantillas||[]).map(pl=>`
    <div class="pa-fila-perfil">
      <span class="pa-crece2"><strong>${esc(pl.nombre)}</strong><br><span class="pa-mini">${esc(pl.desc||"")} · ${pl.tareas.length} tareas</span></span>
      <button class="nz-btn nz-btn--primary nz-btn--sm" data-acc="aplicar-plantilla" data-id="${pl.id}">Aplicar</button>
    </div>`).join("") || `<p class="pa-mini">No hay plantillas.</p>`;
  dlg.checked = true;
}
function aplicarPlantilla(id, reemplazar){
  const pl = (ESTADO.plantillas||[]).find(x=>x.id===id); if (!pl) return;
  const pr = proyectoActivo();
  if ((pr.tareas||[]).length && !reemplazar && !confirm(`¿Añadir las ${pl.tareas.length} tareas de «${pl.nombre}» a la oferta actual?`)) return;
  if (reemplazar && (pr.tareas||[]).length && !confirm(`¿REEMPLAZAR las ${pr.tareas.length} tareas actuales por la plantilla «${pl.nombre}»?`)) return;
  const nuevas = pl.tareas.map(t=>{
    const ta = nuevaTarea(t.nombre);
    ta.subtareas = (t.subtareas||[]).map(s => nuevaSub(s));
    return ta;
  });
  pr.tareas = reemplazar ? nuevas : pr.tareas.concat(nuevas);
  $("#pa-modal-plantillas").checked = false;
  renderTodo(); guardar();
  toast(reemplazar ? "Estructura reemplazada por la plantilla" : "Plantilla aplicada: " + pl.tareas.length + " tareas");
}
function guardarEstructuraComoPlantilla(){
  const pr = proyectoActivo();
  if (!(pr.tareas||[]).length){ toast("La oferta activa no tiene tareas que guardar"); return; }
  const nombre = prompt("Nombre de la plantilla:", "Plantilla — " + pr.nombre);
  if (!nombre) return;
  const pl = {
    id: uid("pl_"), nombre, desc: "Guardada desde «" + pr.nombre + "»", esDefecto: false,
    tareas: pr.tareas.map(t => ({ nombre: t.nombre, subtareas: (t.subtareas||[]).map(s => s.nombre) }))
  };
  ESTADO.plantillas.push(normalizarPlantilla(pl));
  guardar(); toast("Plantilla guardada: " + nombre);
}

/* ---------- Acciones ---------- */
const acc = {
  "nueva-tarea": () => { const pr=proyectoActivo(); pr.tareas.push(nuevaTarea("Tarea "+(pr.tareas.length+1))); renderTodo(); guardar(); },
  "elim-tarea": id => { const pr=proyectoActivo(); const i=pr.tareas.findIndex(t=>t.id===id); if(i<0)return; if(!confirm(`¿Eliminar la tarea «${pr.tareas[i].nombre}» y todo su contenido?`))return; pr.tareas.splice(i,1); renderTodo(); guardar(); },
  "dup-tarea": id => { const pr=proyectoActivo(); const t=buscarTarea(id); if(!t)return; const c=clonar(t); c.id=uid("ta_"); c.nombre=t.nombre+" (copia)"; c.subtareas.forEach(s=>{s.id=uid("sb_"); s.lineas.forEach(l=>l.id=uid("ln_"));}); pr.tareas.splice(pr.tareas.indexOf(t)+1,0,c); renderTodo(); guardar(); },
  "subir-tarea": id => moverTarea(id,-1), "bajar-tarea": id => moverTarea(id,1),
  "nueva-sub": id => { const t=buscarTarea(id); if(!t)return; t.subtareas.push(nuevaSub("Subtarea "+(t.subtareas.length+1))); renderTodo(); guardar(); },
  "elim-sub": id => { const r=buscarSub(id); if(!r)return; if(!confirm(`¿Eliminar la subtarea «${r.sub.nombre}»?`))return; r.tarea.subtareas.splice(r.tarea.subtareas.indexOf(r.sub),1); renderTodo(); guardar(); },
  "dup-sub": id => { const r=buscarSub(id); if(!r)return; const c=clonar(r.sub); c.id=uid("sb_"); c.nombre=r.sub.nombre+" (copia)"; c.lineas.forEach(l=>l.id=uid("ln_")); r.tarea.subtareas.splice(r.tarea.subtareas.indexOf(r.sub)+1,0,c); renderTodo(); guardar(); },
  "subir-sub": id => moverSub(id,-1), "bajar-sub": id => moverSub(id,1),
  "toggle-sub": id => { const r=buscarSub(id); if(!r)return; r.sub._abierta=!r.sub._abierta; renderEstructura(); },
  "abrir-todo": () => { proyectoActivo().tareas.forEach(t=>t.subtareas.forEach(s=>s._abierta=true)); renderEstructura(); },
  "cerrar-todo": () => { proyectoActivo().tareas.forEach(t=>t.subtareas.forEach(s=>s._abierta=false)); renderEstructura(); },
  "nueva-linea": id => { const r=buscarSub(id); if(!r)return; const pf=ESTADO.perfiles[0]; r.sub.lineas.push(nuevaLinea(pf?pf.id:"", proyectoActivo().meses)); r.sub._abierta=true; renderTodo(); guardar(); },
  "elim-linea": id => { const r=buscarLinea(id); if(!r)return; r.sub.lineas.splice(r.sub.lineas.indexOf(r.linea),1); renderTodo(); guardar(); },
  "nueva-gasto": () => { proyectoActivo().gastos.push({id:uid("g_"),nombre:"Concepto",unidades:1,precio:0}); renderGastos(); renderDatos(); },
  "elim-gasto": id => { const pr=proyectoActivo(); pr.gastos=pr.gastos.filter(g=>g.id!==id); renderGastos(); renderDatos(); },
  "nuevo-proyecto": () => { const p=nuevoProyecto("Oferta sin título"); ESTADO.proyectos.push(p); ESTADO.activo=p.id; renderTodo(); guardar(); toast("Oferta creada"); },
  "dup-proyecto": () => { const pr=proyectoActivo(); const c=reIdProyecto(clonar(pr)); c.nombre=pr.nombre+" (copia)"; c.estado="borrador"; ESTADO.proyectos.push(c); ESTADO.activo=c.id; renderTodo(); guardar(); toast("Oferta duplicada"); },
  "elim-proyecto": () => { const pr=proyectoActivo(); if(ESTADO.proyectos.length<=1){toast("Debe existir al menos una oferta");return;} if(!confirm(`¿Eliminar la oferta «${pr.nombre}»? Esta acción no se puede deshacer.`))return; ESTADO.proyectos=ESTADO.proyectos.filter(p=>p.id!==pr.id); ESTADO.activo=ESTADO.proyectos[0].id; renderTodo(); guardar(); },
  "nuevo-perfil": () => { ESTADO.perfiles.push(nuevoPerfil("Perfil nuevo", 0, "Otro", false)); renderAjustes(); guardar(); },
  "elim-perfil": id => {
    const p=perfilPorId(id); if(!p)return; const usos=usosPerfil(id);
    if(usos>0){ if(confirm(`«${p.nombre}» se usa en ${usos} línea(s). ¿Desactivarlo? Sus datos se conservan y puedes reactivarlo luego.`)){ ESTADO.perfiles=ESTADO.perfiles.filter(x=>x.id!==id); ESTADO.perfilesInactivos.push(p); } else return; }
    else { if(!confirm(`¿Eliminar el perfil «${p.nombre}»?`))return; ESTADO.perfiles=ESTADO.perfiles.filter(x=>x.id!==id); }
    renderAjustes(); renderDatos();
  },
  "restaurar-perfil": id => {
    const actual = perfilPorId(id); if(!actual || !actual.esDefecto) return;
    const orig = perfilesDefecto().find(x=>x.id===id); if(!orig){ toast("Este perfil ya no es de fábrica"); return; }
    if(!confirm(`¿Restaurar «${actual.nombre}» a sus valores de fábrica?`)) return;
    actual.nombre=orig.nombre; actual.tarifa=orig.tarifa; actual.categoria=orig.categoria; actual.unidades=orig.unidades;
    renderAjustes(); renderDatos(); toast("Perfil restaurado");
  },
  "restaurar-perfiles-defecto": () => {
    if(!confirm("¿Añadir los 7 perfiles por defecto? Los que falten se recrean; los tuyos se conservan."))return;
    perfilesDefecto().forEach(d=>{ if(!perfilPorId(d.id)) ESTADO.perfiles.push(d); });
    renderAjustes(); guardar(); toast("Perfiles por defecto disponibles");
  },
  "reactivar-perfil": id => { const p=ESTADO.perfilesInactivos.find(x=>x.id===id); if(!p)return; ESTADO.perfilesInactivos=ESTADO.perfilesInactivos.filter(x=>x.id!==id); ESTADO.perfiles.push(p); renderAjustes(); guardar(); },
  "exp-biblio": () => { descargar(`planifica-biblioteca-${hoyISO()}.json`, JSON.stringify({tipo:"planifica-biblioteca", perfiles:ESTADO.perfiles, perfilesInactivos:ESTADO.perfilesInactivos, plantillas:ESTADO.plantillas}, null, 2), "application/json"); toast("Biblioteca exportada"); },
  "guardar-plantilla": () => guardarEstructuraComoPlantilla(),
  "elim-plantilla": id => { if(!confirm("¿Eliminar esta plantilla?"))return; ESTADO.plantillas=ESTADO.plantillas.filter(x=>x.id!==id); renderAjustes(); guardar(); },
  "restaurar-plantillas-defecto": () => { if(!confirm("¿Recuperar la plantilla de fábrica?"))return; plantillasDefecto().forEach(d=>{ if(!(ESTADO.plantillas||[]).some(x=>x.id===d.id)) ESTADO.plantillas.push(d); }); renderAjustes(); guardar(); },
  "plantilla-dialogo": () => abrirDialogoPlantillas(),
  "aplicar-plantilla": id => aplicarPlantilla(id, $("#pa-modal-plantillas-reem") && $("#pa-modal-plantillas-reem").checked),
  "cerrar-modal-plantillas": () => { $("#pa-modal-plantillas").checked = false; },
  "cerrar-guia": () => { ESTADO.guiaVista = true; renderGuia(); guardar(); },
  "cargar-logo": () => $("#pa-logo-fichero").click(),
  "quitar-logo": () => { ESTADO.marca.logo=""; renderCabecera(); renderAjustes(); guardar(); },
  "exp-json-proy": () => { const pr=proyectoActivo(); descargar(`${slug(pr.nombre)}-${hoyISO()}.json`, JSON.stringify({tipo:"planifica-proyecto", proyecto:pr}, null, 2), "application/json"); },
  "exp-json-todo": () => { descargar(`planifica-datos-${hoyISO()}.json`, JSON.stringify(ESTADO, null, 2), "application/json"); toast("Copia de seguridad descargada"); },
  "imp-json": () => $("#pa-fichero").click(),
  "exp-csv": () => exportarCSV(),
  "imprimir": () => imprimir(),
  "toggle-importes": () => { ESTADO.mostrarImportes = !ESTADO.mostrarImportes; renderTodo(); guardar(); toast(ESTADO.mostrarImportes ? "Importes visibles" : "Modo solo tiempos: importes ocultos"); },
  "restaurar-demo": () => { if(!confirm("¿Restaurar los datos de ejemplo? Se reemplazan los datos actuales (antes se descarga una copia de seguridad)."))return; descargar(`planifica-copia-antes-de-restaurar.json`, JSON.stringify(ESTADO,null,2),"application/json"); ESTADO=estadoInicial(); ESTADO.activo=ESTADO.proyectos[0].id; renderTodo(); guardar(); toast("Datos de ejemplo restaurados"); },
  "borrar-todo": () => { if(!confirm("¿BORRAR todos los datos? Se reemplazan por una app vacía (antes se descarga una copia de seguridad)."))return; descargar(`planifica-copia-antes-de-borrar.json`, JSON.stringify(ESTADO,null,2),"application/json"); ESTADO=estadoInicial(); ESTADO.proyectos=[nuevoProyecto("Mi primera oferta")]; ESTADO.perfiles=[]; ESTADO.plantillas=[]; ESTADO.activo=ESTADO.proyectos[0].id; ESTADO.guiaVista=true; renderTodo(); guardar(); toast("Datos borrados"); }
};
function moverTarea(id, dir){
  const pr=proyectoActivo(); const i=pr.tareas.findIndex(t=>t.id===id); const j=i+dir;
  if(i<0||j<0||j>=pr.tareas.length)return;
  [pr.tareas[i],pr.tareas[j]]=[pr.tareas[j],pr.tareas[i]]; renderEstructura(); guardar();
}
function moverSub(id, dir){
  const r=buscarSub(id); if(!r)return; const arr=r.tarea.subtareas; const i=arr.indexOf(r.sub), j=i+dir;
  if(j<0||j>=arr.length)return;
  [arr[i],arr[j]]=[arr[j],arr[i]]; renderEstructura(); guardar();
}

/* ---------- CSV ---------- */
function exportarCSV(){
  const pr=proyectoActivo(); const sep=";";
  const imp=ESTADO.mostrarImportes;
  const filas=[["Oferta",pr.nombre],["Cliente",pr.cliente.nombre||""],["Estado",ESTADOS_OFERTA[pr.estado].texto],["Fecha",pr.fecha||""],["Válida hasta",fechaValidez(pr)],[],["Tarea","Subtarea","Perfil",...Array.from({length:pr.meses},(_,i)=>etiquetaMes(pr,i)),"Total horas","Tarifa","Importe"]];
  (pr.tareas||[]).forEach(t=>(t.subtareas||[]).forEach(s=>(s.lineas||[]).forEach(l=>{
    const pf=perfilPorId(l.perfilId);
    filas.push([
      t.nombre, s.nombre, pf ? pf.nombre : "(sin perfil)",
      ...Array.from({length: pr.meses}, (_,i) => String(num((l.horas||{})["m"+i])).replace(".", ",")),
      String(lineaHoras(l)).replace(".", ","),
      String(num(pf ? pf.tarifa : 0)).replace(".", ","),
      imp ? String(lineaImporte(l)).replace(".", ",") : ""
    ]);
  })));
  filas.push([]);
  filas.push(["Subtotal","","","","","","", imp?String(subtotalProyecto(pr)).replace(".",","):""]);
  if (pr.descuento&&pr.descuento.tipo) filas.push(["Descuento","","","","","","", imp?String(-descuentoImporte(pr)).replace(".",","):""]);
  filas.push(["Base imponible","","","","","","", imp?String(baseImponible(pr)).replace(".",","):""]);
  if (nombreImpuesto(pr)) filas.push([nombreImpuesto(pr)+" "+num((pr.impuestos||{}).tasa)+"%","","","","","","", imp?String(impuestoImporte(pr)).replace(".",","):""]);
  filas.push(["TOTAL","","","","","","", imp?String(totalProyecto(pr)).replace(".",","):""]);
  const csv="\uFEFF"+filas.map(f=>f.map(c=>`"${String(c??"").replace(/"/g,'""')}"`).join(sep)).join("\r\n");
  descargar(`${slug(pr.nombre)}-${hoyISO()}.csv`, csv, "text/csv;charset=utf-8");
  toast("CSV exportado");
}

/* ---------- Importar ---------- */
function importarJSON(texto){
  let data;
  try { data = JSON.parse(texto); } catch(e){ toast("El archivo no es un JSON válido"); return; }
  const esEstado = data && Array.isArray(data.proyectos);
  const esProyecto = data && data.tipo==="planifica-proyecto" && data.proyecto;
  const esBiblio = data && data.tipo==="planifica-biblioteca";
  if(!esEstado && !esProyecto && !esBiblio){ toast("Formato no reconocido: espera un JSON de Planifica"); return; }
  const reemplazar = confirm("ACEPTAR = Reemplazar TODOS los datos actuales\nCANCELAR = Fusionar (añade/reemplaza por id)");
  if(reemplazar){ descargar(`planifica-copia-anterior-${hoyISO()}.json`, JSON.stringify(ESTADO,null,2),"application/json"); }
  if(esBiblio){
    (data.perfiles||[]).forEach(pf0=>{ const pf=normalizarPerfil(pf0); if(!perfilPorId(pf.id)) ESTADO.perfiles.push(pf); });
    (data.perfilesInactivos||[]).forEach(pf0=>{ const pf=normalizarPerfil(pf0); if(!perfilPorId(pf.id)) ESTADO.perfilesInactivos.push(pf); });
    (data.plantillas||[]).forEach(pl0=>{ const pl=normalizarPlantilla(pl0); if(!(ESTADO.plantillas||[]).some(x=>x.id===pl.id)) ESTADO.plantillas.push(pl); });
    toast("Biblioteca importada");
  } else if(esProyecto){
    const p=normalizarProyecto(data.proyecto);
    const i=ESTADO.proyectos.findIndex(x=>x.id===p.id);
    if(i>=0) ESTADO.proyectos[i]=p; else ESTADO.proyectos.push(p);
    ESTADO.activo=p.id;
    toast("Oferta importada");
  } else {
    const esV1 = data.version === 1 || !data.version;
    if(reemplazar){
      ESTADO.marca=data.marca||ESTADO.marca;
      ESTADO.perfiles=(data.perfiles||[]).map(normalizarPerfil); ESTADO.perfilesInactivos=(data.perfilesInactivos||[]).map(normalizarPerfil);
      ESTADO.plantillas=(data.plantillas&&data.plantillas.length)?(data.plantillas.map(normalizarPlantilla)):plantillasDefecto();
      ESTADO.proyectos=(data.proyectos||[]).map(p=>normalizarProyecto(p, esV1)); ESTADO.activo=data.activo;
    } else {
      if(data.marca && confirm("¿Aplicar también la marca/configuración del archivo?")) ESTADO.marca=data.marca;
      (data.perfiles||[]).forEach(pf0=>{ const pf=normalizarPerfil(pf0); if(!perfilPorId(pf.id)) ESTADO.perfiles.push(pf); });
      (data.perfilesInactivos||[]).forEach(pf0=>{ const pf=normalizarPerfil(pf0); if(!perfilPorId(pf.id)) ESTADO.perfilesInactivos.push(pf); });
      (data.plantillas||[]).forEach(pl0=>{ const pl=normalizarPlantilla(pl0); if(!(ESTADO.plantillas||[]).some(x=>x.id===pl.id)) ESTADO.plantillas.push(pl); });
      (data.proyectos||[]).forEach(pr0=>{ const p=normalizarProyecto(pr0); const i=ESTADO.proyectos.findIndex(x=>x.id===p.id); if(i>=0) ESTADO.proyectos[i]=p; else ESTADO.proyectos.push(p); });
      ESTADO.activo=ESTADO.proyectos[0].id;
    }
    toast("Importación completada");
  }
  if (!ESTADO.activo || !proyectoActivo()) ESTADO.activo = ESTADO.proyectos[0].id;
  renderTodo(); guardar();
}

/* ---------- Eventos ---------- */
document.addEventListener("click", e => {
  const btn = e.target.closest("[data-acc]");
  if (btn){ const f=acc[btn.dataset.acc]; if(f){ f(btn.dataset.id); } return; }
  const tab = e.target.closest("#pa-tabs .nz-tabs__tab");
  if (tab){ mostrarPestana(tab.dataset.tab); }
});
document.addEventListener("input", e => {
  const el = e.target, c = el.dataset.campo, id = el.dataset.id;
  const pr = proyectoActivo(); if(!pr) return;
  if (c === "horas"){
    const r = buscarLinea(id); if(!r) return;
    r.linea.horas = r.linea.horas || {}; r.linea.horas["m"+el.dataset.mes] = num(el.value);
    const tr = el.closest("tr");
    tr.children[pr.meses+1].innerHTML = `<strong>${fmtH(lineaHoras(r.linea))}</strong>`;
    if (ESTADO.mostrarImportes) tr.children[pr.meses+2].textContent = fmt(lineaImporte(r.linea));
    actualizarChipsArbol(); renderDatos();
  }
  else if (c === "tarea-nombre"){ const t=buscarTarea(id); if(t){t.nombre=el.value; renderDatos();} }
  else if (c === "sub-nombre"){ const r=buscarSub(id); if(r){r.sub.nombre=el.value; renderDatos();} }
  else if (c === "linea-perfil"){ const r=buscarLinea(id); if(r){r.linea.perfilId=el.value; renderEstructura(); renderDatos();} }
  else if (c === "gasto-nombre"){ const g=pr.gastos.find(g=>g.id===id); if(g){g.nombre=el.value; renderDatos();} }
  else if (c === "gasto-unidades" || c === "gasto-precio"){
    const g=pr.gastos.find(g=>g.id===id); if(!g)return;
    if(c==="gasto-unidades") g.unidades=num(el.value); else g.precio=num(el.value);
    const fila=el.closest(".pa-fila-gasto");
    const span=fila.querySelector(".pa-importe"); if(span) span.textContent=fmt(num(g.unidades)*num(g.precio));
    $("#gas-total").textContent = ESTADO.mostrarImportes ? "Gastos: " + fmt(gastosTotal(pr)) : "";
    renderDatos();
  }
  else if (c === "perfil-nombre"){ const p=perfilPorId(id); if(p){p.nombre=el.value; renderDatos();} }
  else if (c === "perfil-tarifa"){ const p=perfilPorId(id); if(p){p.tarifa=num(el.value); renderDatos();} }
  else if (c === "perfil-unidades"){ const p=perfilPorId(id); if(p){p.unidades=el.value;} }
  else if (c === "proyecto-nombre"){ pr.nombre=el.value; $("#pa-sel-proyecto").querySelector(`option[value="${pr.id}"]`).textContent=el.value; renderDatos(); }
  else if (c === "proyecto-cliente-nombre"){ pr.cliente.nombre=el.value; renderDatos(); }
  else if (c === "proyecto-cliente-contacto"){ pr.cliente.contacto=el.value; guardar(); }
  else if (c === "proyecto-cliente-ref"){ pr.cliente.ref=el.value; renderDatos(); }
  else if (c === "proyecto-fecha"){ pr.fecha=el.value; renderDatos(); }
  else if (c === "proyecto-validez"){ pr.validezDias=Math.max(0,Math.round(num(el.value))); renderDatos(); }
  else if (c === "proyecto-desc"){ pr.descripcion=el.value; guardar(); }
  else if (c === "proyecto-pago"){ pr.condicionesPago=el.value; renderDatos(); }
  else if (c === "proyecto-impuesto-tasa"){ pr.impuestos.tasa=Math.max(0,Math.min(100,num(el.value))); renderDatos(); }
  else if (c === "proyecto-descuento-valor"){ pr.descuento.valor=Math.max(0,num(el.value)); renderDatos(); }
  else if (el.id === "aj-marca"){ ESTADO.marca.nombre=el.value; renderCabecera(); guardar(); }
  else if (el.id === "aj-sub"){ ESTADO.marca.sub=el.value; guardar(); }
  else if (el.id === "aj-moneda"){ ESTADO.marca.moneda=el.value||"€"; renderTodo(); }
});
document.addEventListener("change", e => {
  const el=e.target, c=el.dataset.campo;
  if (el.id === "pa-sel-proyecto"){ ESTADO.activo=el.value; renderTodo(); guardar(); }
  if (el.id === "aj-importes"){ ESTADO.mostrarImportes=el.checked; renderTodo(); guardar(); }
  if (el.id === "pa-fichero" && el.files && el.files[0]){
    const fr=new FileReader(); fr.onload=()=>importarJSON(String(fr.result)); fr.readAsText(el.files[0]); el.value="";
  }
  if (el.id === "pa-logo-fichero" && el.files && el.files[0]){
    const fr=new FileReader();
    fr.onload=()=>{
      const src=String(fr.result);
      if (src.length > 300000){ toast("Logo demasiado grande (máx. ~300 KB)"); return; }
      ESTADO.marca.logo=src; renderCabecera(); renderAjustes(); guardar(); toast("Logo aplicado");
    };
    fr.readAsDataURL(el.files[0]); el.value="";
  }
  if (c === "proyecto-estado"){ const pr=proyectoActivo(); pr.estado=el.value; renderCabecera(); updateKPIs(); guardar(); }
  if (c === "proyecto-inicio"){ const pr=proyectoActivo(); pr.fechaInicio=el.value||pr.fechaInicio; renderTodo(); guardar(); }
  if (c === "proyecto-meses"){ cambiarMeses(el.value); }
  if (c === "proyecto-impuesto-tipo"){ const pr=proyectoActivo(); pr.impuestos.tipo=el.value; renderTodo(); guardar(); }
  if (c === "proyecto-impuesto-incluido"){ const pr=proyectoActivo(); pr.impuestos.incluido=el.checked; renderTodo(); guardar(); }
  if (c === "proyecto-descuento-tipo"){ const pr=proyectoActivo(); pr.descuento.tipo=el.value; renderTodo(); guardar(); }
  if (c === "perfil-categoria"){ const p=perfilPorId(el.dataset.id); if(p){p.categoria=el.value; guardar();} }
});
function actualizarChipsArbol(){
  const pr=proyectoActivo();
  $$(".pa-tarea").forEach(n=>{ const t=buscarTarea(n.dataset.id,pr); if(!t)return;
    const h=n.querySelector(".pa-chip-h"), m=n.querySelector(".pa-importe");
    if(h) h.textContent=fmtH(tareaHoras(t));
    if(m&&ESTADO.mostrarImportes) m.textContent=fmt(tareaImporte(t));
  });
  $$(".pa-sub").forEach(n=>{ const r=buscarSub(n.dataset.id,pr); if(!r)return;
    const h=n.querySelector(".pa-chip-h"), m=n.querySelector(".pa-importe");
    if(h) h.textContent=fmtH(subHoras(r.sub));
    if(m&&ESTADO.mostrarImportes) m.textContent=fmt(subImporte(r.sub));
  });
}

/* ---------- Arranque (con migración v1 → v2) ---------- */
window.addEventListener("error", ev => {
  const el=$("#pa-error"); if(el){ el.textContent="Error: "+(ev.message||"desconocido"); el.classList.add("is-visible"); }
});
function migrarV1(d){
  d.marca = d.marca || {}; d.marca.logo = d.marca.logo || "";
  d.perfiles = (d.perfiles||[]).map(normalizarPerfil);
  d.perfilesInactivos = (d.perfilesInactivos||[]).map(normalizarPerfil);
  d.plantillas = plantillasDefecto();
  d.proyectos = (d.proyectos||[]).map(p => normalizarProyecto(p, true));
  d.version = 2;
  /* Activa por defecto el proyecto con más contenido (mejor primera impresión). */
  if (!d.activo || !d.proyectos.some(p => p.id === d.activo)){
    const mejor = [...d.proyectos].sort((a,b) => (b.tareas||[]).length - (a.tareas||[]).length)[0];
    if (mejor) d.activo = mejor.id;
  }
  return d;
}
function arrancar(){
  try {
    let bruto = localStorage.getItem(CLAVE);
    if (!bruto){
      const viejo = localStorage.getItem(CLAVE_V1);
      if (viejo){
        const d = JSON.parse(viejo);
        if (d && Array.isArray(d.proyectos)){ ESTADO = migrarV1(d); toast("Datos migrados a la nueva versión"); }
      }
    } else {
      const d = JSON.parse(bruto);
      if (d && Array.isArray(d.proyectos)) ESTADO = d;
    }
  } catch(e){ ESTADO = null; }
  if (!ESTADO){ ESTADO = estadoInicial(); }
  ESTADO.marca = ESTADO.marca || { nombre:"Planifica", sub:"", moneda:"€", logo:"" };
  ESTADO.marca.logo = ESTADO.marca.logo || "";
  ESTADO.perfiles = (ESTADO.perfiles||[]).map(normalizarPerfil);
  ESTADO.perfilesInactivos = (ESTADO.perfilesInactivos||[]).map(normalizarPerfil);
  ESTADO.plantillas = (ESTADO.plantillas||[]).map(normalizarPlantilla);
  ESTADO.proyectos = (ESTADO.proyectos||[]).map(normalizarProyecto);
  if (!ESTADO.proyectos.length) ESTADO.proyectos = [nuevoProyecto("Mi primera oferta")];
  if (!ESTADO.activo || !proyectoActivo()) ESTADO.activo = ESTADO.proyectos[0].id;
  ESTADO.pestana = ESTADO.pestana || "estructura";
  renderTodo();
  mostrarPestana(ESTADO.pestana);
}
arrancar();
