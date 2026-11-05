# Sistemas Embarcados · ELF74

IDE de Assembly ARM Cortex-M no navegador, com simulador de STM32 e Tiva C (Unicorn + Keystone + Capstone em WebAssembly), feita para a disciplina ELF74 – Sistemas Embarcados (UTFPR, DAELN, Câmpus Curitiba), prof. Paulo Denis Garcez da Luz.

Site: https://prustt.github.io/sistemas-embarcados/

Projeto de aluno, **não é um site oficial da UTFPR**.

- Simulador com depurador, analisador lógico, GPIO, NVIC e árvore de clock para 5 micros (STM32F411, STM32F103, STM32F407, TM4C123GH6PM, TM4C1294NCPDT).
- Botão **↓ .bin + .hex**.
- Aba **Startup**: arquivos de inicialização dos 5 micros, em GNU (GCC) e Keil (ARMASM).
- Aba **Placa real**: grava e monitora a EK-TM4C1294XL (e a EK-TM4C123GXL) pelo depurador ICDI da placa, direto do navegador (WebUSB), com terminal serial. Chrome ou Edge no computador, ou Chrome no Android com cabo OTG.
- Aba **Instalação**: o que cada sistema precisa antes (driver da TI no Windows, regra do udev no Linux).

Testado com a EK-TM4C1294XL no Chrome do macOS e num celular Android.

Software livre, GPL-2.0-or-later. Licenças e créditos em [THIRD_PARTY.md](THIRD_PARTY.md); os startups da ST são Apache-2.0 e a marca da UTFPR em `img/` pertence à universidade. Como mexer no projeto: [LEIA-ME.md](LEIA-ME.md).
