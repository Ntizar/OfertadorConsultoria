"use strict";
/* =====================================================================
   Planifica — Presupuestos y planificación de proyectos (marca blanca)
   App 100% autónoma: sin CDN, sin servidor, datos en localStorage.
   ===================================================================== */

/* ---------- Utilidades ---------- */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const uid = p => p + Math.random().toString(36).slice(2, 9);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const r2 = n => {
  /* Redondeo estilo Excel: normaliza a 15 dígitos significativos (como hace
     Excel antes de ROUND) para que 2254.5749999999994 → 2254.58, igual que la hoja. */
  const v = num(n);
  if (!isFinite(v)) return 0;
  const c1 = parseFloat(v.toPrecision(15));
  return Math.round(parseFloat((c1 * 100).toPrecision(15))) / 100;
};
const num = v => { const n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : 0; };
const CLAVE = "planifica:estado:v1";

let guardadoTimer = null;
function guardar(){
  clearTimeout(guardadoTimer);
  guardadoTimer = setTimeout(() => {
    try {
      ESTADO.pestana = pestanaActual;
      localStorage.setItem(CLAVE, JSON.stringify(ESTADO));
      const el = $("#pa-guardado"); if (el) { el.textContent = "Guardado ✓"; setTimeout(()=>{ el.textContent = ""; }, 1500); }
    } catch(e) { toast("No se pudo guardar: almacenamiento lleno"); }
    renderInforme();
  }, 200);
}
function toast(m){
  const t = $("#pa-toast"); if (!t) return;
  t.textContent = m; t.classList.add("is-visible");
  clearTimeout(t._tm); t._tm = setTimeout(()=>t.classList.remove("is-visible"), 2600);
}
function descargar(nombre, contenido, tipo){
  const blob = new Blob([contenido], {type: tipo || "application/octet-stream"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 400);
}
function slug(s){ return String(s||"proyecto").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40) || "proyecto"; }
function hoy(){ return new Date().toLocaleDateString("es-ES", {day:"2-digit",month:"long",year:"numeric"}); }

/* ---------- Modelo ---------- */
function nuevoPerfil(nombre, tarifa, unidades){
  return { id: uid("pf_"), nombre: nombre || "Nuevo perfil", unidades: unidades || "h", tarifa: num(tarifa) };
}
function nuevoProyecto(nombre){
  return {
    id: uid("pr_"), nombre: nombre || "Proyecto sin título", cliente: "",
    fechaInicio: new Date().toISOString().slice(0,7), meses: 12, descripcion: "",
    gastos: [], tareas: []
  };
}
function nuevaTarea(nombre){ return { id: uid("ta_"), nombre: nombre || "Nueva tarea", subtareas: [] }; }
function nuevaSub(nombre){ return { id: uid("sb_"), nombre: nombre || "Nueva subtarea", lineas: [] }; }
function nuevaLinea(perfilId, meses){ const h={}; for(let i=0;i<meses;i++) h["m"+i]=0; return { id: uid("ln_"), perfilId: perfilId||"", horas: h }; }

function bibliotecaEjemplo(){
  const defs = [
    ["Consultor/a senior (+15 años)", 65],
    ["Consultor/a senior (10–15 años)", 55],
    ["Consultor/a (5–10 años)", 48],
    ["Consultor/a junior (2–5 años)", 42],
    ["Jefe/a de proyecto", 60],
    ["Personal técnico TIC", 50]
  ];
  return defs.map(d => nuevoPerfil(d[0], d[1]));
}
function proyectoEjemplo(perfiles){
  const p = nuevoProyecto("Ejemplo — Rediseño de web corporativa");
  p.cliente = "Cliente de muestra"; p.meses = 6; p.fechaInicio = "2026-10";
  p.gastos = [
    { id: uid("g_"), nombre: "Licencias y herramientas", unidades: 6, precio: 45 },
    { id: uid("g_"), nombre: "Formación del equipo", unidades: 1, precio: 900 }
  ];
  const [sen, med, jru] = perfiles;
  const t1 = nuevaTarea("1. Análisis y diseño");
  const s1 = nuevaSub("1.1 Descubrimiento y requisitos");
  s1.lineas = [lCon(nuevaLinea(sen.id,6), {"m0":12,"m1":10,"m2":4}), lCon(nuevaLinea(med.id,6), {"m0":16,"m1":12,"m2":6})];
  const s2 = nuevaSub("1.2 Diseño UX/UI");
  s2.lineas = [lCon(nuevaLinea(med.id,6), {"m1":20,"m2":24,"m3":10})];
  t1.subtareas = [s1, s2];
  const t2 = nuevaTarea("2. Desarrollo y lanzamiento");
  const s3 = nuevaSub("2.1 Desarrollo front-end");
  s3.lineas = [lCon(nuevaLinea(jru.id,6), {"m2":40,"m3":60,"m4":40})];
  const s4 = nuevaSub("2.2 Pruebas y publicación");
  s4.lineas = [lCon(nuevaLinea(sen.id,6), {"m4":6}), lCon(nuevaLinea(jru.id,6), {"m4":16,"m5":8})];
  t2.subtareas = [s3, s4];
  p.tareas = [t1, t2];
  return p;
}
function lCon(linea, horas){ for (const k in horas) linea.horas[k] = horas[k]; return linea; }

