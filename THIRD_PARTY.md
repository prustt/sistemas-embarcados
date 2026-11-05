# Licenças e fontes

Código da interface e periféricos virtuais: GPL-2.0-or-later. Sem garantia. O texto da GPLv2 está em `vendor/unicorn-LICENSE`.

## Unicorn.js / Unicorn

- Wrapper: Alexandro Sanchez Bach; motor: Nguyen Anh Quynh, Dang Hoang Vu e demais contribuidores.
- Pacote: `@alexaltea/unicorn-js@2.1.4`, GPL-2.0, licença incluída em `vendor/unicorn-LICENSE`.
- Fonte do wrapper: https://github.com/AlexAltea/unicorn.js/tree/560284c59c11c8d6c94d537f4354339f069ddcdf
- Fonte do motor: https://github.com/unicorn-engine/unicorn/tree/2.1.4
- Pacote original: https://registry.npmjs.org/@alexaltea/unicorn-js/-/unicorn-js-2.1.4.tgz
- Modificação (22/10/2026): seletor WASM do modelo MCLASS exportado como global `lab_model` (8=M3, 9=M4), em vez de fixo em M33; o wrapper aceita `wasmBinary` e expõe essa global. A lógica de execução das instruções não foi reimplementada.

## Keystone.js / Keystone

- `@alexaltea/keystone-js@0.9.2`, GPL-2.0. Sem modificações.
- Licença: `vendor/keystone-LICENSE`.
- Wrapper e receita: https://github.com/AlexAltea/keystone.js/tree/7693b038edb6b3352937daeab39321a784fa9075
- Motor: https://github.com/keystone-engine/keystone
- Pacote: https://registry.npmjs.org/@alexaltea/keystone-js/-/keystone-js-0.9.2.tgz

## Capstone.js / Capstone

- `@alexaltea/capstone-js@5.0.9`, BSD-3-Clause. Sem modificações.
- Licença: `vendor/capstone-LICENSE`.
- Wrapper e receita: https://github.com/AlexAltea/capstone.js/tree/52da0b9c931a9f40255461250310cc96cb45c945
- Motor: https://github.com/capstone-engine/capstone
- Pacote: https://registry.npmjs.org/@alexaltea/capstone-js/-/capstone-js-5.0.9.tgz

As receitas upstream identificam os submódulos correspondentes dos motores. Créditos e licenças dos componentes internos permanecem aplicáveis. Todos os scripts da interface são servidos em código-fonte legível. As bibliotecas são servidas localmente, sem CDN.

## Modificações para a disciplina ELF74 (desde 29/10/2026)

Versão modificada de uma IDE web de Assembly distribuída sob GPL-2.0-or-later.

- `index.html`, `app.js`, `core.js`, `devices.js`, `examples.js`, `project.js`: botão "↓ .bin + .hex", abas Startup, Placa real e Instalação, clocks do SYSCTL/RCC no simulador, exemplo 08 da EK-TM4C1294XL, nomes do projeto.
- Novos: `zip.js`, `startup-ui.js`, `startup.css`, `startups.js` (gerado de `startups/`), `placa-icdi.js`, `placa-imagem.js`, `placa-cdc.js`, `placa-ui.js`, `placa.css`, `instalacao-ui.js`, `instalacao.css`, `instalacao/linux/70-tiva-icdi.rules`, `utfpr.css`.
- Startups da ST (`startups/startup_stm32*.s`): arquivos oficiais de STMicroelectronics/cmsis-device-f4 e cmsis-device-f1, sem alteração, Apache-2.0 (`startups/LICENSE-ST-*.md`).
- Startups da TI (`startups/startup_tm4c*.s`): escritos para este projeto; posições e nomes dos vetores tirados de `inc/hw_ints.h` do TivaWare 2.2.0.295.
- `img/utfpr-horizontal.svg` e `img/utfpr-horizontal-negativa.svg`: marca da UTFPR, convertida dos PDFs oficiais de https://www.utfpr.edu.br/comunicacao/design/marca-da-utfpr (na versão negativa só o texto escuro virou branco). A marca é da universidade e não está sob a GPL. Este é um projeto de aluno, não um site oficial da UTFPR.
