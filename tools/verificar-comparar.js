"use strict";
/* =====================================================================
   Planifica v3 — VERIFICACIÓN DE ESCENARIOS, VERSIONES Y ALMACÉN
   Snapshots, deltas entre alternativas, persistencia, importación y CSV.

   Uso:  node tools/verificar-comparar.js
   ===================================================================== */
const { cargarPL, contador, leerDato } = require("./arnes");

/* localStorage y DOM mínimos: el almacén es el único módulo que los toca. */
const almacenFalso = {};
const fakeLS = {
  getItem: k => (Object.prototype.hasOwnProperty.call(almacenFalso, k) ? almacenFalso[k] : null),
  setItem: (k, v) => { almacenFalso[k] = String(v); },
  removeItem: k => { delete almacenFalso[k]; }
};
let descargas = [];
const fakeDoc = {
  createElement: () => ({ style: {}, href: "", download: "", click() { descargas.push(this.download); }, remove() {} }),
  body: { appendChild() {} }
};

const { PL } = cargarPL({
  localStorage: fakeLS, document: fakeDoc,
  Blob: class { constructor(p) { this.partes = p; } },
  URL: { createObjectURL: () => "blob:falso", revokeObjectURL: () => {} },
  setTimeout: () => 0
});

const C = PL.calculo, M = PL.modelo, U = PL.nucleo, E = PL.entregables, X = PL.comparar, A = PL.almacen;
const t = contador("Planifica v3 — escenarios, versiones y almacén");
const check = t.check;

const ESTADO = M.estadoInicial();
const PF = ESTADO.perfiles;
let pr = ESTADO.proyectos[0];

/* ---------- 1. Fotos ---------- */
t.grupo("1. Fotos (snapshots)");
const f = X.foto(pr);
check("la foto guarda los campos de planificación", X.CAMPOS.every(k => f[k] !== undefined));
check("la foto es copia profunda (no referencia viva)", (() => {
  const horas = pr.tareas[0].subtareas[0].lineas[0].horas.m0;
  pr.tareas[0].subtareas[0].lineas[0].horas.m0 = 999;
  const intacta = f.tareas[0].subtareas[0].lineas[0].horas.m0 === horas;
  pr.tareas[0].subtareas[0].lineas[0].horas.m0 = horas;
  return intacta;
})());
check("la foto no guarda importes (se recalculan)", f.importe === undefined && f.total === undefined);
check("la foto lleva fecha", /^\d{4}-\d{2}-\d{2}$/.test(f.creado), f.creado);

/* ---------- 2. Escenarios ---------- */
t.grupo("\n2. Escenarios");
const base = X.resumen(pr, PF);
const esBase = X.crearEscenario(pr, "Base", "Lo ofertado");
check("escenario creado con snapshot", !!esBase.snapshot && pr.escenarios.length === 1);
check("el escenario guarda nombre y etiqueta", esBase.nombre === "Base" && esBase.etiqueta === "Lo ofertado");

/* Recortamos la oferta: la mitad de horas de la segunda tarea */
pr.tareas[1].subtareas.forEach(s => s.lineas.forEach(l => { for (const k in l.horas) l.horas[k] = Math.round(l.horas[k] / 2); }));
const recortada = X.resumen(pr, PF);
const esRec = X.crearEscenario(pr, "Recortada", "Sin la mitad del desarrollo");
check("el escenario recortado cuesta menos", recortada.total < base.total, recortada.total + " vs " + base.total);
check("guardar un escenario no altera la oferta", pr.escenarios.length === 2);

/* ---------- 3. Comparador ---------- */
t.grupo("\n3. Comparación con deltas");
const comp = X.comparar(pr, PF, esBase.snapshot, esRec.snapshot, "Base", "Recortada");
check("detecta diferencias", comp.hayDiferencias === true);
const lineaTotal = comp.economia.filter(l => l.clave === "total")[0];
check("el delta del total es la resta", Math.abs(lineaTotal.d - U.r2(recortada.total - base.total)) < 0.005, lineaTotal.d);
check("delta negativo al recortar", lineaTotal.d < 0);
check("economía con 6 líneas (consultoría…total)", comp.economia.length === 6);
check("estructura con 7 líneas", comp.estructura.length === 7);
check("horas por perfil con deltas", comp.porPerfil.length > 0 && comp.porPerfil.some(x => x.d !== 0));
check("importe por mes con etiquetas", comp.porMes.length === Math.max(base.meses, recortada.meses) && comp.porMes.every(m => !!m.etiqueta));
check("los meses que no cambian tienen delta 0", comp.porMes.some(m => m.d === 0) && comp.porMes.some(m => m.d !== 0));
check("la comparación lista los cambios de horas", comp.cambios.some(c => c.tipo === "horas~"), JSON.stringify(comp.cambios.map(c => c.tipo)));
check("la comparación no muta la oferta", pr.tareas[0].subtareas[0]._x === undefined);