/* Normalización defensiva: garantiza que un proyecto importado/cargado sea consistente */
function normalizarProyecto(p){
  if (!p || typeof p !== "object") return nuevoProyecto("Proyecto reparado");
  p.id = p.id || uid("pr_");
  p.nombre = p.nombre || "Proyecto sin título";
  p.cliente = p.cliente || ""; p.descripcion = p.descripcion || "";
  p.fechaInicio = p.fechaInicio || new Date().toISOString().slice(0,7);
  p.meses = Math.max(1, Math.min(60, Math.round(num(p.meses) || 12)));
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
  const perfiles = bibliotecaEjemplo();
  return {
    version: 1,
    marca: { nombre: "Planifica", sub: "Presupuestos y planificación de proyectos", moneda: "€" },
    mostrarImportes: true,
    perfiles,
    perfilesInactivos: [],
    proyectos: [nuevoProyecto("Mi primer proyecto"), proyectoEjemplo(perfiles)],
    activo: null,
    pestana: "estructura"
  };
}
let ESTADO = null;
function proyectoActivo(){
  return ESTADO.proyectos.find(p => p.id === ESTADO.activo) || ESTADO.proyectos[0] || null;
}
function perfilPorId(id){ return ESTADO.perfiles.find(p => p.id === id) || ESTADO.perfilesInactivos.find(p => p.id === id); }

