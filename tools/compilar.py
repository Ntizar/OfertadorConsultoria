# -*- coding: utf-8 -*-
"""Compila Planifica v4: incrusta Aurora 7 + el CSS propio + los módulos JS
en un único HTML autocontenido (abrible con doble clic, sin CDN, sin servidor).

Uso:  py -3.12 tools/compilar.py

Guardas (si alguna falla, NO se escribe el destino y sale con código 1):
  · falta algún fichero fuente        · queda algún marcador sin sustituir
  · falta alguna de las 5 secciones   · vuelve el selector roto main>section
"""
import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
AURORA = Path(r"C:/Users/d_ant/Projects/Aurora-7")
TAG = "v7.2.0"

PACKS = [
    "tokens.css",
    "packs/p1-layout.css",
    "packs/p2-navigation.css",
    "packs/p3-typography.css",
    "packs/p4-actions.css",
    "packs/p5-forms.css",
    "packs/p6-feedback.css",
    "packs/p7-overlays.css",
    "packs/p8-data.css",
    "packs/p13-charts.css",
]

# Orden de carga OBLIGATORIO: núcleo → periodos → modelo → cálculo → datos →
# gantt → vistas → acciones → eventos → arranque.
MODULOS_JS = [
    "nucleo.js",
    "periodos.js",
    "modelo.js",
    "ejemplo.js",
    "calculo.js",
    "entregables.js",
    "comparar.js",
    "almacen.js",
    "gantt.js",
    "vistas.js",
    "vista-trabajo.js",
    "vista-oferta.js",
    "vista-perfiles.js",
    "vista-resumen.js",
    "vista-informe.js",
    "vista-ajustes.js",
    "acciones.js",
    "eventos.js",
    "main.js",
]

SECCIONES = ["sec-trabajo", "sec-oferta", "sec-perfiles", "sec-resumen", "sec-informe", "sec-ajustes"]

PROHIBIDO = [
    (r'\$\$\("main>section"\)', 'ha vuelto el selector roto $$("main>section")'),
]


def morir(mensaje):
    print("COMPILACIÓN FALLIDA: " + mensaje)
    sys.exit(1)


def lee_aurora(rel):
    ruta = AURORA / rel
    if not ruta.exists():
        morir("no existe el pack de Aurora %s" % ruta)
    return ruta.read_text(encoding="utf-8")


def main():
    html = (BASE / "src" / "index.html").read_text(encoding="utf-8")
    css_propio = (BASE / "src" / "css" / "app.css").read_text(encoding="utf-8")

    trozos, faltan = [], []
    for m in MODULOS_JS:
        ruta = BASE / "src" / "js" / m
        if not ruta.exists():
            faltan.append(m)
            continue
        trozos.append("/* ====== MÓDULO %s ====== */\n%s" % (m, ruta.read_text(encoding="utf-8")))
    if faltan:
        morir("faltan módulos JS: %s" % ", ".join(faltan))
    js = "\n".join(trozos)

    packs = "\n".join("/* ====== Aurora 7 %s: %s ====== */\n%s" % (TAG, p, lee_aurora(p)) for p in PACKS)
    bloque_css = ("<style>\n/* ====== Aurora 7 %s incrustado (%d packs) ====== */\n%s\n"
                  "/* ====== CSS propio de la aplicación ====== */\n%s\n</style>") % (
        TAG, len(PACKS), packs, css_propio)

    for marcador in ("<!--PACKS_CSS-->", "<!--APP_CSS-->", "/*APP_JS*/"):
        if marcador not in html:
            morir("el HTML fuente no tiene el marcador %s" % marcador)

    html = html.replace("<!--PACKS_CSS-->", bloque_css)
    html = html.replace("<!--APP_CSS-->", "")
    html = html.replace("/*APP_JS*/", js)

    for marcador in ("<!--PACKS_CSS-->", "<!--APP_CSS-->", "/*APP_JS*/"):
        if marcador in html:
            morir("quedó el marcador %s sin sustituir" % marcador)
    for sec in SECCIONES:
        if 'id="%s"' % sec not in html:
            morir("falta la sección %s" % sec)
    for patron, aviso in PROHIBIDO:
        if re.search(patron, html):
            morir(aviso)

    destino = BASE / "docs" / "index.html"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(html, encoding="utf-8")

    print("OK -> %s (%.1f KB)" % (destino, destino.stat().st_size / 1024))
    print("     %d módulos JS · %d packs de Aurora %s · CSS propio %.1f KB" % (
        len(MODULOS_JS), len(PACKS), TAG, len(css_propio) / 1024))


if __name__ == "__main__":
    main()