/* Comparación de una oferta modificada en estructura */
const antes = X.foto(pr);
const t2 = M.nuevaTarea("3. Formación al equipo");
t2.entregables = [Object.assign(M.nuevoEntregable("Manual de usuario", "tarea", 5), { facturacionPct: 100 })];
pr.tareas.push(t2);
pr.tareas[0].entregables[0].estado = "entregado";
pr.meses = 8;
const comp2 = X.comparar(pr, PF, antes, X.foto(pr), "Antes", "Ahora");
check("detecta tarea nueva", comp2.cambios.some(c => c.tipo === "tarea+" && /Formación/.test(c.texto)), JSON.stringify(comp2.cambios.map(c => c.texto)));
check("detecta entregable nuevo", comp2.cambios.some(c => c.tipo === "hito+"));
check("detecta cambio de estado de entregable", comp2.cambios.some(c => c.tipo === "hito~" && /entregado/.test(c.texto)));
check("detecta cambio de duración", comp2.cambios.some(c => c.tipo === "meses~"));
check("no inventa cambios que no existen", comp2.cambios.filter(c => c.tipo === "oferta~").length === 0);

/* ---------- 4. Aplicar una foto ---------- */
t.grupo("\n4. Aplicar escenario / versión");
const importeAntes = X.resumen(pr, PF).total;
X.aplicarFoto(pr, esBase.snapshot);
const importeAplicado = X.resumen(pr, PF).total;
check("aplicar la foto base restaura el importe original", Math.abs(importeAplicado - base.total) < 0.005, importeAplicado + " vs " + base.total);
check("aplicar la foto restaura los meses", pr.meses === 6, pr.meses);
check("aplicar la foto restaura los entregables", pr.tareas[0].entregables[0].estado === "aceptado");
check("el importe aplicado difiere del modificado", Math.abs(importeAplicado - importeAntes) > 0.005);
check("aplicarFoto no borra escenarios ni versiones", pr.escenarios.length === 2);
check("aplicar sin foto no rompe", X.aplicarFoto(pr, null) === pr);

/* ---------- 5. Versiones ---------- */
t.grupo("\n5. Versiones de la oferta");
const v1 = X.crearVersion(pr, PF, "v1 enviada al cliente", "Enviada por correo el lunes");
check("versión creada con fecha y nota", !!v1.fecha && v1.nota.length > 0);
check("la versión guarda su resumen económico", !!v1.resumen && v1.resumen.total > 0, JSON.stringify(v1.resumen && v1.resumen.total));
check("el resumen de la versión tiene facturación planificada", v1.resumen.facturadoTotal > 0);
check("la lista de versiones crece", pr.versiones.length === 1);
X.crearVersion(pr, PF, "v2 con cambios");
check("segunda versión registrada", pr.versiones.length === 2);
X.borrarVersion(pr, v1.id);
check("borrar versión por id", pr.versiones.length === 1);
X.borrarEscenario(pr, esRec.id);
check("borrar escenario por id", pr.escenarios.length === 1);

/* ---------- 6. Almacén: guardar y cargar ---------- */
t.grupo("\n6. Almacén (localStorage)");
ESTADO.activo = ESTADO.proyectos[0].id;
const errGuardar = A.guardar(ESTADO);
check("guardar sin error", errGuardar === "", errGuardar);
check("la clave v3 está en el navegador", !!fakeLS.getItem(M.CLAVE));
const rec = A.cargar();
check("cargar devuelve el estado guardado", rec.estado.proyectos.length === ESTADO.proyectos.length);
check("cargar no marca datos heredados", rec.heredado === false);
check("cargar normaliza el estado", rec.estado.version === 3 && !!rec.estado.activo);
check("datosHeredados vacío si solo hay v3", A.datosHeredados().length === 0);

/* ---------- 7. Datos heredados de versiones antiguas ---------- */
t.grupo("\n7. Datos heredados (v1/v2)");
/* Sin clave v3 en el navegador: es el caso real de un usuario que venía de la v1. */
fakeLS.removeItem(M.CLAVE);
fakeLS.setItem("planifica:estado:v1", leerDato("carga-ineco-abono-unico.json"));
const recV1 = A.cargar();
check("carga detecta y migra los datos v1", recV1.heredado === true && recV1.origen === 1);
check("avisa de la migración", /migrad/i.test(recV1.aviso), recV1.aviso);
check("los datos migrados traen sus ofertas", recV1.estado.proyectos.length > 0);
check("el total migrado no lleva IVA inyectado", C.impuestoImporte(recV1.estado.proyectos[0], recV1.estado.perfiles) === 0);
check("datosHeredados lista la clave antigua", A.datosHeredados().length === 1, JSON.stringify(A.datosHeredados()));
A.guardar(ESTADO);   /* ahora sí hay estado v3 en el navegador */
A.olvidarHeredados();
check("olvidarHeredados limpia las claves antiguas", A.datosHeredados().length === 0);
check("olvidarHeredados conserva el estado v3", !!fakeLS.getItem(M.CLAVE));

