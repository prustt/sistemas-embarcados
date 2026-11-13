/* Device-aware Assembly examples. GPL-2.0-or-later. */
(function (root) {
  "use strict";

  const DEVICES =
    root.DEVICES ||
    (typeof require !== "undefined" ? require("./devices.js") : {});
  const address = (register, value) =>
    `    movw ${register}, #0x${(value & 0xffff).toString(16)}\n` +
    `    movt ${register}, #0x${(value >>> 16).toString(16)}\n`;
  const preamble = ".syntax unified\n.thumb\n";

  function examplesForDevice(profile) {
    const device = typeof profile === "string" ? DEVICES[profile] : profile;
    if (!device) throw Error("Perfil de microcontrolador inválido.");
    const a = device.ports[0].base;
    const b = device.ports[1].base;
    const inputOffset =
      device.gpioKind === "stm32f1"
        ? 8
        : device.gpioKind === "tiva"
          ? 0x3fc
          : 0x10;
    const outputOffset =
      device.gpioKind === "stm32f1"
        ? 0x0c
        : device.gpioKind === "tiva"
          ? 0x3fc
          : 0x14;
    const configureOutput = (count) => {
      if (device.gpioKind === "stm32f1") {
        const config = count === 1 ? 0x44444442 : 0x44442222;
        return address("r1", config) + "    str r1, [r0]\n";
      }
      if (device.gpioKind === "tiva") {
        return (
          `    movs r1, #${(1 << count) - 1}\n` +
          "    str r1, [r0, #0x400]\n" +
          "    str r1, [r0, #0x51C]\n"
        );
      }
      return `    movs r1, #${count === 1 ? 1 : 0x55}\n    str r1, [r0]\n`;
    };
    const configureInput =
      device.gpioKind === "tiva"
        ? "    movs r2, #1\n    str r2, [r1, #0x51C]\n"
        : "";
    const uart = device.uart;
    const rxPoll =
      uart.kind === "tiva"
        ? "    ldr r1, [r0, #0x18]\n    tst r1, #16\n    bne poll\n"
        : "    ldr r1, [r0]\n    tst r1, #32\n    beq poll\n";
    const txWait =
      uart.kind === "tiva"
        ? "    ldr r1, [r0, #0x18]     @ FR\n" +
          "    tst r1, #0x20           @ TXFF: FIFO cheia\n" +
          "    bne putc\n"
        : "    ldr r1, [r0]            @ SR\n" +
          "    tst r1, #0x80           @ TXE: pode transmitir\n" +
          "    beq putc\n";
    const semGpio = "Este exemplo não usa GPIO: o analisador fica parado. ";
    const header = "@ " + device.name + " · " + device.package + "\n";

    const examples = {
      blink: {
        name: "01 · Contador nas portas",
        description:
          "PA0–PA3 contam em binário: são os canais 1–4 do analisador e um ciclo 0→F leva 512 passos. Configuração e endereços de GPIO são os do " +
          device.name +
          ". No simulador o clock do GPIO já vem ligado; na placa é preciso ligá-lo antes.",
        canais: ["PA0", "PA1", "PA2", "PA3", "PA4", "PB0"],
        janela: 512,
        code:
          header +
          "@ PA0–PA3: saídas; PUSH/POP preservam a pilha.\n" +
          preamble +
          "start:\n" +
          address("r0", a) +
          configureOutput(4) +
          "    movs r4, #0\n" +
          "loop:\n" +
          `    str r4, [r0, #0x${outputOffset.toString(16)}]\n` +
          "    bl delay\n" +
          "    adds r4, r4, #1\n" +
          "    and r4, r4, #15\n" +
          "    b loop\n\n" +
          "delay:\n" +
          "    push {r2, lr}\n" +
          "    movs r2, #12\n" +
          "wait:\n" +
          "    subs r2, r2, #1\n" +
          "    bne wait\n" +
          "    pop {r2, pc}\n",
      },
      mirror: {
        name: "02 · Entrada → saída",
        description:
          "PB0 é uma entrada e PA0 copia o nível dela. O gerador de onda quadrada já vem ligado em PB0 (64 passos): o analisador mostra PB0 no canal 1 e PA0 no canal 2, alguns passos atrasado. Para mudar PB0 à mão, desligue “Onda quadrada” (o gerador tem prioridade) e clique PB0.",
        canais: ["PB0", "PA0", "PA1", "PA2", "PA3", "PB1"],
        gerador: { pino: "PB0", periodo: 64 },
        porta: "B",
        code:
          header +
          "@ Copia PB0 para PA0 continuamente.\n" +
          preamble +
          address("r0", a) +
          configureOutput(1) +
          address("r1", b) +
          configureInput +
          "poll:\n" +
          `    ldr r2, [r1, #0x${inputOffset.toString(16)}]\n` +
          "    and r2, r2, #1\n" +
          `    str r2, [r0, #0x${outputOffset.toString(16)}]\n` +
          "    b poll\n",
      },
      uart: {
        name: "03 · Terminal serial / echo",
        description:
          "Eco por " +
          uart.name +
          ". Clique Executar: o programa manda “Eco pronto” no Terminal e o canal 1 (" +
          uart.tx +
          ", TX) mostra cada byte como um quadro 8N1 (start 0, 8 bits do LSB ao MSB, stop 1). Depois digite no campo RX e clique Enviar: os bytes chegam pelo canal 2 (" +
          uart.rx +
          ", RX) e o programa testa " +
          (uart.kind === "tiva" ? "RXFE em FR" : "RXNE em SR") +
          ", lê o registrador de dados e devolve cada byte.",
        canais: [
          uart.tx,
          uart.rx,
          ...["PA0", "PA1", "PA2", "PA3", "PB0", "PB1"].filter(
            (n) => n !== uart.tx && n !== uart.rx,
          ),
        ],
        aba: "terminal",
        aviso:
          "Clique Executar: " +
          uart.tx +
          " (TX) e " +
          uart.rx +
          " (RX) mostram a linha serial depois que o programa usa a UART.",
        code:
          header +
          "@ " +
          uart.description +
          "\n" +
          preamble +
          address("r0", uart.base) +
          "    adr r3, texto\n" +
          "saudacao:\n" +
          "    ldrb r2, [r3], #1\n" +
          "    cbz r2, poll\n" +
          "    bl putc\n" +
          "    b saudacao\n" +
          "poll:\n" +
          rxPoll +
          `    ldrb r2, [r0, #${uart.dataOffset}]\n` +
          "    bl putc\n" +
          "    b poll\n\n" +
          "putc:\n" +
          txWait +
          `    strb r2, [r0, #${uart.dataOffset}]\n` +
          "    bx lr\n\n" +
          "    .align 2\n" +
          "texto:\n" +
          '    .asciz "Eco pronto\\r\\n"\n',
      },
      stack: {
        name: "04 · Sub-rotina e pilha",
        description:
          semGpio +
          "BL chama soma; PUSH guarda R4 = 42 e LR na pilha; soma devolve 7 + 5 = 12 em R0 e POP {r4, pc} retorna. O principal grava 12 em 0x20000000 e para no BKPT #0. Use Passo (F11) para ver a pilha cheia: no BKPT ela já voltou ao topo.",
        aviso:
          semGpio +
          "Veja R0, R4, SP e LR nos registradores e a pilha na aba Memória & pilhas.",
        canais: [],
        watches: ["R0", "R1", "R4", "SP", "LR", "mem32(0x20000000)"],
        aba: "memory",
        code:
          header +
          preamble +
          "    movs r0, #7\n" +
          "    movs r1, #5\n" +
          "    movs r4, #42\n" +
          "    bl soma\n" +
          address("r2", device.ramBase) +
          "    str r0, [r2]\n" +
          "    bkpt #0\n" +
          "done:\n" +
          "    b done\n" +
          "soma:\n" +
          "    push {r4, lr}\n" +
          "    adds r4, r0, r1\n" +
          "    mov r0, r4\n" +
          "    pop {r4, pc}\n",
      },
      interrupt: {
        name: "07 · NVIC / interrupção GPIO",
        description:
          "IRQ0 alterna PA0 e incrementa o contador em SRAM+0x100; o vetor é configurado na SRAM. Já vêm ligados o gerador em PB0 (64 passos) e a ligação PB0 → IRQ0 na subida: cada subida de PB0 (canal 1) dispara a IRQ0 e PA0 (canal 2) muda. Para disparar à mão, desligue “Onda quadrada” e clique PB0 ou use Disparar na aba Interrupções.",
        canais: ["PB0", "PA0", "PA1", "PA2", "PA3", "PB1"],
        gerador: { pino: "PB0", periodo: 64 },
        ligacao: { pino: "PB0", irq: 0, borda: "rise" },
        porta: "B",
        code:
          header +
          "@ IRQ0: PA0 alterna; contador em SRAM + 0x100.\n" +
          "@ Aba NVIC: dispare IRQ0 ou ligue PB0 a IRQ0 (subida).\n" +
          preamble +
          address("r0", a) +
          configureOutput(1) +
          address("r1", b) +
          configureInput +
          address("r0", device.ramBase) +
          "    adr r2, irq0_handler\n" +
          "    orr r2, r2, #1\n" +
          "    str r2, [r0, #64]\n" +
          address("r1", 0xe000ed08) +
          "    str r0, [r1]\n" +
          address("r1", 0xe000e100) +
          "    movs r2, #1\n" +
          "    str r2, [r1]\n" +
          "idle:\n    nop\n    b idle\n" +
          "irq0_handler:\n" +
          address("r0", device.ramBase + 0x100) +
          "    ldr r1, [r0]\n    adds r1, r1, #1\n    str r1, [r0]\n" +
          address("r0", a) +
          `    ldr r1, [r0, #0x${outputOffset.toString(16)}]\n` +
          "    eor r1, r1, #1\n" +
          `    str r1, [r0, #0x${outputOffset.toString(16)}]\n` +
          "    bx lr\n",
      },
      fpu: {
        name: "05 · Ponto flutuante · M4F",
        description:
          semGpio +
          "Requer Cortex-M4F. S0 = 1,5; S1 = 2,5; S2 = 4; S3 = 6. O resultado 6,0 é gravado em 0x20000000 em IEEE 754 (0x40C00000).",
        requiresModel: 9,
        aviso:
          semGpio +
          "Veja S0–S3 (Ponto flutuante) e mem32(0x20000000) = 0x40C00000 = 6,0.",
        canais: [],
        watches: ["S0", "S1", "S2", "S3", "mem32(0x20000000)"],
        aba: "debug",
        painelFpu: true,
        code:
          header +
          "@ Requer Cortex-M4F; M3 interrompe por instrução/FPU indisponível.\n" +
          preamble +
          "    vmov.f32 s0, #1.5\n" +
          "    vmov.f32 s1, #2.5\n" +
          "    vadd.f32 s2, s0, s1\n" +
          "    vmul.f32 s3, s2, s0\n" +
          address("r0", device.ramBase) +
          "    vstr s3, [r0]\n" +
          "    bkpt #0\n",
      },
      dsp: {
        name: "06 · DSP / saturação · M4",
        description:
          semGpio +
          "Requer M4. SADD16 soma duas metades de 16 bits (R0 = 0x0018000D); SSAT limita 300 ao intervalo assinado de 8 bits: R4 = 127 e a flag Q liga. RBIT dá R5 = 0xFE000000 e CLZ dá R6 = 25.",
        requiresModel: 9,
        aviso: semGpio + "Veja R0, R4 (flag Q = 1), R5 e R6 nos registradores.",
        canais: [],
        watches: ["R0", "R4", "R5", "R6", "XPSR"],
        aba: "debug",
        code:
          header +
          preamble +
          "    movw r1, #10\n" +
          "    movt r1, #20\n" +
          "    movw r2, #3\n" +
          "    movt r2, #4\n" +
          "    sadd16 r0, r1, r2\n" +
          "    movw r3, #300\n" +
          "    ssat r4, #8, r3\n" +
          "    rbit r5, r4\n" +
          "    clz r6, r4\n" +
          "    bkpt #0\n",
      },
    };
    if (device.id === "tm4c1294ncpdt") examples.placa = ekTm4c1294(device);
    return examples;
  }

  // Mesmo fonte no simulador e na EK-TM4C1294XL (LEDs, USR_SW1 e UART0).
  function ekTm4c1294(device) {
    const port = (name) => device.ports.find((p) => p.name === name).base;
    return {
      name: "08 · Placa EK-TM4C1294XL · LEDs e serial",
      description:
        "Roda igual no simulador e na placa: liga os clocks no SYSCTL, conta de 0 a F nos LEDs D1–D4 e manda “ELF74 N” pela UART0 (115200 8N1, porta serial do depurador; veja o Terminal). O analisador mostra D1–D4 (PN1, PN0, PF4, PF0) e as chaves PJ0/PJ1. PJ0 tem pull-up: solto lê 1 e o contador anda. Para simular USR_SW1 pressionado, clique PJ0 (porta J) para 0; o botão direito solta o pino. Para ver os quadros da UART0, escolha PA1 (TX) num canal e use a janela de 512 passos.",
      canais: ["PN1", "PN0", "PF4", "PF0", "PJ0", "PJ1"],
      janela: 8192,
      porta: "N",
      aba: "terminal",
      code:
        "@ " +
        device.name +
        " · EK-TM4C1294XL\n" +
        "@ LEDs D1=PN1 D2=PN0 D3=PF4 D4=PF0 (ativos em 1); USR_SW1=PJ0 (ativo em 0).\n" +
        "@ UART0 em PA0/PA1: 115200 8N1 com o PIOSC de 16 MHz (clock após o reset).\n" +
        preamble +
        "start:\n" +
        address("r0", 0x400fe608) +
        "    ldr r1, [r0]            @ RCGCGPIO\n" +
        "    movw r2, #0x1121        @ A, F, J e N\n" +
        "    orr r1, r1, r2\n" +
        "    str r1, [r0]\n" +
        "espera_gpio:\n" +
        "    ldr r1, [r0, #0x400]    @ PRGPIO\n" +
        "    and r1, r1, r2\n" +
        "    cmp r1, r2\n" +
        "    bne espera_gpio\n" +
        "    ldr r1, [r0, #0x10]     @ RCGCUART\n" +
        "    orr r1, r1, #1\n" +
        "    str r1, [r0, #0x10]\n" +
        "espera_uart:\n" +
        "    ldr r1, [r0, #0x410]    @ PRUART\n" +
        "    tst r1, #1\n" +
        "    beq espera_uart\n\n" +
        "@ LEDs: PN0/PN1 e PF0/PF4 como saída\n" +
        address("r5", port("N")) +
        "    movs r1, #0x03\n" +
        "    str r1, [r5, #0x400]    @ DIR\n" +
        "    str r1, [r5, #0x51C]    @ DEN\n" +
        address("r6", port("F")) +
        "    movs r1, #0x11\n" +
        "    str r1, [r6, #0x400]\n" +
        "    str r1, [r6, #0x51C]\n" +
        "@ botões: PJ0/PJ1 entrada com pull-up\n" +
        address("r7", port("J")) +
        "    movs r1, #0x03\n" +
        "    str r1, [r7, #0x510]    @ PUR\n" +
        "    str r1, [r7, #0x51C]\n" +
        "@ PA0/PA1 na função alternativa 1 (U0RX/U0TX)\n" +
        address("r0", port("A")) +
        "    movs r1, #0x03\n" +
        "    str r1, [r0, #0x420]    @ AFSEL\n" +
        "    str r1, [r0, #0x51C]\n" +
        "    movs r1, #0x11\n" +
        "    str r1, [r0, #0x52C]    @ PCTL\n" +
        "@ UART0: 16 MHz / (16 * 115200) = 8,68 -> IBRD 8, FBRD 44\n" +
        address("r0", device.uart.base) +
        "    movs r1, #0\n" +
        "    str r1, [r0, #0x30]     @ CTL: desliga para configurar\n" +
        "    movs r1, #8\n" +
        "    str r1, [r0, #0x24]     @ IBRD\n" +
        "    movs r1, #44\n" +
        "    str r1, [r0, #0x28]     @ FBRD\n" +
        "    movs r1, #0x60\n" +
        "    str r1, [r0, #0x2C]     @ LCRH: 8 bits, sem FIFO\n" +
        "    movs r1, #0\n" +
        "    str r1, [r0, #0xFC8]    @ CC: clock do sistema\n" +
        "    movw r1, #0x301\n" +
        "    str r1, [r0, #0x30]     @ CTL: UARTEN, TXE, RXE\n\n" +
        "    movs r4, #0             @ contador\n" +
        "loop:\n" +
        "    ubfx r1, r4, #0, #1     @ bit 0 -> D1 (PN1)\n" +
        "    ubfx r2, r4, #1, #1     @ bit 1 -> D2 (PN0)\n" +
        "    orr r1, r2, r1, lsl #1\n" +
        "    str r1, [r5, #0x0C]     @ DATA só de PN1|PN0 (máscara no endereço)\n" +
        "    ubfx r1, r4, #2, #1     @ bit 2 -> D3 (PF4)\n" +
        "    ubfx r2, r4, #3, #1     @ bit 3 -> D4 (PF0)\n" +
        "    orr r1, r2, r1, lsl #4\n" +
        "    str r1, [r6, #0x44]     @ DATA só de PF4|PF0\n" +
        "    bl envia\n" +
        "    bl atraso\n" +
        "    ldr r1, [r7, #0x04]     @ PJ0: 0 = USR_SW1 pressionado\n" +
        "    tst r1, #1\n" +
        "    beq loop\n" +
        "    adds r4, r4, #1\n" +
        "    and r4, r4, #15\n" +
        "    b loop\n\n" +
        "@ manda \"ELF74 N\\r\\n\" com N = r4 em hexadecimal\n" +
        "envia:\n" +
        "    push {r4, lr}\n" +
        "    adr r2, texto\n" +
        "proximo:\n" +
        "    ldrb r0, [r2], #1\n" +
        "    cbz r0, digito\n" +
        "    bl putc\n" +
        "    b proximo\n" +
        "digito:\n" +
        "    adds r0, r4, #48        @ '0'\n" +
        "    cmp r4, #10\n" +
        "    it hs\n" +
        "    addhs r0, r0, #7        @ 'A'..'F'\n" +
        "    bl putc\n" +
        "    movs r0, #13\n" +
        "    bl putc\n" +
        "    movs r0, #10\n" +
        "    bl putc\n" +
        "    pop {r4, pc}\n\n" +
        "putc:\n" +
        address("r3", device.uart.base) +
        "espera_tx:\n" +
        "    ldr r1, [r3, #0x18]     @ FR\n" +
        "    tst r1, #0x20           @ TXFF: FIFO cheia\n" +
        "    bne espera_tx\n" +
        "    strb r0, [r3]           @ DR\n" +
        "    bx lr\n\n" +
        "atraso:\n" +
        address("r1", 0x400fe000) +
        "    ldr r1, [r1]            @ DID0\n" +
        "    movs r2, #20\n" +
        "    cbz r1, espera          @ DID0 = 0 só no simulador (na placa 0x100A0002): atraso curto\n" +
        "    movw r2, #0x5855\n" +
        "    movt r2, #0x14          @ 1.333.333 voltas de ~3 ciclos: ~0,25 s a 16 MHz (estimado)\n" +
        "espera:\n" +
        "    subs r2, r2, #1\n" +
        "    bne espera\n" +
        "    bx lr\n\n" +
        "    .align 2\n" +
        "texto:\n" +
        '    .asciz "ELF74 "\n',
    };
  }

  root.examplesForDevice = examplesForDevice;
  root.generateExamples = examplesForDevice;
  root.EXAMPLES = examplesForDevice(DEVICES.stm32f411ce);
  if (typeof module !== "undefined") {
    module.exports = root.EXAMPLES;
    Object.defineProperty(module.exports, "examplesForDevice", {
      value: examplesForDevice,
    });
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
