/* Imagem para gravar na Flash da placa real. GPL-2.0-or-later.
 * O simulador começa direto na base da Flash, sem tabela de vetores. Na placa
 * o núcleo lê a pilha (palavra 0) e o Reset (palavra 1) do início da Flash,
 * então a imagem fica assim:
 *   flashBase + 0x000  tabela de vetores (nomes do g_pfnVectors do startup GNU)
 *   flashBase + 0x3C0  só Cortex-M4F: liga a FPU e salta para +0x400
 *   flashBase + 0x3FC  "b ." para os vetores sem tratador (o resto fica 0xFF)
 *   flashBase + 0x400  o programa do projeto, montado neste endereço
 * Palavra 0 = fim da SRAM; palavra 1 = +0x3C0 | 1 no M4F, senão início do
 * programa | 1 (um rótulo Reset_Handler não muda isso: a placa começa no
 * topo, como o simulador).
 * Se o programa tem um rótulo com o nome CMSIS de um vetor (SysTick_Handler,
 * GPIOJ_Handler...), a entrada aponta para ele; os outros vão para o "b .".
 * Entradas reservadas (".word 0" no startup) ficam em 0, igual ao startup.
 */
(function (root) {
  "use strict";

  const PROLOGUE_OFFSET = 0x3c0;
  const CODE_OFFSET = 0x400;
  const DEFAULT_OFFSET = 0x3fc;
  const NAME = /^[A-Za-z_.$][\w.$]*$/;
  // O reset() do core.js liga CP10/CP11 no CPACR (model 9); na placa o CPACR
  // começa em 0. r0 e r1 voltam a 0 e as flags não mudam.
  const FPU_ON = [
    "movw r0, #0xed88",
    "movt r0, #0xe000",
    "ldr r1, [r0]",
    "orr r1, r1, #0xf00000",
    "str r1, [r0]",
    "dsb",
    "isb",
    "mov r0, #0",
    "mov r1, #0",
  ];

  // Linhas do startup GNU sem comentários (/* */, @ e //).
  function startupLines(deviceId) {
    const startup = (root.LabStartups || {})[deviceId];
    if (!startup || !startup.gnu)
      throw Error("Startup GNU não encontrado para " + deviceId + ".");
    return startup.gnu.source
      .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ""))
      .split("\n")
      .map((line) => line.replace(/@.*$/, "").replace(/\/\/.*$/, "").trim());
  }

  // Nomes da tabela g_pfnVectors, na ordem; null = reservado (".word 0").
  // A tabela acaba na primeira linha que não é ".word" (ex.: .size ou .weak).
  function vectorNames(deviceId) {
    const lines = startupLines(deviceId);
    const start = lines.findIndex((line) => /^g_pfnVectors\s*:/.test(line));
    if (start < 0)
      throw Error("Tabela g_pfnVectors não encontrada no startup.");
    const names = [];
    for (const line of lines.slice(start + 1)) {
      if (!line) continue;
      const match = /^\.word\s+(\S+)$/.exec(line);
      if (!match) break;
      if (match[1] === "0") names.push(null);
      else if (NAME.test(match[1])) names.push(match[1]);
      else throw Error("Entrada da tabela não reconhecida: " + line);
    }
    if (names.length < 16) throw Error("Tabela g_pfnVectors incompleta.");
    return names;
  }

  // Constantes ".equ" do startup (ex.: BootRAM do STM32F103).
  function startupConstants(deviceId) {
    const result = {};
    for (const line of startupLines(deviceId)) {
      const match =
        /^\.equ\s+([A-Za-z_.$][\w.$]*)\s*,\s*(0x[0-9a-f]+|\d+)$/i.exec(line);
      if (match) result[match[1]] = Number(match[2]) >>> 0;
    }
    return result;
  }

  function labelsIn(source) {
    const labels = new Set();
    for (const item of source.split("\n")) {
      let line = item.trim();
      let match;
      while ((match = /^([A-Za-z_.$][\w.$]*)\s*:\s*/.exec(line))) {
        labels.add(match[1]);
        line = line.slice(match[0].length);
      }
    }
    return labels;
  }

  // Números de 32 bits do fonte: depois de "=", ".word" ou vírgula, e pares
  // movw/movt no mesmo registrador.
  function numbersIn(source) {
    const numbers = [];
    const low = {};
    for (const line of source.toLowerCase().split("\n")) {
      const movw = /\bmovw\s+(\w+)\s*,\s*#(0x[0-9a-f]+|\d+)/.exec(line);
      if (movw) low[movw[1]] = Number(movw[2]);
      const movt = /\bmovt\s+(\w+)\s*,\s*#(0x[0-9a-f]+|\d+)/.exec(line);
      if (movt)
        numbers.push((Number(movt[2]) * 0x10000 + (low[movt[1]] || 0)) >>> 0);
      for (const match of line.matchAll(/(?:=|\.word|,)\s*(0x[0-9a-f]+|\d+)/g))
        numbers.push(Number(match[1]) >>> 0);
    }
    return numbers;
  }

  // O simulador começa com os clocks de GPIO e UART ligados; a placa não.
  function warningsFor(device, source) {
    const clock = device.clockControl;
    if (!clock) return [];
    const pages = new Set(
      [
        device.uart.base,
        ...device.ports.flatMap((port) => [port.base, ...port.aliases]),
      ].map((base) => (base & ~0xfff) >>> 0),
    );
    const numbers = numbersIn(source);
    const usesPeripheral = numbers.some((n) => pages.has((n & ~0xfff) >>> 0));
    const touchesClock = numbers.some(
      (n) => n >= clock.base && n < clock.base + clock.size,
    );
    if (!usesPeripheral || touchesClock) return [];
    if (clock.kind === "tiva")
      return [
        "O programa usa GPIO/UART sem ligar o clock no SYSCTL (RCGCx em 0x400FE6xx, depois esperar PRx em 0x400FEAxx). No simulador funciona; na placa o primeiro acesso dá falha de barramento e o núcleo fica parado no \"b .\" em 0x" +
          (device.flashBase + DEFAULT_OFFSET).toString(16).toUpperCase() +
          (device.id === "tm4c1294ncpdt" ? ". Veja o exemplo 08." : "."),
      ];
    return [
      "O programa usa GPIO/UART sem ligar o clock no RCC (registradores ...ENR em 0x" +
        clock.base.toString(16).toUpperCase() +
        "). No simulador funciona; na placa o periférico fica desligado e não responde.",
    ];
  }

  function assemble(lab, source, base) {
    const result = lab.assembler.asm(source, base);
    if (result.failed || !result.mc || !result.mc.length)
      throw Error(
        "Assembly inválido. Verifique sintaxe GNU/Thumb, rótulos e operandos.",
      );
    return result.mc;
  }

  function build(lab, project) {
    const device = lab.device;
    if (typeof project !== "string" && project.deviceId !== device.id)
      throw Error(
        "O projeto é do " +
          project.deviceId +
          ", mas o simulador está no " +
          device.id +
          ".",
      );
    const source =
      typeof project === "string" ? project : project.sourceForBuild().source;
    // mesmo tratamento de comentários do assemble() do core.js
    const clean = source
      .split("\n")
      .map((line) => line.replace(/@.*$/, "").replace(/\/\/.*$/, ""))
      .join("\n");
    const names = vectorNames(device.id);
    if (names.length * 4 > PROLOGUE_OFFSET)
      throw Error(
        "A tabela de vetores do " +
          device.name +
          " (" +
          names.length +
          " entradas, " +
          names.length * 4 +
          " bytes) não cabe antes de +0x3C0.",
      );
    const base = device.flashBase;
    const codeBase = base + CODE_OFFSET;
    const code = assemble(lab, clean, codeBase);
    if (CODE_OFFSET + code.length > device.flashSize)
      throw Error("Programa e tabela de vetores excedem a Flash.");

    // endereço dos tratadores: monta de novo com ".word rótulo" no fim
    const labels = labelsIn(clean);
    const wanted = [
      ...new Set(names.slice(2).filter((name) => name && labels.has(name))),
    ];
    const handlers = {};
    if (wanted.length) {
      const probe = assemble(
        lab,
        clean +
          "\n.ltorg\n.align 2\n" +
          wanted.map((name) => ".word " + name).join("\n") +
          "\n",
        codeBase,
      );
      const start = probe.length - wanted.length * 4;
      if (start < code.length || code.some((byte, i) => probe[i] !== byte))
        throw Error("Não foi possível ler o endereço dos tratadores.");
      const view = new DataView(
        probe.buffer,
        probe.byteOffset,
        probe.byteLength,
      );
      wanted.forEach((name, i) => {
        handlers[name] = (view.getUint32(start + i * 4, true) & ~1) >>> 0;
      });
    }

    // mesma condição do reset() do core.js para ligar a FPU
    const prologue = device.model === 9 ? base + PROLOGUE_OFFSET : null;
    const fpu =
      prologue === null
        ? null
        : assemble(
            lab,
            ".syntax unified\n.thumb\n" +
              FPU_ON.map((line) => "    " + line + "\n").join("") +
              "    b.w 0x" +
              codeBase.toString(16) +
              "\n",
            prologue,
          );

    const stack = (device.ramBase + device.ramSize) >>> 0;
    const entry = ((prologue === null ? codeBase : prologue) | 1) >>> 0;
    const fallback = (base + DEFAULT_OFFSET) | 1;
    const constants = startupConstants(device.id);
    const vectors = names.map((name, index) => {
      let address = fallback;
      if (index === 0) address = stack;
      else if (index === 1) address = entry;
      else if (!name) address = 0;
      else if (Object.hasOwn(handlers, name)) address = handlers[name] | 1;
      else if (Object.hasOwn(constants, name)) address = constants[name];
      return { index, name, address: address >>> 0 };
    });

    const image = new Uint8Array((CODE_OFFSET + code.length + 3) & ~3);
    image.fill(0xff);
    const view = new DataView(image.buffer);
    for (const vector of vectors)
      view.setUint32(vector.index * 4, vector.address, true);
    if (fpu) image.set(fpu, PROLOGUE_OFFSET);
    image.set([0xfe, 0xe7], DEFAULT_OFFSET); // b .
    image.set(code, CODE_OFFSET);
    return {
      image,
      base,
      codeBase,
      entry,
      stack,
      vectors,
      handlers,
      codeSize: code.length,
      prologue,
      defaultHandler: base + DEFAULT_OFFSET,
      deviceId: device.id,
      warnings: warningsFor(device, clean),
    };
  }

  root.LabBoardImage = {
    build,
    vectorNames,
    PROLOGUE_OFFSET,
    CODE_OFFSET,
    DEFAULT_OFFSET,
  };
  if (typeof module !== "undefined") module.exports = root.LabBoardImage;
})(typeof globalThis !== "undefined" ? globalThis : this);