/* ---------- 8. Importación ---------- */
t.grupo("\n8. Importar JSON");
check("JSON inválido detectado", A.analizarImportacion("{no json").ok === false);
check("JSON ajeno detectado", A.analizarImportacion('{"foo":1}').ok === false);
check("oferta suelta reconocida", A.analizarImportacion(JSON.stringify({ tipo: "planifica-proyecto", proyecto: { nombre: "X" } })).tipo === "proyecto");
check("biblioteca reconocida", A.analizarImportacion(JSON.stringify({ tipo: "planifica-biblioteca", perfiles: [] })).tipo === "biblioteca");
check("copia v1 reconocida con su origen", A.analizarImportacion(JSON.stringify({ version: 1, proyectos: [] })).origen === 1);

const eImp = M.estadoInicial();
const anaP = A.analizarImportacion(JSON.stringify({ tipo: "planifica-proyecto", proyecto: { id: "pr_nuevo", nombre: "Oferta importada", meses: 3, tareas: [] } }));
const rP = A.aplicarImportacion(eImp, anaP, {});
check("importar oferta la añade y la activa", eImp.proyectos.length === 2 && eImp.activo === "pr_nuevo", rP.mensaje);
const anaB = A.analizarImportacion(JSON.stringify({ tipo: "planifica-biblioteca", perfiles: [{ id: "pf_impor", nombre: "Perfil importado", tarifa: 40, categoria: "Otro" }], plantillas: [{ id: "pl_impor", nombre: "Plantilla importada", tareas: [] }] }));
const rB = A.aplicarImportacion(eImp, anaB, {});
check("importar biblioteca añade perfil y plantilla", rB.perfiles === 1 && rB.plantillas === 1, rB.mensaje);
A.aplicarImportacion(eImp, anaB, {});
check("reimportar la misma biblioteca no duplica", eImp.perfiles.filter(p => p.id === "pf_impor").length === 1);

const brutoV1 = JSON.parse(leerDato("carga-ineco-abono-unico.json"));
const anaE = A.analizarImportacion(JSON.stringify(brutoV1));
const eRep = M.estadoInicial();
const rRep = A.aplicarImportacion(eRep, anaE, { reemplazar: true, aplicarMarca: true });
check("importar copia completa reemplaza los datos", eRep.proyectos.length === brutoV1.proyectos.length && rRep.ofertas === brutoV1.proyectos.length, rRep.mensaje);
check("la copia v1 importada cuadra al céntimo", Math.abs(C.subtotalProyecto(eRep.proyectos[0], eRep.perfiles) - 587009.36) < 0.005);
const eFus = M.estadoInicial();
const rFus = A.aplicarImportacion(eFus, anaE, { reemplazar: false });
check("importar fusionando conserva lo que ya había", eFus.proyectos.length === 1 + brutoV1.proyectos.length && rFus.ofertas === brutoV1.proyectos.length, rFus.mensaje);
check("importación inválida no rompe nada", A.aplicarImportacion(eFus, { ok: false, error: "x" }, {}).mensaje === "x");

/* ---------- 9. CSV ---------- */
t.grupo("\n9. CSV para Excel español");
const csv = A.csvProyecto(pr, PF, "€", true);
check("lleva BOM UTF-8 (Excel lo abre bien)", csv.charCodeAt(0) === 0xFEFF);
check("separador punto y coma", csv.indexOf('";"') > 0);
check("sin puntos decimales anglosajones", !/"\d+\.\d+"/.test(csv));
check("incluye el bloque de entregables", csv.indexOf("ENTREGABLES") > 0);
check("incluye el plan de facturación", csv.indexOf("PLAN DE FACTURACIÓN") > 0);
check("incluye el total", csv.indexOf('"TOTAL"') > 0);
check("una fila por línea de horas", (csv.match(/"Horas";/g) || []).length > 0);
const csvOculto = A.csvProyecto(pr, PF, "€", false);
check("con importes ocultos no aparece ningún euro", csvOculto.indexOf("30,00 €") < 0 && csvOculto.indexOf("TOTAL") > 0);
check("con importes ocultos el CSV sigue siendo válido", csvOculto.split("\r\n").length > 10);

/* ---------- 10. Descargas ---------- */
t.grupo("\n10. Exportaciones (nombre de fichero)");
descargas = [];
A.exportarProyecto(pr, PF);
A.exportarTodo(ESTADO);
A.exportarBiblioteca(ESTADO);
check("se han lanzado 3 descargas", descargas.length === 3, descargas.length);
check("los nombres llevan slug y fecha", descargas.every(d => /-\d{4}-\d{2}-\d{2}\.json$/.test(d)), JSON.stringify(descargas));
check("la biblioteca se identifica en el nombre", descargas.some(d => /biblioteca/.test(d)));

t.resumen();
process.exit(t.ko ? 1 : 0);
