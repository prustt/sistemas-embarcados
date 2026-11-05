/* Device profiles. GPL-2.0-or-later.
 * Package pin availability and memory capacities are from the manufacturer
 * datasheets. This describes the modeled subset, not full MCU emulation.
 */
(function (root) {
  "use strict";

  const KI = 1024;
  const makePort = (name, base, mask, aliases = []) => ({
    name,
    base,
    mask,
    width: mask > 255 ? 16 : 8,
    aliases,
    pins: Array.from({ length: 16 }, (_, bit) => bit).filter(
      (bit) => mask & (1 << bit),
    ),
  });
  const stmUart = {
    name: "USART2 · modelo de dados",
    kind: "stm32",
    base: 0x40004400,
    dataOffset: 4,
    statusOffset: 0,
    description:
      "SR/DR: RXNE bit 5, TXE bit 7; sem baud rate ou sinais elétricos.",
  };
  const tivaUart = {
    name: "UART0 · modelo de dados",
    kind: "tiva",
    base: 0x4000c000,
    dataOffset: 0,
    statusOffset: 0x18,
    description:
      "DR/FR: RXFE bit 4, TXFF bit 5, TXFE bit 7; sem baud rate ou FIFO temporal.",
  };
  // Clocks: memória RW para o programa ligar os clocks como na placa real.
  // resetValues: offset -> valor no reset (flags de pronto já ligadas).
  // STM32: RCC_CR no offset 0 (RCC_CR = 0x83: HSION, HSIRDY e HSITRIM = 16)
  // e cfgr = offset do RCC_CFGR (SW/SWS), que muda entre F1 e F4.
  const stmF1Rcc = {
    name: "RCC · clocks",
    kind: "stm32",
    base: 0x40021000,
    size: 0x400,
    cfgr: 0x04,
    resetValues: { 0x000: 0x83 },
  };
  const stmF4Rcc = {
    name: "RCC · clocks",
    kind: "stm32",
    base: 0x40023800,
    size: 0x400,
    cfgr: 0x08,
    resetValues: { 0x000: 0x83 },
  };
  // RIS: PLLLRIS (bit 6) e MOSCPUPRIS (bit 8); PLLSTAT: LOCK. DID0 fica 0.
  const tivaSysctl = {
    name: "SYSCTL · clocks",
    kind: "tiva",
    base: 0x400fe000,
    size: 0x1000,
    resetValues: { 0x050: 0x140, 0x168: 0x1 },
  };
  const common = {
    ramBase: 0x20000000,
    clockPolicy:
      "Clocks de GPIO e UART pré-habilitados; RCC/SYSCTL aceitam escrita sem mudar o clock simulado. Tiva: PRx acompanha RCGCx, RIS (PLLLRIS, MOSCPUPRIS) e PLLSTAT.LOCK já prontos, DID0 = 0. STM32: HSIRDY/HSERDY/PLLRDY acompanham HSION/HSEON/PLLON e SWS acompanha SW. Outras flags de pronto (LSE, LSI, PLL do USB) ficam em 0 e laços que esperam por elas travam; mux de pinos não modelado.",
    resetPolicy:
      "Bancada didática: pinos de debug tratados como GPIO; sem bloqueio JTAG/NMI ou sequência de unlock.",
  };
  const DEVICES = {
    stm32f103c8: {
      ...common,
      id: "stm32f103c8",
      name: "STM32F103C8T6",
      vendor: "STMicroelectronics",
      package: "LQFP48",
      model: 8,
      core: "Cortex-M3",
      maxMHz: 72,
      flashBase: 0x08000000,
      flashSize: 64 * KI,
      ramSize: 20 * KI,
      gpioKind: "stm32f1",
      clockControl: { ...stmF1Rcc },
      ports: [
        makePort("A", 0x40010800, 0xffff),
        makePort("B", 0x40010c00, 0xffff),
        makePort("C", 0x40011000, 0xe000),
        makePort("D", 0x40011400, 0x0003),
      ],
      uart: { ...stmUart },
      sources: [
        "https://www.st.com/resource/en/datasheet/stm32f103c8.pdf",
        "https://www.st.com/resource/en/reference_manual/rm0008-stm32f101xx-stm32f102xx-stm32f103xx-stm32f105xx-and-stm32f107xx-advanced-armbased-32bit-mcus-stmicroelectronics.pdf",
      ],
    },
    stm32f407vg: {
      ...common,
      id: "stm32f407vg",
      name: "STM32F407VGT6",
      vendor: "STMicroelectronics",
      package: "LQFP100",
      model: 9,
      core: "Cortex-M4F",
      maxMHz: 168,
      flashBase: 0x08000000,
      flashSize: 1024 * KI,
      ramSize: 128 * KI,
      extraRam: [{ name: "CCM RAM", base: 0x10000000, size: 64 * KI }],
      gpioKind: "stm32f4",
      clockControl: { ...stmF4Rcc },
      ports: [
        makePort("A", 0x40020000, 0xffff),
        makePort("B", 0x40020400, 0xffff),
        makePort("C", 0x40020800, 0xffff),
        makePort("D", 0x40020c00, 0xffff),
        makePort("E", 0x40021000, 0xffff),
        makePort("H", 0x40021c00, 0x0003),
      ],
      uart: { ...stmUart },
      sources: [
        "https://www.st.com/resource/en/datasheet/dm00037051.pdf",
        "https://www.st.com/resource/en/reference_manual/dm00031020.pdf",
      ],
    },
    stm32f411ce: {
      ...common,
      id: "stm32f411ce",
      name: "STM32F411CEU6",
      vendor: "STMicroelectronics",
      package: "UFQFPN48",
      model: 9,
      core: "Cortex-M4F",
      maxMHz: 100,
      flashBase: 0x08000000,
      flashSize: 512 * KI,
      ramSize: 128 * KI,
      gpioKind: "stm32f4",
      clockControl: { ...stmF4Rcc },
      ports: [
        makePort("A", 0x40020000, 0xffff),
        makePort("B", 0x40020400, 0xf7ff),
        makePort("C", 0x40020800, 0xe000),
        makePort("H", 0x40021c00, 0x0003),
      ],
      uart: { ...stmUart },
      sources: [
        "https://www.st.com/resource/en/datasheet/stm32f411ce.pdf",
        "https://www.st.com/resource/en/reference_manual/rm0383-stm32f411xce-advanced-armbased-32bit-mcus-stmicroelectronics.pdf",
      ],
    },
    tm4c123gh6pm: {
      ...common,
      id: "tm4c123gh6pm",
      name: "TM4C123GH6PM",
      vendor: "Texas Instruments",
      package: "LQFP64",
      model: 9,
      core: "Cortex-M4F",
      maxMHz: 80,
      flashBase: 0x00000000,
      flashSize: 256 * KI,
      ramSize: 32 * KI,
      gpioKind: "tiva",
      clockControl: { ...tivaSysctl },
      ports: [
        makePort("A", 0x40004000, 0xff, [0x40058000]),
        makePort("B", 0x40005000, 0xff, [0x40059000]),
        makePort("C", 0x40006000, 0xff, [0x4005a000]),
        makePort("D", 0x40007000, 0xff, [0x4005b000]),
        makePort("E", 0x40024000, 0x3f, [0x4005c000]),
        makePort("F", 0x40025000, 0x1f, [0x4005d000]),
      ],
      aliasPolicy:
        "Aberturas APB e AHB espelhadas simultaneamente; GPIOHBCTL não restringe o acesso.",
      uart: { ...tivaUart },
      sources: ["https://www.ti.com/lit/ds/symlink/tm4c123gh6pm.pdf"],
    },
    tm4c1294ncpdt: {
      ...common,
      id: "tm4c1294ncpdt",
      name: "TM4C1294NCPDT",
      vendor: "Texas Instruments",
      package: "TQFP128",
      model: 9,
      core: "Cortex-M4F",
      maxMHz: 120,
      flashBase: 0x00000000,
      flashSize: 1024 * KI,
      ramSize: 256 * KI,
      gpioKind: "tiva",
      clockControl: { ...tivaSysctl },
      ports: [
        ["A", 0xff],
        ["B", 0x3f],
        ["C", 0xff],
        ["D", 0xff],
        ["E", 0x3f],
        ["F", 0x1f],
        ["G", 0x03],
        ["H", 0x0f],
        ["J", 0x03],
        ["K", 0xff],
        ["L", 0xff],
        ["M", 0xff],
        ["N", 0x3f],
        ["P", 0x3f],
        ["Q", 0x1f],
      ].map(([name, mask], index) =>
        makePort(name, 0x40058000 + index * 0x1000, mask),
      ),
      uart: { ...tivaUart },
      sources: ["https://www.ti.com/lit/ds/symlink/tm4c1294ncpdt.pdf"],
    },
  };

  for (const device of Object.values(DEVICES)) {
    device.pinCount = device.ports.reduce(
      (sum, port) => sum + port.pins.length,
      0,
    );
    device.accessiblePins = device.ports.flatMap((port, index) =>
      port.pins.map((bit) => ({
        port: index,
        bit,
        name: "P" + port.name + bit,
      })),
    );
  }

  root.DEVICES = DEVICES;
  if (typeof module !== "undefined") module.exports = DEVICES;
})(typeof globalThis !== "undefined" ? globalThis : this);