/* ---------- Cálculos ---------- */
const inicioProyecto = pr => { const [a,m] = String(pr.fechaInicio||"2026-01").split("-").map(Number); return {a: a||2026, m: m||1}; };
function etiquetaMes(pr, i){
  const {a, m} = inicioProyecto(pr);
  const d = new Date(a, m - 1 + i, 1);
  return d.toLocaleDateString("es-ES", {month:"short", year:"2-digit"}).replace(".", "");
}
function anioMes(pr, i){
  const {a, m} = inicioProyecto(pr);
  return new Date(a, m - 1 + i, 1).getFullYear();
}
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
function totalProyecto(pr){ return r2(importeProyecto(pr) + gastosTotal(pr)); }
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
  (pr.tareas||[]).forEach(t=>(t.subtareas||[]).forEach(l2=>(l2.lineas||[]).forEach(l=>{
    s += num((l.horas||{})["m"+i]) * tarifaDe(l.perfilId);
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

/* ---------- Render: cabecera y pestañas ---------- */
let pestanaActual = "estructura";
function mostrarPestana(nombre){
  pestanaActual = nombre;
  $$(".pa-tab").forEach(b => b.classList.toggle("is-activa", b.dataset.tab === nombre));
  $$("main>section").forEach(s => s.hidden = s.id !== "pestana-" + nombre);
  if (nombre === "estructura") renderEstructura();
  if (nombre === "resumen") renderResumen();
  if (nombre === "cronograma") renderCronograma();
  if (nombre === "gastos") renderGastos();
  if (nombre === "informe") renderInforme();
  if (nombre === "ajustes") renderAjustes();
  guardar();
}

function renderCabecera(){
  $("#pa-marca-nombre").textContent = ESTADO.marca.nombre || "Planifica";
  $("#pa-marca-sub").textContent = ESTADO.marca.sub || "";
  document.title = (ESTADO.marca.nombre || "Planifica") + " — Presupuestos y planificación";
  const sel = $("#pa-sel-proyecto");
  sel.innerHTML = ESTADO.proyectos.map(p =>
    `<option value="${p.id}" ${p.id===ESTADO.activo?"selected":""}>${esc(p.nombre)}</option>`).join("");
  document.body.classList.toggle("pa-sin-importes", !ESTADO.mostrarImportes);
}

/* ---------- Render: estructura ---------- */
function chipHoras(n){ return `<span class="pa-chip pa-chip--gris">${fmtH(n)}</span>`; }
function chipImporte(n){ return ESTADO.mostrarImportes ? `<span class="pa-chip pa-importe">${fmt(n)}</span>` : ""; }

function renderEstructura(){
  const pr = proyectoActivo();
  const cont = $("#pa-estructura");
  if (!pr){ cont.innerHTML = `<div class="pa-aviso pa-aviso--info">No hay proyectos. Crea uno nuevo arriba.</div>`; return; }
  if (!(pr.tareas||[]).length){
    cont.innerHTML = `
      <div class="pa-card" style="text-align:center;padding:34px 18px">
        <h3>Empieza añadiendo una tarea</h3>
        <p style="color:var(--pa-texto-suave)">Crea tareas, subtareas y asigna perfiles con sus horas por mes. Todo recalcula al instante.</p>
        <button class="pa-btn pa-btn--primario" data-acc="nueva-tarea">＋ Añadir tarea</button>
      </div>`;
    return;
  }
  cont.innerHTML = pr.tareas.map((t, ti) => `
    <div class="pa-tarea" data-id="${t.id}">
      <div class="pa-tarea__cab">
        <input class="pa-input" data-campo="tarea-nombre" data-id="${t.id}" value="${esc(t.nombre)}" style="flex:1;min-width:200px;font-weight:700">
        ${chipHoras(tareaHoras(t))} ${chipImporte(tareaImporte(t))}
        <button class="pa-btn pa-btn--mini" data-acc="nueva-sub" data-id="${t.id}" title="Añadir subtarea">＋ Subtarea</button>
        <button class="pa-btn pa-btn--mini" data-acc="dup-tarea" data-id="${t.id}" title="Duplicar tarea">⧉</button>
        <button class="pa-btn pa-btn--mini" data-acc="subir-tarea" data-id="${t.id}" title="Subir" ${ti===0?"disabled":""}>↑</button>
        <button class="pa-btn pa-btn--mini" data-acc="bajar-tarea" data-id="${t.id}" title="Bajar" ${ti===pr.tareas.length-1?"disabled":""}>↓</button>
        <button class="pa-btn pa-btn--mini pa-btn--peligro" data-acc="elim-tarea" data-id="${t.id}" title="Eliminar tarea">✕</button>
      </div>
      <div class="pa-tarea__cuerpo">
        ${t.subtareas.length ? t.subtareas.map((s, si) => htmlSub(pr, s, si, t.subtareas.length)).join("") : `<p class="pa-linea__horas">Sin subtareas todavía. Añade la primera con «＋ Subtarea».</p>`}
      </div>
    </div>`).join("");
}
function htmlSub(pr, s, si, total){
  const abierta = s._abierta ? "is-abierta" : "";
  return `
  <div class="pa-sub ${abierta}" data-id="${s.id}">
    <div class="pa-sub__cab">
      <button class="pa-btn pa-btn--icono" data-acc="toggle-sub" data-id="${s.id}" title="Plegar/desplegar" aria-label="Plegar o desplegar">${abierta?"▾":"▸"}</button>
      <input class="pa-input pa-sub__nombre" data-campo="sub-nombre" data-id="${s.id}" value="${esc(s.nombre)}" style="flex:1;min-width:170px">
      ${chipHoras(subHoras(s))} ${chipImporte(subImporte(s))}
      <button class="pa-btn pa-btn--mini" data-acc="nueva-linea" data-id="${s.id}" title="Añadir perfil a esta subtarea">＋ Perfil</button>
      <button class="pa-btn pa-btn--mini" data-acc="dup-sub" data-id="${s.id}" title="Duplicar subtarea">⧉</button>
      <button class="pa-btn pa-btn--mini" data-acc="subir-sub" data-id="${s.id}" title="Subir" ${si===0?"disabled":""}>↑</button>
      <button class="pa-btn pa-btn--mini" data-acc="bajar-sub" data-id="${s.id}" title="Bajar" ${si===total-1?"disabled":""}>↓</button>
      <button class="pa-btn pa-btn--mini pa-btn--peligro" data-acc="elim-sub" data-id="${s.id}" title="Eliminar subtarea">✕</button>
    </div>
    <div class="pa-sub__cuerpo">
      ${s.lineas.length ? htmlLineas(pr, s) : `<p class="pa-linea__horas" style="padding:6px 0">Subtarea vacía: añade perfiles con «＋ Perfil».</p>`}
    </div>
  </div>`;
}
function htmlLineas(pr, s){
  const head = `<tr><th class="pa-col-fija">Perfil</th>${Array.from({length:pr.meses},(_,i)=>`<th class="pa-num">${etiquetaMes(pr,i)}</th>`).join("")}<th class="pa-num">Horas</th>${ESTADO.mostrarImportes?`<th class="pa-num pa-col-importe">Importe</th>`:""}<th></th></tr>`;
  const filas = s.lineas.map(l => {
    const pf = perfilPorId(l.perfilId);
    return `<tr data-id="${l.id}">
      <td class="pa-col-fija">
        <select class="pa-select" data-campo="linea-perfil" data-id="${l.id}" style="min-height:34px">
          <option value="" ${!l.perfilId?"selected":""} disabled>— Elige perfil —</option>
          ${ESTADO.perfiles.map(p=>`<option value="${p.id}" ${p.id===l.perfilId?"selected":""}>${esc(p.nombre)}</option>`).join("")}
        </select>
      </td>
      ${Array.from({length:pr.meses},(_,i)=>`<td class="pa-num"><input class="pa-input pa-input--num" type="number" step="0.5" min="0" value="${num((l.horas||{})["m"+i])||""}" data-campo="horas" data-id="${l.id}" data-mes="${i}" placeholder="0"></td>`).join("")}
      <td class="pa-num"><strong>${fmtH(lineaHoras(l))}</strong></td>
      ${ESTADO.mostrarImportes?`<td class="pa-num pa-col-importe pa-importe">${fmt(lineaImporte(l))}</td>`:""}
      <td><button class="pa-btn pa-btn--mini pa-btn--peligro" data-acc="elim-linea" data-id="${l.id}" title="Quitar perfil">✕</button></td>
    </tr>`;
  }).join("");
  return `<div class="pa-tabla-wrap" style="border:none"><table class="pa-tabla"><thead>${head}</thead><tbody>${filas}</tbody></table></div>`;
}

/* ---------- Render: KPIs + resumen ---------- */
function updateKPIs(){
  const pr = proyectoActivo(); if (!pr) return;
  const total = totalProyecto(pr), horas = horasProyecto(pr);
  $("#kpi-total").textContent = ESTADO.mostrarImportes ? fmt(total) : "—";
  $("#kpi-horas").textContent = fmtH(horas);
  $("#kpi-media").textContent = ESTADO.mostrarImportes && pr.meses ? fmt(total/pr.meses) + "/mes" : "—";
  const nt = (pr.tareas||[]).length, ns = (pr.tareas||[]).reduce((a,t)=>a+(t.subtareas||[]).length,0);
  $("#kpi-estructura").textContent = `${nt} tareas · ${ns} subtareas`;
  $("#pa-meta-proyecto").textContent = `${pr.nombre}${pr.cliente ? " · " + pr.cliente : ""} · ${pr.meses} meses desde ${etiquetaMes(pr,0)}`;
}
function renderResumen(){
  const pr = proyectoActivo(); if (!pr) return;
  // Resumen por perfil
  const map = horasPorPerfil(pr);
  const filas = ESTADO.perfiles.map(p => {
    const h = map.get(p.id) || 0;
    if (!h) return "";
    return `<tr><td>${esc(p.nombre)}</td><td class="pa-num">${fmtH(h)}</td><td class="pa-num pa-num-t">${fmt(r2(h*num(p.tarifa)))}</td></tr>`;
  }).join("");
  const totalH = horasProyecto(pr);
  $("#res-perfiles").innerHTML = `
    <div class="pa-tabla-wrap"><table class="pa-tabla">
      <thead><tr><th>Perfil</th><th class="pa-num">Horas</th><th class="pa-num pa-col-importe">Importe</th></tr></thead>
      <tbody>${filas || `<tr><td colspan="3">Sin horas asignadas todavía.</td></tr>`}</tbody>
      <tfoot><tr><td>Total</td><td class="pa-num">${fmtH(totalH)}</td><td class="pa-num pa-col-importe">${ESTADO.mostrarImportes?fmt(importeProyecto(pr)):""}</td></tr></tfoot>
    </table></div>`;
  // Resumen por tarea
  $("#res-tareas").innerHTML = `
    <div class="pa-tabla-wrap"><table class="pa-tabla">
      <thead><tr><th>Tarea</th><th class="pa-num">Subtareas</th><th class="pa-num">Horas</th><th class="pa-num pa-col-importe">Importe</th></tr></thead>
      <tbody>${(pr.tareas||[]).map(t=>`<tr><td>${esc(t.nombre)}</td><td class="pa-num">${(t.subtareas||[]).length}</td><td class="pa-num">${fmtH(tareaHoras(t))}</td><td class="pa-num pa-col-importe">${ESTADO.mostrarImportes?fmt(tareaImporte(t)):""}</td></tr>`).join("") || `<tr><td colspan="4">Sin tareas.</td></tr>`}</tbody>
      <tfoot><tr><td>Total</td><td class="pa-num">${(pr.tareas||[]).reduce((a,t)=>a+(t.subtareas||[]).length,0)}</td><td class="pa-num">${fmtH(horasProyecto(pr))}</td><td class="pa-num pa-col-importe">${ESTADO.mostrarImportes?fmt(importeProyecto(pr)):""}</td></tr></tfoot>
    </table></div>`;
  updateKPIs();
}

/* ---------- Render: cronograma ---------- */
function renderCronograma(){
  const pr = proyectoActivo(); if (!pr) return;
  const valores = Array.from({length:pr.meses},(_,i)=>importeMes(pr,i));
  const max = Math.max(...valores, 1);
  $("#cro-barras").innerHTML = valores.map((v,i)=>`
    <div class="pa-barras__item" title="${etiquetaMes(pr,i)}: ${fmt(v)}">
      <span class="pa-barras__label pa-importe">${v?Math.round(v).toLocaleString("es-ES"):""}</span>
      <div class="pa-barras__barra" style="height:${Math.max(2, v/max*100)}%"></div>
      <span class="pa-barras__label">${etiquetaMes(pr,i)}</span>
    </div>`).join("");
  // Distribución por tarea y mes (horas)
  const cab = `<tr><th class="pa-col-fija">Tarea</th>${Array.from({length:pr.meses},(_,i)=>`<th class="pa-num">${etiquetaMes(pr,i)}</th>`).join("")}<th class="pa-num">Total</th></tr>`;
  const filas = (pr.tareas||[]).map(t=>{
    const horasMes = Array.from({length:pr.meses},()=>0);
    (t.subtareas||[]).forEach(s=>(s.lineas||[]).forEach(l=>{ for(let i=0;i<pr.meses;i++) horasMes[i]+=num((l.horas||{})["m"+i]); }));
    return `<tr><td class="pa-col-fija">${esc(t.nombre)}</td>${horasMes.map(h=>`<td class="pa-num">${h?h.toLocaleString("es-ES"):"·"}</td>`).join("")}<td class="pa-num"><strong>${fmtH(tareaHoras(t))}</strong></td></tr>`;
  }).join("");
  $("#cro-tabla").innerHTML = `<div class="pa-tabla-wrap"><table class="pa-tabla"><thead>${cab}</thead><tbody>${filas||`<tr><td colspan="2">Sin tareas.</td></tr>`}</tbody></table></div>`;
  updateKPIs();
}

/* ---------- Render: gastos ---------- */
function renderGastos(){
  const pr = proyectoActivo(); if (!pr) return;
  $("#gas-lista").innerHTML = (pr.gastos||[]).map(g=>`
    <div class="pa-linea" data-id="${g.id}">
      <input class="pa-input" data-campo="gasto-nombre" data-id="${g.id}" value="${esc(g.nombre)}" placeholder="Concepto" style="flex:2;min-width:180px">
      <label class="pa-linea__horas">Uds <input class="pa-input pa-input--num" type="number" step="0.01" min="0" value="${num(g.unidades)||""}" data-campo="gasto-unidades" data-id="${g.id}"></label>
      <label class="pa-linea__horas">Precio <input class="pa-input pa-input--num" type="number" step="0.01" min="0" style="width:90px" value="${num(g.precio)||""}" data-campo="gasto-precio" data-id="${g.id}"></label>
      <span class="pa-importe" style="font-weight:700;min-width:100px;text-align:right">${fmt(num(g.unidades)*num(g.precio))}</span>
      <button class="pa-btn pa-btn--mini pa-btn--peligro" data-acc="elim-gasto" data-id="${g.id}" title="Eliminar">✕</button>
    </div>`).join("") || `<p class="pa-linea__horas">Sin gastos generales. Añade conceptos como viajes, licencias o material.</p>`;
  $("#gas-total").textContent = ESTADO.mostrarImportes ? fmt(gastosTotal(pr)) : "—";
}

/* ---------- Render: informe ---------- */
function renderInforme(){
  const pr = proyectoActivo(); if (!pr) return;
  const imp = ESTADO.mostrarImportes;
  const mon = ESTADO.marca.nombre || "Planifica";
  const filas = [];
  (pr.tareas||[]).forEach(t=>{
    filas.push(`<tr><td colspan="5" style="background:#f2f5f9;font-weight:800">${esc(t.nombre)}</td></tr>`);
    (t.subtareas||[]).forEach(s=>{
      filas.push(`<tr><td style="padding-left:18px">${esc(s.nombre)}</td><td></td><td class="pa-num">${imp?fmt(subImporte(s)):""}</td><td class="pa-num">${fmtH(subHoras(s))}</td><td></td></tr>`);
      (s.lineas||[]).forEach(l=>{
        const pf = perfilPorId(l.perfilId);
        filas.push(`<tr><td style="padding-left:36px;color:#5b6472">${esc(pf?pf.nombre:"(perfil eliminado)")}</td><td class="pa-num">${imp?fmt(num(pf?pf.tarifa:0)):""}</td><td class="pa-num">${imp?fmt(lineaImporte(l)):""}</td><td class="pa-num">${fmtH(lineaHoras(l))}</td><td>${pr.meses} meses</td></tr>`);
      });
    });
  });
  const map = horasPorPerfil(pr);
  const resPerf = ESTADO.perfiles.filter(p=>map.get(p.id)).map(p=>`<tr><td>${esc(p.nombre)}</td><td class="pa-num">${fmtH(map.get(p.id))}</td><td class="pa-num">${imp?fmt(r2(map.get(p.id)*num(p.tarifa))):""}</td></tr>`).join("");
  const anual = [...anualidades(pr).entries()].map(([y,v])=>`<tr><td>${y}</td><td class="pa-num">${imp?fmt(v):""}</td></tr>`).join("");
  $("#informe-cuerpo").innerHTML = `
    <div class="pa-informe__cab">
      <div><div class="pa-informe__marca">${esc(mon)}</div><div class="pa-informe__meta">${esc(ESTADO.marca.sub||"")}</div></div>
      <div class="pa-informe__meta">${hoy()}</div>
    </div>
    <h1>${esc(pr.nombre)}</h1>
    <p class="pa-informe__meta">${pr.cliente ? "Cliente: "+esc(pr.cliente)+" · " : ""}Duración: ${pr.meses} meses desde ${etiquetaMes(pr,0)} · ${fmtH(horasProyecto(pr))}${pr.descripcion ? " — "+esc(pr.descripcion) : ""}</p>
    <h2>Detalle de tareas</h2>
    <table><thead><tr><th>Concepto</th><th class="pa-num">Tarifa</th><th class="pa-num">Importe</th><th class="pa-num">Horas</th><th>Periodo</th></tr></thead><tbody>${filas.join("")||`<tr><td colspan="5">Sin contenido.</td></tr>`}</tbody></table>
    ${pr.gastos && pr.gastos.length ? `<h2>Gastos generales</h2><table><thead><tr><th>Concepto</th><th class="pa-num">Uds</th><th class="pa-num">Precio</th><th class="pa-num">Importe</th></tr></thead><tbody>${pr.gastos.map(g=>`<tr><td>${esc(g.nombre)}</td><td class="pa-num">${num(g.unidades)}</td><td class="pa-num">${imp?fmt(num(g.precio)):""}</td><td class="pa-num">${imp?fmt(num(g.unidades)*num(g.precio)):""}</td></tr>`).join("")}</tbody></table>` : ""}
    <h2>Resumen por perfil</h2>
    <table><thead><tr><th>Perfil</th><th class="pa-num">Horas</th><th class="pa-num">Importe</th></tr></thead><tbody>${resPerf||`<tr><td colspan="3">—</td></tr>`}</tbody></table>
    <h2>Importe mensual${imp?"":" (oculto)"}</h2>
    <table><thead><tr><th>Mes</th><th class="pa-num">Importe</th></tr></thead><tbody>${Array.from({length:pr.meses},(_,i)=>`<tr><td>${etiquetaMes(pr,i)}</td><td class="pa-num">${imp?fmt(importeMes(pr,i)):"—"}</td></tr>`).join("")}</tbody></table>
    <h2>Anualidades</h2>
    <table><thead><tr><th>Año</th><th class="pa-num">Importe</th></tr></thead><tbody>${anual}</tbody>
    <tfoot><tr><td><strong>TOTAL PROYECTO${gastosTotal(pr)?" (incluye gastos)":""}</strong></td><td class="pa-num">${imp?fmt(totalProyecto(pr)):"—"}</td></tr></tfoot></table>
    <div class="pa-informe__pie"><span>Generado con ${esc(mon)}</span><span>${hoy()}</span></div>`;
}
function imprimir(){ window.print(); }

/* ---------- Render: ajustes ---------- */
function renderAjustes(){
  $("#aj-marca").value = ESTADO.marca.nombre || "";
  $("#aj-sub").value = ESTADO.marca.sub || "";
  $("#aj-moneda").value = ESTADO.marca.moneda || "€";
  $("#aj-importes").checked = !!ESTADO.mostrarImportes;
  $("#aj-perfiles").innerHTML = ESTADO.perfiles.map(p=>`
    <div class="pa-linea" data-id="${p.id}">
      <input class="pa-input" data-campo="perfil-nombre" data-id="${p.id}" value="${esc(p.nombre)}" style="flex:2;min-width:160px">
      <label class="pa-linea__horas">Tarifa <input class="pa-input pa-input--num" type="number" step="0.01" min="0" style="width:90px" value="${num(p.tarifa)||""}" data-campo="perfil-tarifa" data-id="${p.id}"></label>
      <label class="pa-linea__horas">Ud <input class="pa-input pa-input--num" style="width:56px" value="${esc(p.unidades||"h")}" data-campo="perfil-unidades" data-id="${p.id}"></label>
      <span class="pa-chip pa-chip--gris">${usosPerfil(p.id)} usos</span>
      <button class="pa-btn pa-btn--mini pa-btn--peligro" data-acc="elim-perfil" data-id="${p.id}" title="Eliminar o desactivar perfil">✕</button>
    </div>`).join("") || `<p class="pa-linea__horas">Sin perfiles. Añade perfiles de tu equipo con sus tarifas.</p>`;
  $("#aj-inactivos").innerHTML = ESTADO.perfilesInactivos.map(p=>`
    <div class="pa-linea"><span style="flex:1">${esc(p.nombre)}</span><button class="pa-btn pa-btn--mini" data-acc="reactivar-perfil" data-id="${p.id}">Reactivar</button></div>`).join("");
  // datos del proyecto activo
  const pr = proyectoActivo(); if (pr){
    $("#aj-nombre").value = pr.nombre || "";
    $("#aj-cliente").value = pr.cliente || "";
    $("#aj-inicio").value = pr.fechaInicio || "";
    $("#aj-meses").value = pr.meses || 12;
    $("#aj-desc").value = pr.descripcion || "";
  }
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
  renderCabecera(); renderEstructura(); renderResumen(); renderCronograma(); renderGastos(); renderAjustes(); updateKPIs();
}
function renderDatos(){ updateKPIs(); renderResumen(); renderCronograma(); renderGastos(); guardar(); }

/* ---------- Buscadores ---------- */
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

/* ---------- Acciones estructurales ---------- */
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
  "nuevo-proyecto": () => { const p=nuevoProyecto("Proyecto sin título"); ESTADO.proyectos.push(p); ESTADO.activo=p.id; renderTodo(); guardar(); toast("Proyecto creado"); },
  "dup-proyecto": () => { const pr=proyectoActivo(); const c=clonar(pr); c.id=uid("pr_"); c.nombre=pr.nombre+" (copia)"; c.tareas.forEach(t=>{t.id=uid("ta_");t.subtareas.forEach(s=>{s.id=uid("sb_");s.lineas.forEach(l=>l.id=uid("ln_"));});}); c.gastos.forEach(g=>g.id=uid("g_")); ESTADO.proyectos.push(c); ESTADO.activo=c.id; renderTodo(); guardar(); toast("Proyecto duplicado"); },
  "elim-proyecto": () => { const pr=proyectoActivo(); if(ESTADO.proyectos.length<=1){toast("Debe existir al menos un proyecto");return;} if(!confirm(`¿Eliminar el proyecto «${pr.nombre}»? Esta acción no se puede deshacer.`))return; ESTADO.proyectos=ESTADO.proyectos.filter(p=>p.id!==pr.id); ESTADO.activo=ESTADO.proyectos[0].id; renderTodo(); guardar(); },
  "nuevo-perfil": () => { ESTADO.perfiles.push(nuevoPerfil("Perfil nuevo", 0)); renderAjustes(); guardar(); },
  "elim-perfil": id => {
    const p=perfilPorId(id); if(!p)return; const usos=usosPerfil(id);
    if(usos>0){ if(confirm(`«${p.nombre}» se usa en ${usos} línea(s). ¿Desactivarlo? Sus datos se conservan y puedes reactivarlo luego.`)){ ESTADO.perfiles=ESTADO.perfiles.filter(x=>x.id!==id); ESTADO.perfilesInactivos.push(p); } else return; }
    else { if(!confirm(`¿Eliminar el perfil «${p.nombre}»?`))return; ESTADO.perfiles=ESTADO.perfiles.filter(x=>x.id!==id); }
    renderAjustes(); renderDatos();
  },
  "reactivar-perfil": id => { const p=ESTADO.perfilesInactivos.find(x=>x.id===id); if(!p)return; ESTADO.perfilesInactivos=ESTADO.perfilesInactivos.filter(x=>x.id!==id); ESTADO.perfiles.push(p); renderAjustes(); guardar(); },
  "exp-json-proy": () => { const pr=proyectoActivo(); descargar(`${slug(pr.nombre)}-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify({tipo:"planifica-proyecto", proyecto:pr}, null, 2), "application/json"); },
  "exp-json-todo": () => { descargar(`planifica-datos-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(ESTADO, null, 2), "application/json"); toast("Copia de seguridad descargada"); },
  "imp-json": () => $("#pa-fichero").click(),
  "exp-csv": () => exportarCSV(),
  "imprimir": () => imprimir(),
  "toggle-importes": () => { ESTADO.mostrarImportes = !ESTADO.mostrarImportes; renderTodo(); guardar(); toast(ESTADO.mostrarImportes ? "Importes visibles" : "Modo solo tiempos: importes ocultos"); },
  "restaurar-demo": () => { if(!confirm("¿Restaurar los datos de ejemplo? Se reemplazan los datos actuales (antes se descarga una copia de seguridad)."))return; descargar(`planifica-copia-antes-de-restaurar.json`, JSON.stringify(ESTADO,null,2),"application/json"); ESTADO=estadoInicial(); ESTADO.activo=ESTADO.proyectos[0].id; renderTodo(); guardar(); toast("Datos de ejemplo restaurados"); },
  "borrar-todo": () => { if(!confirm("¿BORRAR todos los datos? Se reemplazan por una app vacía (antes se descarga una copia de seguridad)."))return; descargar(`planifica-copia-antes-de-borrar.json`, JSON.stringify(ESTADO,null,2),"application/json"); ESTADO=estadoInicial(); ESTADO.proyectos=[nuevoProyecto("Mi primer proyecto")]; ESTADO.perfiles=[]; ESTADO.activo=ESTADO.proyectos[0].id; renderTodo(); guardar(); toast("Datos borrados"); }
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
  const filas=[["Tarea","Subtarea","Perfil","...horas por mes...", ...Array.from({length:pr.meses},(_,i)=>etiquetaMes(pr,i)),"Total horas","Tarifa","Importe"]];
  (pr.tareas||[]).forEach(t=>(t.subtareas||[]).forEach(s=>(s.lineas||[]).forEach(l=>{
    const pf=perfilPorId(l.perfilId);
    filas.push([
      t.nombre, s.nombre, pf ? pf.nombre : "(sin perfil)",
      ...Array.from({length: pr.meses}, (_,i) => String(num((l.horas||{})["m"+i])).replace(".", ",")),
      String(lineaHoras(l)).replace(".", ","),
      String(num(pf ? pf.tarifa : 0)).replace(".", ","),
      String(lineaImporte(l)).replace(".", ",")
    ]);
  })));
  filas.push([]); filas.push(["TOTAL","","","","","","",String(totalProyecto(pr)).replace(".",",")]);
  const csv="\uFEFF"+filas.map(f=>f.map(c=>`"${String(c??"").replace(/"/g,'""')}"`).join(sep)).join("\r\n");
  descargar(`${slug(pr.nombre)}-${new Date().toISOString().slice(0,10)}.csv`, csv, "text/csv;charset=utf-8");
  toast("CSV exportado");
}

/* ---------- Importar ---------- */
function importarJSON(texto){
  let data;
  try { data = JSON.parse(texto); } catch(e){ toast("El archivo no es un JSON válido"); return; }
  const esEstado = data && Array.isArray(data.proyectos);
  const esProyecto = data && data.tipo==="planifica-proyecto" && data.proyecto;
  if(!esEstado && !esProyecto){ toast("Formato no reconocido: espera un JSON de Planifica"); return; }
  const reemplazar = confirm("ACEPTAR = Reemplazar TODOS los datos actuales\nCANCELAR = Fusionar (añade/reemplaza por id)");
  if(reemplazar){ descargar(`planifica-copia-anterior-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(ESTADO,null,2),"application/json"); }
  if(esProyecto){
    const p=normalizarProyecto(data.proyecto);
    const i=ESTADO.proyectos.findIndex(x=>x.id===p.id);
    if(i>=0) ESTADO.proyectos[i]=p; else ESTADO.proyectos.push(p);
    ESTADO.activo=p.id;
  } else {
    const nuevaMarca=data.marca, nuevosPerfiles=data.perfiles||[];
    if(reemplazar){
      ESTADO.marca=data.marca||ESTADO.marca;
      ESTADO.perfiles=nuevosPerfiles; ESTADO.perfilesInactivos=data.perfilesInactivos||[];
      ESTADO.proyectos=(data.proyectos||[]).map(normalizarProyecto); ESTADO.activo=data.activo;
    } else {
      if(data.marca && confirm("¿Aplicar también la marca/configuración del archivo?")) ESTADO.marca=data.marca;
      nuevosPerfiles.forEach(pf=>{ if(!perfilPorId(pf.id)) ESTADO.perfiles.push(pf); });
      (data.perfilesInactivos||[]).forEach(pf=>{ if(!perfilPorId(pf.id)) ESTADO.perfilesInactivos.push(pf); });
      (data.proyectos||[]).forEach(pr0=>{ const p=normalizarProyecto(pr0); const i=ESTADO.proyectos.findIndex(x=>x.id===p.id); if(i>=0) ESTADO.proyectos[i]=p; else ESTADO.proyectos.push(p); });
      ESTADO.activo=ESTADO.proyectos[0].id;
    }
  }
  renderTodo(); guardar(); toast("Importación completada");
}

/* ---------- Eventos ---------- */
document.addEventListener("click", e => {
  const btn = e.target.closest("[data-acc]");
  if (btn){ const f=acc[btn.dataset.acc]; if(f){ f(btn.dataset.id); } return; }
  const tab = e.target.closest(".pa-tab");
  if (tab){ mostrarPestana(tab.dataset.tab); }
});
document.addEventListener("input", e => {
  const el = e.target, c = el.dataset.campo, id = el.dataset.id;
  const pr = proyectoActivo(); if(!pr) return;
  if (c === "horas"){
    const r = buscarLinea(id); if(!r) return;
    r.linea.horas = r.linea.horas || {}; r.linea.horas["m"+el.dataset.mes] = num(el.value);
    // actualización quirúrgica de la fila + chips
    const tr = el.closest("tr");
    tr.children[pr.meses+1].innerHTML = `<strong>${fmtH(lineaHoras(r.linea))}</strong>`;
    if (ESTADO.mostrarImportes) tr.children[pr.meses+2].textContent = fmt(lineaImporte(r.linea));
    actualizarChipsArbol(); renderDatos();
  }
  else if (c === "tarea-nombre"){ const t=buscarTarea(id); if(t){t.nombre=el.value; renderCabecera(); renderDatos();} }
  else if (c === "sub-nombre"){ const r=buscarSub(id); if(r){r.sub.nombre=el.value; renderDatos();} }
  else if (c === "linea-perfil"){ const r=buscarLinea(id); if(r){r.linea.perfilId=el.value; renderEstructura(); renderDatos();} }
  else if (c === "gasto-nombre"){ const g=pr.gastos.find(g=>g.id===id); if(g){g.nombre=el.value; renderDatos();} }
  else if (c === "gasto-unidades" || c === "gasto-precio"){
    const g=pr.gastos.find(g=>g.id===id); if(!g)return;
    if(c==="gasto-unidades") g.unidades=num(el.value); else g.precio=num(el.value);
    const linea=el.closest(".pa-linea");
    const span=linea.querySelector(".pa-importe"); if(span) span.textContent=fmt(num(g.unidades)*num(g.precio));
    $("#gas-total").textContent = ESTADO.mostrarImportes ? fmt(gastosTotal(pr)) : "—";
    renderDatos();
  }
  else if (c === "perfil-nombre"){ const p=perfilPorId(id); if(p){p.nombre=el.value; renderDatos();} }
  else if (c === "perfil-tarifa"){ const p=perfilPorId(id); if(p){p.tarifa=num(el.value); renderDatos();} }
  else if (c === "perfil-unidades"){ const p=perfilPorId(id); if(p){p.unidades=el.value;} }
  else if (c === "proyecto-nombre"){ pr.nombre=el.value; $("#pa-sel-proyecto").querySelector(`option[value="${pr.id}"]`).textContent=el.value; renderDatos(); }
  else if (c === "proyecto-cliente"){ pr.cliente=el.value; renderDatos(); }
  else if (c === "proyecto-desc"){ pr.descripcion=el.value; guardar(); }
  else if (el.id === "aj-marca"){ ESTADO.marca.nombre=el.value; renderCabecera(); guardar(); }
  else if (el.id === "aj-sub"){ ESTADO.marca.sub=el.value; renderCabecera(); guardar(); }
  else if (el.id === "aj-moneda"){ ESTADO.marca.moneda=el.value||"€"; renderDatos(); }
});
document.addEventListener("change", e => {
  const el=e.target;
  if (el.id === "pa-sel-proyecto"){ ESTADO.activo=el.value; renderTodo(); guardar(); }
  if (el.id === "aj-inicio"){ const pr=proyectoActivo(); pr.fechaInicio=el.value||pr.fechaInicio; renderTodo(); guardar(); }
  if (el.id === "aj-meses"){ cambiarMeses(el.value); }
  if (el.id === "aj-importes"){ ESTADO.mostrarImportes=el.checked; renderTodo(); guardar(); }
  if (el.id === "pa-fichero" && el.files && el.files[0]){
    const fr=new FileReader(); fr.onload=()=>importarJSON(String(fr.result)); fr.readAsText(el.files[0]); el.value="";
  }
});
function actualizarChipsArbol(){
  const pr=proyectoActivo();
  $$(".pa-tarea").forEach(n=>{ const t=buscarTarea(n.dataset.id,pr); if(!t)return;
    const chips=n.querySelectorAll(".pa-chip");
    if(chips[0]) chips[0].textContent=fmtH(tareaHoras(t));
    if(chips[1]&&ESTADO.mostrarImportes) chips[1].textContent=fmt(tareaImporte(t));
  });
  $$(".pa-sub").forEach(n=>{ const r=buscarSub(n.dataset.id,pr); if(!r)return;
    const chips=n.querySelectorAll(".pa-chip");
    if(chips[0]) chips[0].textContent=fmtH(subHoras(r.sub));
    if(chips[1]&&ESTADO.mostrarImportes) chips[1].textContent=fmt(subImporte(r.sub));
  });
}

/* ---------- Arranque ---------- */
window.addEventListener("error", ev => {
  const el=$("#pa-error"); if(el){ el.textContent="Error: "+(ev.message||"desconocido"); el.classList.add("is-visible"); }
});
function arrancar(){
  try {
    const bruto = localStorage.getItem(CLAVE);
    if (bruto){
      const d = JSON.parse(bruto);
      if (d && Array.isArray(d.proyectos)) ESTADO = d;
    }
  } catch(e){ ESTADO = null; }
  if (!ESTADO){ ESTADO = estadoInicial(); ESTADO.activo = ESTADO.proyectos[0].id; }
  ESTADO.perfiles = Array.isArray(ESTADO.perfiles) ? ESTADO.perfiles : [];
  ESTADO.perfilesInactivos = Array.isArray(ESTADO.perfilesInactivos) ? ESTADO.perfilesInactivos : [];
  ESTADO.marca = ESTADO.marca || { nombre: "Planifica", sub: "", moneda: "€" };
  ESTADO.proyectos = (ESTADO.proyectos||[]).map(normalizarProyecto);
  if (!ESTADO.activo || !proyectoActivo()) ESTADO.activo = ESTADO.proyectos[0].id;
  ESTADO.pestana = ESTADO.pestana || "estructura";
  renderTodo();
  mostrarPestana(ESTADO.pestana);
}
arrancar();
