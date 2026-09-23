# -*- coding: utf-8 -*-
"""Ensambla Planifica: incrusta style.css y app.js dentro de index.html (sin CDN)."""
import re, pathlib

BASE = pathlib.Path(r"C:\Users\d_ant\Projects\Planifica")
SRC = BASE / "src"
DIST = BASE / "docs"
DIST.mkdir(exist_ok=True)

html = (SRC / "index.html").read_text(encoding="utf-8")
css = (SRC / "style.css").read_text(encoding="utf-8")
js = (SRC / "app.js").read_text(encoding="utf-8")

# Comprobar referencias pendientes antes de incrustar
assert "<link" in html and "style.css" in html, "falta el link del CSS"
assert 'src="app.js"' in html, "falta el script del JS"

# 1) Sustituir el <link> por <style> inline (lambda: evita que re.sub
#    interprete los \u... del CSS/JS como escapes de plantilla)
html = re.sub(
    r'<link rel="stylesheet" href="style\.css">',
    lambda m: "<style>\n" + css + "\n</style>",
    html, count=1)

# 2) Sustituir el <script src> por JS inline (proteger </script> dentro del JS)
js_seguro = js.replace("</script>", "<\\/script>")
html = re.sub(
    r'<script src="app\.js"></script>',
    lambda m: "<script>\n" + js_seguro + "\n</script>",
    html, count=1)

# Verificación: no deben quedar referencias a ficheros externos
problemas = []
if re.search(r'src="(?!https?://|data:)[^"]+"', html.replace('src="app.js"', "")):
    problemas.append("quedan <script src> locales")
if re.search(r'href="(?!\#|https?://)[^"]+\.css"', html):
    problemas.append("quedan <link> css locales")
for p in problemas:
    print("PROBLEMA:", p)
if problemas:
    raise SystemExit(1)

out = DIST / "index.html"
out.write_text(html, encoding="utf-8")
print(f"OK -> {out} ({out.stat().st_size/1024:.1f} KB)")
