# Como mexer neste projeto

O site é só HTML, CSS e JavaScript, sem etapa de build: o GitHub Pages publica a raiz do repositório como está.

## Pastas

- Raiz: páginas, estilos e scripts do site.
- `vendor/`: motores em WebAssembly (Unicorn, Keystone, Capstone) e as licenças deles.
- `startups/`: os 10 arquivos de startup (ST: oficiais do CMSIS; TI: escritos a partir do `inc/hw_ints.h` do TivaWare 2.2.0.295).
- `startups.js`: gerado a partir de `startups/`.
- `instalacao/linux/70-tiva-icdi.rules`: regra do udev oferecida na aba Instalação.
- `img/`: marca da UTFPR.
- `tools/`: scripts de apoio.

## Depois de mexer nos startups

```bash
python3 tools/gerar_startups_js.py
```

## Rodar localmente

Na pasta do projeto:

```bash
python3 -m http.server 8765
```

Depois abra http://localhost:8765 no Chrome. Abrir o `index.html` direto pelo Finder não funciona, porque o navegador bloqueia os `.wasm` via `file://`.
