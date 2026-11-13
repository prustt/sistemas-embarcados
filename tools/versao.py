# Põe ?v=<data-hora> nos .css e .js locais do index.html, para o navegador baixar
# os arquivos novos a cada publicação (o GitHub Pages deixa o navegador guardar
# os arquivos por 10 minutos). Rodar antes de cada commit que vai para o site:
#   python3 tools/versao.py
import re
import time
from pathlib import Path

INDEX = Path(__file__).resolve().parent.parent / "index.html"
versao = time.strftime("%Y%m%d%H%M")
html = INDEX.read_text(encoding="utf-8")
novo, n = re.subn(
    r'((?:href|src)=")(?!https?:|//)([^"?#]+\.(?:css|js))(?:\?v=[^"]*)?"',
    lambda m: f'{m.group(1)}{m.group(2)}?v={versao}"',
    html,
)
INDEX.write_text(novo, encoding="utf-8")
print(f"{n} arquivos com ?v={versao}")
