/* Simulador Cortex-M — GPL-2.0-or-later. CPU execution: Unicorn.js 2.1.4. */
(function (root) {
  "use strict";

  const DEVICES =
    root.DEVICES ||
    (typeof require !== "undefined" ? require("./devices.js") : {});
  const LabNVIC =
    root.LabNVIC ||
    (typeof require !== "undefined" ? require("./nvic.js").LabNVIC : null);
  const FLASH = 0x08000000;
  const RAM = 0x20000000;
  const GPIO = 0x40020000;
  const UART = 0x40004400;
  // Linha serial nos pinos TX/RX: quadro 8N1 (10 bits) com 4 passos por bit.
  const PASSOS_BIT = 4;
  const QUADRO = 10 * PASSOS_BIT;
  // Mensagens do Keystone no console (ex.: fixup fora do alcance); o host
  // passa LAB.printErr ao criar o módulo do montador.
  const saidaMontador = [];
  const hex = (value, digits = 8) =>
    (value >>> 0).toString(16).toUpperCase().padStart(digits, "0");
  const reg = (name, offset, field, access = "RW", description = "") => ({
    name,
    offset,
    field,
    access,
    description,
  });
  const GPIO_REGISTERS = {
    stm32f1: [
      reg(
        "CRL",
        0x00,
        "crl",
        "RW",
        "MODE/CNF: quatro bits por pino 0–7; 0x8 = entrada com pull (ODR escolhe)",
      ),
      reg("CRH", 0x04, "crh", "RW", "MODE/CNF: quatro bits por pino 8–15"),
      reg("IDR", 0x08, "idr", "RO", "Níveis digitais dos pinos"),
      reg("ODR", 0x0c, "odr", "RW", "Latch de saída"),
      reg(
        "BSRR",
        0x10,
        "bsrr",
        "WO",
        "Set nos bits 0–15, reset nos bits 16–31",
      ),
      reg("BRR", 0x14, "brr", "WO", "Reset de bits da saída"),
    ],
    stm32f4: [
      reg(
        "MODER",
        0x00,
        "moder",
        "RW",
        "00 entrada, 01 saída, 10 AF, 11 analógico",
      ),
      reg(
        "OTYPER",
        0x04,
        "otyper",
        "RW",
        "Armazenado; open-drain elétrico não modelado",
      ),
      reg(
        "OSPEEDR",
        0x08,
        "ospeedr",
        "RW",
        "Armazenado; velocidade elétrica não modelada",
      ),
      reg(
        "PUPDR",
        0x0c,
        "pupdr",
        "RW",
        "01 pull-up, 10 pull-down: nível da entrada sem nada ligado",
      ),
      reg("IDR", 0x10, "idr", "RO", "Níveis digitais dos pinos"),
      reg("ODR", 0x14, "odr", "RW", "Latch de saída"),
      reg(
        "BSRR",
        0x18,
        "bsrr",
        "WO",
        "Set nos bits 0–15, reset nos bits 16–31",
      ),
      reg(
        "AFRL",
        0x20,
        "afrl",
        "RW",
        "Armazenado; função alternativa não executada",
      ),
      reg(
        "AFRH",
        0x24,
        "afrh",
        "RW",
        "Armazenado; função alternativa não executada",
      ),
    ],
    tiva: [
      reg(
        "DATA",
        0x3fc,
        "pins",
        "RW",
        "Abertura completa; bits de endereço [9:2] selecionam máscara",
      ),
      reg("DIR", 0x400, "dir", "RW", "0 entrada, 1 saída"),
      reg(
        "AFSEL",
        0x420,
        "afsel",
        "RW",
        "1 seleciona função alternativa; sinal AF não simulado",
      ),
      reg(
        "DR2R",
        0x500,
        "dr2r",
        "RW",
        "Armazenado; corrente elétrica não modelada",
      ),
      reg(
        "DR4R",
        0x504,
        "dr4r",
        "RW",
        "Armazenado; corrente elétrica não modelada",
      ),
      reg(
        "DR8R",
        0x508,
        "dr8r",
        "RW",
        "Armazenado; corrente elétrica não modelada",
      ),
      reg(
        "ODR",
        0x50c,
        "openDrain",
        "RW",
        "Controle open-drain; não é o latch de dados",
      ),
      reg(
        "PUR",
        0x510,
        "pur",
        "RW",
        "1 liga o pull-up (limpa o bit em PDR): entrada solta lê 1",
      ),
      reg(
        "PDR",
        0x514,
        "pdr",
        "RW",
        "1 liga o pull-down (limpa o bit em PUR): entrada solta lê 0",
      ),
      reg(
        "SLR",
        0x518,
        "slr",
        "RW",
        "Armazenado; slew-rate elétrico não modelado",
      ),
      reg("DEN", 0x51c, "den", "RW", "1 habilita a função digital do pino"),
      reg(
        "AMSEL",
        0x528,
        "amsel",
        "RW",
        "1 desabilita o sinal digital para função analógica",
      ),
      reg(
        "PCTL",
        0x52c,
        "pctl",
        "RW",
        "Armazenado; mux de função alternativa não modelado",
      ),
    ],
  };

  class LabSimulador {
    constructor(uc, ks, cs) {
      this.u = uc;
      this.k = ks;
      this.c = cs;
      this.assembler = new ks.Keystone(ks.ARCH_ARM, ks.MODE_THUMB);
      this.decoder = new cs.Capstone(
        cs.ARCH_ARM,
        cs.MODE_THUMB | cs.MODE_MCLASS,
      );
      this.device = DEVICES.stm32f411ce;
      this.model = this.device.model;
      this.manual = this.device.ports.map(() => 0);
      this.driven = this.device.ports.map(() => 0);
      this.generator = {
        enabled: false,
        port: 1,
        pin: 0,
        period: 64,
        duty: 50,
      };
      this.wire = { enabled: false, from: 0, fp: 0, to: 1, tp: 1 };
      this.code = null;
      this.listing = [];
      this.byAddr = new Map();
      this.breakpoints = new Set();
      this.onAccess = null;
      this.nvic = new LabNVIC(this);
      this.reset();
    }

    selectDevice(id) {
      const device = DEVICES[id];
      if (!device) throw Error("Microcontrolador desconhecido: " + id);
      this.device = device;
      this.model = device.model;
      this.code = null;
      this.listing = [];
      this.byAddr = new Map();
      this.breakpoints.clear();
      this.manual = device.ports.map(() => 0);
      this.driven = device.ports.map(() => 0);
      this.generator.enabled = false;
      this.wire.enabled = false;
      this.reset();
      return device;
    }

    reg(name) {
      return this.e.reg_read_i32(this.u["ARM_REG_" + name]) >>> 0;
    }

    setReg(name, value) {
      if (this.u["ARM_REG_" + name] === undefined)
        throw Error("Registrador inválido");
      this.e.reg_write_i32(this.u["ARM_REG_" + name], value >>> 0);
    }

    word(address) {
      return new DataView(
        Uint8Array.from(this.memory(address, 4)).buffer,
      ).getUint32(0, true);
    }

    put(address, value) {
      const bytes = new Uint8Array(4);
      new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
      this.e.mem_write(address, bytes);
    }

    getMemoryRegions() {
      const device = this.device;
      const regions = [
        {
          name: "Flash",
          base: device.flashBase,
          size: device.flashSize,
          access: "RX",
          kind: "flash",
        },
        {
          name: "SRAM",
          base: device.ramBase,
          size: device.ramSize,
          access: "RW",
          kind: "ram",
        },
        ...(device.extraRam || []).map((r) => ({
          ...r,
          access: "RW",
          kind: "ram",
        })),
      ];
      for (const port of device.ports) {
        regions.push({
          name: "GPIO " + port.name,
          base: port.base,
          size: this.gpioWindowSize,
          access: "RW",
          kind: "gpio",
        });
        for (const base of port.aliases) {
          regions.push({
            name: "GPIO " + port.name + " · AHB alias",
            base,
            size: this.gpioWindowSize,
            access: "RW",
            kind: "gpio",
          });
        }
      }
      regions.push({
        name: device.uart.name,
        base: device.uart.base,
        size: 0x1000,
        access: "RW",
        kind: "uart",
      });
      if (device.clockControl) {
        regions.push({
          name: device.clockControl.name,
          base: device.clockControl.base,
          size: device.clockControl.size,
          access: "RW",
          kind: "system",
        });
      }
      regions.push({
        name: "NVIC / SCB / SysTick",
        base: 0xe000e000,
        size: 0x2000,
        access: "RW",
        kind: "system",
      });
      return regions;
    }

    get gpioWindowSize() {
      return this.device.gpioKind === "tiva" ? 0x1000 : 0x400;
    }

    reset() {
      if (this.e) {
        for (const hook of this.hooks) this.e.hook_del(hook);
        this.e.close();
        this.u._free(this.e.handle_ptr);
      }
      if (this.u.lab_model) this.u.lab_model.value = this.model;
      this.e = new this.u.Unicorn(
        this.u.ARCH_ARM,
        this.u.MODE_THUMB | this.u.MODE_MCLASS,
      );
      this.hooks = [];
      const device = this.device;
      // Deterministic workbench reset: explicitly clear mapped bytes. Unicorn's
      // allocator is not a promise that newly mapped backing memory is zeroed.
      const mapCleared = (base, size, access) => {
        this.e.mem_map(base, size, access);
        this.e.mem_write(base, new Uint8Array(size));
      };
      mapCleared(device.flashBase, device.flashSize, 7);
      mapCleared(device.ramBase, device.ramSize, 3);
      for (const region of device.extraRam || [])
        mapCleared(region.base, region.size, 3);
      const pages = new Set();
      for (const port of device.ports) {
        for (const base of [port.base, ...port.aliases])
          pages.add((base & ~0xfff) >>> 0);
      }
      pages.add((device.uart.base & ~0xfff) >>> 0);
      if (device.clockControl)
        pages.add((device.clockControl.base & ~0xfff) >>> 0);
      for (const page of pages) mapCleared(page, 0x1000, 3);
      const clock = device.clockControl;
      if (clock && clock.resetValues)
        for (const [offset, value] of Object.entries(clock.resetValues))
          this.put(clock.base + Number(offset), value);
      mapCleared(0xe000e000, 0x2000, 3);
      this.t = 0;
      this.rx = [];
      this.tx = "";
      this.linha = { ativa: false, tx: [], rx: [], fimTx: 0, fimRx: 0 };
      this.pinosUart = ["tx", "rx"]
        .map((lado) => {
          const m = /^P([A-Z])(\d+)$/.exec(device.uart[lado] || "");
          const index = m ? device.ports.findIndex((p) => p.name === m[1]) : -1;
          return index < 0 ? null : { lado, index, bit: Number(m[2]) };
        })
        .filter(Boolean);
      this.events = [];
      this.trace = [];
      this.stopReason = "Pronto";
      this.halted = false;
      this.breakpointPause = false;
      this.lastStepEvent = null;
      this.nvic.reset();
      this._registerCache = new Map();
      this.ports = device.ports.map(() => ({
        moder: 0,
        odr: 0,
        idr: 0,
        pins: 0,
        crl: 0x44444444,
        crh: 0x44444444,
        otyper: 0,
        ospeedr: 0,
        pupdr: 0,
        afrl: 0,
        afrh: 0,
        dir: 0,
        den: 0,
        afsel: 0,
        amsel: 0,
        pctl: 0,
        dr2r: 0xff,
        dr4r: 0,
        dr8r: 0,
        openDrain: 0,
        pur: 0,
        pdr: 0,
        slr: 0,
        bsrr: 0,
        brr: 0,
      }));
      this.setReg("MSP", device.ramBase + device.ramSize);
      this.setReg("PSP", device.ramBase + Math.floor(device.ramSize / 2));
      this.setReg("LR", 0xffffffff);
      this.setReg("PC", device.flashBase | 1);
      if (this.model === 9) this.setReg("C1_C0_2", 0x00f00000);
      if (this.code) this.e.mem_write(device.flashBase, this.code);
      this.e.mem_protect(device.flashBase, device.flashSize, 5);

      this.hooks.push(
        this.e.hook_add(
          this.u.HOOK_MEM_WRITE,
          (_, type, address, size, value) => {
            address = Number(address);
            this.onWrite(address, size, value);
            this._notifyAccess("write", address, size, Number(value));
          },
        ),
      );
      this.hooks.push(
        this.e.hook_add(this.u.HOOK_MEM_READ, (_, type, address, size) => {
          address = Number(address);
          this._refreshRead(address, size, true);
          if (this.onAccess) {
            const bytes = this.e.mem_read(address, Math.min(size, 4));
            let value = 0;
            for (let i = 0; i < bytes.length; i++)
              value += bytes[i] * 2 ** (8 * i);
            this._notifyAccess("read", address, size, value >>> 0);
          }
        }),
      );
      this.hooks.push(
        this.e.hook_add(this.u.HOOK_INTR, (_, number) => {
          this._engineException = { number, pc: this.reg("PC") };
          this.e.emu_stop();
        }),
      );
      this.sync();
      this.sample();
    }

    _notifyAccess(type, address, size, value) {
      if (typeof this.onAccess === "function") {
        this.onAccess({ type, address, size, value, pc: this.reg("PC") });
      }
    }

    assemble(source) {
      const clean = source
        .split("\n")
        .map((line) => line.replace(/@.*$/, "").replace(/\/\/.*$/, ""))
        .join("\n");
      const result = this._montar(clean);
      if (result.failed || !result.mc.length) {
        throw Error(
          "Assembly inválido" +
            (result.failed ? " (" + this._assemblerMessage() + ")" : "") +
            ". Verifique sintaxe GNU/Thumb, rótulos e operandos. " +
            (result.count
              ? "Instruções processadas: " + result.count
              : "Nenhuma instrução montada."),
        );
      }
      if (result.mc.length > this.device.flashSize)
        throw Error("Programa excede a Flash do dispositivo.");
      return this.loadBinary(result.mc);
    }

    // Monta com o Keystone. Também conta como falha: o montador travar
    // (ex.: .text ou .align 99) ou escrever "error:" no console sem errno
    // (ex.: literal do ldr =x longe demais, que sairia com o registrador errado).
    _montar(texto) {
      saidaMontador.length = 0;
      this._falha = null;
      let result;
      try {
        result = this.assembler.asm(texto, this.device.flashBase);
      } catch {
        this._falha = { message: "diretiva ou valor não aceito pelo montador" };
        return { failed: true, mc: [], count: 0 };
      }
      const erro = saidaMontador.findIndex((linha) => /^error:/.test(linha));
      if (!result.failed && erro >= 0) {
        this._falha = {
          message: /out of range|fixup/.test(saidaMontador[erro])
            ? "valor ou destino fora do alcance da instrução"
            : "diretiva ou sintaxe não aceita pelo montador",
          linha: saidaMontador[erro + 1],
        };
        return { failed: true, mc: [], count: result.count };
      }
      return result;
    }

    _assemblerMessage() {
      if (this._falha) return this._falha.message;
      let text = "";
      try {
        text = this.k.strerror(this.assembler.errno());
      } catch {}
      const code = (/KS_ERR_ASM_(\w+)/.exec(text) || [])[1];
      if (!code) return "erro de montagem";
      const grupos = [
        [/^MNEMONICFAIL$/, "instrução desconhecida"],
        [/^INVALIDOPERAND$/, "operando inválido para esta instrução"],
        [/^SYMBOL_MISSING$/, "rótulo ou símbolo não definido"],
        [/^SYMBOL_REDEFINED$/, "rótulo definido mais de uma vez"],
        [/^(MISSINGFEATURE|INSN_UNSUPPORTED)$/, "instrução não aceita pelo montador neste modo"],
        [/^(STAT_TOKEN|DIRECTIVE_UNKNOWN|DIRECTIVE_INVALID)$/, "diretiva ou instrução desconhecida"],
        [/^DIRECTIVE_VALUE_RANGE$/, "valor fora da faixa da diretiva"],
        [/^FIXUP_INVALID$/, "destino fora do alcance da instrução"],
        [/^ESC_/, "sequência de escape inválida no texto"],
        [/^MACRO_/, "macro inválida"],
        [/^(DIRECTIVE_|EXPR_|RPAREN|TOKEN_INVALID|LABEL_INVALID|SYMBOL_MODIFIER|UNSUPPORTED|VARIANT_INVALID)/, "sintaxe inválida"],
      ];
      const grupo = grupos.find(([re]) => re.test(code));
      return grupo ? grupo[1] : "erro de montagem (" + code + ")";
    }

    // Acha a primeira linha recusada pelo montador: monta prefixos do fonte
    // (busca binária) com os rótulos ainda não vistos no fim.
    locateError(lines) {
      const clean = lines.map((line) =>
        line.replace(/@.*$/, "").replace(/\/\/.*$/, ""),
      );
      const names = clean.map((line) => {
        const found = [];
        let rest = line.trim();
        let match;
        while ((match = /^([A-Za-z_.$][\w.$]*|\d+)\s*:\s*/.exec(rest))) {
          found.push(match[1]);
          rest = rest.slice(match[0].length);
        }
        const definition =
          /^\.(?:equ|equiv|set)\s+([A-Za-z_.$][\w.$]*)\s*,/i.exec(rest) ||
          /^([A-Za-z_.$][\w.$]*)\s*=/.exec(rest);
        if (definition) found.push(definition[1]);
        return found;
      });
      const fails = (count) => {
        const defined = new Set(names.slice(0, count).flat());
        const later = [...new Set(names.slice(count).flat())].filter(
          (name) => !defined.has(name),
        );
        const text = clean
          .slice(0, count)
          .concat(later.map((name) => name + ":"))
          .join("\n");
        return this._montar(text).failed;
      };
      if (!fails(clean.length)) return null;
      // O Keystone repete no console a linha do erro de fixup.
      const eco = this._falha && this._falha.linha;
      const achada = eco ? clean.indexOf(eco) : -1;
      if (achada >= 0) return { index: achada, message: this._falha.message };
      let low = 0;
      let high = clean.length;
      while (high - low > 1) {
        const middle = (low + high) >> 1;
        if (fails(middle)) high = middle;
        else low = middle;
      }
      if (!fails(high)) return null;
      return { index: high - 1, message: this._assemblerMessage() };
    }

    loadBinary(bytes) {
      if (!bytes.length || bytes.length > this.device.flashSize)
        throw Error("Binário vazio ou maior que a Flash selecionada.");
      this.code = new Uint8Array(bytes);
      this.listing = this.decoder
        .disasm(bytes, this.device.flashBase)
        .map((instruction) => ({
          address: Number(instruction.address),
          size: instruction.size,
          bytes: instruction.bytes,
          mnemonic: instruction.mnemonic,
          op: instruction.op_str,
        }));
      this.byAddr = new Map(
        this.listing.map((instruction) => [instruction.address, instruction]),
      );
      this.breakpoints.clear();
      this.reset();
      return this.listing;
    }

    log(text) {
      this.events.unshift({ t: this.t, text });
      if (this.events.length > 150) this.events.pop();
    }

    _findPort(address) {
      for (let index = 0; index < this.device.ports.length; index++) {
        const definition = this.device.ports[index];
        for (const base of [definition.base, ...definition.aliases]) {
          if (address >= base && address < base + this.gpioWindowSize) {
            return {
              index,
              definition,
              port: this.ports[index],
              base,
              offset: address - base,
            };
          }
        }
      }
      return null;
    }

    pinMode(index, bit) {
      const definition = this.device.ports[index];
      if (!definition || !(definition.mask & (1 << bit))) return 4;
      const port = this.ports[index];
      if (this.device.gpioKind === "stm32f1") {
        const config =
          ((bit < 8 ? port.crl : port.crh) >>> ((bit % 8) * 4)) & 15;
        const mode = config & 3;
        const cnf = config >>> 2;
        if (!mode) return cnf === 0 ? 3 : 0;
        return cnf >= 2 ? 2 : 1;
      }
      if (this.device.gpioKind === "tiva") {
        if (port.amsel & (1 << bit) || !(port.den & (1 << bit))) return 3;
        if (port.afsel & (1 << bit)) return 2;
        return port.dir & (1 << bit) ? 1 : 0;
      }
      return (port.moder >>> (2 * bit)) & 3;
    }

    _registerAt(offset) {
      return GPIO_REGISTERS[this.device.gpioKind].find(
        (register) => register.offset === offset,
      );
    }

    onWrite(address, size, value) {
      if (size > 4) {
        this.onWrite(address, 4, BigInt(value) & 0xffffffffn);
        this.onWrite(address + 4, size - 4, BigInt(value) >> 32n);
        return;
      }
      if (this.nvic.owns(address)) {
        this.nvic.write(address, size, Number(value));
        return;
      }
      const clock = this.device.clockControl;
      if (
        clock &&
        clock.kind === "tiva" &&
        address >= clock.base + 0x600 &&
        address < clock.base + 0x700
      ) {
        // Tiva: RCGCx em +0x600, PRx em +0xA00; o periférico fica pronto na hora.
        const bytes = new Uint8Array(size);
        for (let i = 0; i < size; i++)
          bytes[i] = Number((BigInt(value) >> BigInt(8 * i)) & 255n);
        this.e.mem_write(address + 0x400, bytes);
        return;
      }
      const uart = this.device.uart;
      if (address >= uart.base && address < uart.base + 0x1000)
        this.linha.ativa = true;
      if (address === uart.base + uart.dataOffset) {
        const byte = Number(BigInt(value) & 255n);
        this.tx += String.fromCharCode(byte);
        this.tx = this.tx.slice(-16000);
        this.log("UART TX 0x" + hex(byte, 2));
        this._quadroTx(byte);
        this._registerCache.delete(address);
        return;
      }
      const match = this._findPort(address);
      if (!match) return;
      const { port, definition, offset } = match;
      const aligned = offset & ~3;
      const shift = (offset & 3) * 8;
      const laneMask = (size >= 4 ? 0xffffffff : 2 ** (size * 8) - 1) >>> 0;
      const bits = (Number(BigInt(value) & 0xffffffffn) << shift) >>> 0;
      const writeMask = (laneMask << shift) >>> 0;
      this._registerCache.delete(match.base + aligned);
      if (this.device.gpioKind === "tiva" && aligned < 0x400) {
        const mask = (aligned >>> 2) & 255 & definition.mask & writeMask;
        port.odr = ((port.odr & ~mask) | (bits & mask)) & definition.mask;
        return;
      }
      const register = this._registerAt(aligned);
      if (!register || register.access === "RO") return;
      if (register.field === "bsrr") {
        port.odr =
          ((port.odr & ~(bits >>> 16)) | (bits & 0xffff)) & definition.mask;
      } else if (register.field === "brr") {
        port.odr &= ~(bits & definition.mask);
      } else {
        port[register.field] =
          ((port[register.field] & ~writeMask) | (bits & writeMask)) >>> 0;
        if (register.field === "odr") port.odr &= definition.mask;
        if (this.device.gpioKind === "tiva" && register.field !== "pctl")
          port[register.field] &= definition.mask;
        // Tiva: ligar o pull-up desliga o pull-down do mesmo pino e vice-versa.
        if (register.field === "pur") port.pdr &= ~port.pur;
        if (register.field === "pdr") port.pur &= ~port.pdr;
      }
    }

    _writeCached(address, value) {
      value >>>= 0;
      if (this._registerCache.get(address) !== value) {
        this.put(address, value);
        this._registerCache.set(address, value);
      }
    }

    // TX com um byte no registrador de deslocamento e um esperando (sem FIFO):
    // cheio = TXE 0 (STM32) / TXFF 1 (Tiva); ocupado = TC 0 / BUSY 1.
    _uartStatus() {
      const linha = this.linha;
      const cheio = linha.tx.some((q) => q.inicio > this.t);
      const ocupado = this.t < linha.fimTx;
      const rx = this.rx.length > 0;
      if (this.device.uart.kind === "tiva")
        return (cheio ? 0x20 : 0x80) | (ocupado ? 0x08 : 0) | (rx ? 0 : 0x10);
      return (cheio ? 0 : 0x80) | (ocupado ? 0 : 0x40) | (rx ? 0x20 : 0);
    }

    // Byte escrito no DR: entra na fila do TX. Escrever com o byte anterior
    // ainda esperando o substitui, como no chip.
    _quadroTx(byte) {
      const linha = this.linha;
      linha.tx = linha.tx.filter((q) => q.inicio + QUADRO > this.t);
      const esperando = linha.tx.find((q) => q.inicio > this.t);
      if (esperando) {
        esperando.byte = byte;
        return;
      }
      // A amostra do passo atual já foi tirada: o start bit sai no próximo.
      const inicio = Math.max(this.t + 1, linha.fimTx);
      linha.tx.push({ inicio, byte });
      linha.fimTx = inicio + QUADRO;
    }

    // Nível da linha agora: start (0), 8 bits do LSB ao MSB, stop (1); parada = 1.
    _nivelUart(lado) {
      for (const q of this.linha[lado]) {
        const bit = Math.floor((this.t - q.inicio) / PASSOS_BIT);
        if (bit < 0) break;
        if (bit < 10)
          return bit === 0 ? 0 : bit === 9 ? 1 : (q.byte >> (bit - 1)) & 1;
      }
      return 1;
    }

    _refreshRead(address, size, consumeUart) {
      if (this.nvic.owns(address)) {
        this.nvic.refresh(address, size, consumeUart);
        return;
      }
      const clock = this.device.clockControl;
      if (
        clock &&
        clock.kind === "stm32" &&
        address < clock.base + clock.cfgr + 4 &&
        address + size > clock.base
      ) {
        // STM32: RCC_CR bits 1/17/25/27 (RDY) acompanham 0/16/24/26 (ON);
        // RCC_CFGR SWS (bits 3:2) acompanha SW (bits 1:0).
        const read = (at) =>
          new DataView(
            Uint8Array.from(this.e.mem_read(at, 4)).buffer,
          ).getUint32(0, true);
        const cr = read(clock.base);
        const cfgr = read(clock.base + clock.cfgr);
        this.put(clock.base, (cr & ~0x0a020002) | ((cr & 0x05010001) << 1));
        this.put(clock.base + clock.cfgr, (cfgr & ~0xc) | ((cfgr & 3) << 2));
      }
      const uart = this.device.uart;
      if (consumeUart && address < uart.base + 0x1000 && address + size > uart.base)
        this.linha.ativa = true;
      const dataAddress = uart.base + uart.dataOffset;
      if (address <= dataAddress && address + size > dataAddress) {
        const value = this.rx.length
          ? consumeUart
            ? this.rx.shift()
            : this.rx[0]
          : 0;
        this.put(dataAddress, value);
        this._registerCache.delete(dataAddress);
        this.put(uart.base + uart.statusOffset, this._uartStatus());
        this._registerCache.delete(uart.base + uart.statusOffset);
      }
      const statusAddress = uart.base + uart.statusOffset;
      if (address <= statusAddress && address + size > statusAddress) {
        this.put(statusAddress, this._uartStatus());
      }
      for (let a = (address & ~3) >>> 0; a < address + size; a += 4) {
        const match = this._findPort(a >>> 0);
        if (!match) continue;
        if (this.device.gpioKind === "tiva" && match.offset < 0x400) {
          this.put(a >>> 0, match.port.pins & (match.offset >>> 2) & 255);
          continue;
        }
        const register = this._registerAt(match.offset);
        if (register)
          this.put(
            a >>> 0,
            register.access === "WO" ? 0 : match.port[register.field],
          );
      }
    }

    // Nível do resistor de pull de uma entrada: 1, 0 ou null (sem pull).
    pullLevel(index, bit) {
      const port = this.ports[index];
      const mask = 1 << bit;
      if (this.device.gpioKind === "tiva") {
        if (port.pur & mask) return 1;
        return port.pdr & mask ? 0 : null;
      }
      if (this.device.gpioKind === "stm32f1") {
        const config =
          ((bit < 8 ? port.crl : port.crh) >>> ((bit % 8) * 4)) & 15;
        if (config !== 8) return null;
        return port.odr & mask ? 1 : 0;
      }
      const pull = (port.pupdr >>> (2 * bit)) & 3;
      return pull === 1 ? 1 : pull === 2 ? 0 : null;
    }

    sync() {
      const linha = this.linha;
      // RX: o byte fica disponível para o programa no fim do quadro.
      while (linha.rx.length && linha.rx[0].inicio + QUADRO <= this.t)
        this.rx.push(linha.rx.shift().byte);
      const inputs = this.manual.map((value) => value || 0);
      // Pinos com algo ligado (clique, componente, gerador, ligação):
      // valem o nível externo; os outros ficam com o pull do programa.
      const driven = this.driven.map((value) => value || 0);
      const generator = this.generator;
      if (generator.enabled && this.device.ports[generator.port]) {
        const high =
          this.t % generator.period < (generator.period * generator.duty) / 100;
        inputs[generator.port] =
          (inputs[generator.port] & ~(1 << generator.pin)) |
          (high ? 1 << generator.pin : 0);
        driven[generator.port] |= 1 << generator.pin;
      }
      const calculatePins = (index) => {
        const port = this.ports[index];
        let pins = 0;
        let normalizedMode = 0;
        for (let bit = 0; bit < 16; bit++) {
          const mode = this.pinMode(index, bit);
          if (mode < 4) normalizedMode |= mode << (2 * bit);
          if (mode === 1) pins |= port.odr & (1 << bit);
          if (mode === 0) {
            const pull =
              driven[index] & (1 << bit) ? null : this.pullLevel(index, bit);
            if (pull === null) pins |= inputs[index] & (1 << bit);
            else pins |= pull << bit;
          }
        }
        // Depois que a UART é usada, TX/RX mostram a linha serial; um GPIO de
        // saída no mesmo pino ganha, e no RX vale também o que estiver ligado.
        if (linha.ativa)
          for (const u of this.pinosUart) {
            const mask = 1 << u.bit;
            if (u.index !== index || this.pinMode(index, u.bit) === 1) continue;
            if (u.lado === "rx" && driven[index] & mask) continue;
            pins = (pins & ~mask) | (this._nivelUart(u.lado) << u.bit);
          }
        if (this.device.gpioKind !== "stm32f4")
          port.moder = normalizedMode >>> 0;
        port.pins = pins & this.device.ports[index].mask;
        port.idr = port.pins;
      };
      for (let index = 0; index < this.ports.length; index++)
        calculatePins(index);
      const wire = this.wire;
      if (wire.enabled && this.ports[wire.from] && this.ports[wire.to]) {
        const high = (this.ports[wire.from].pins >>> wire.fp) & 1;
        inputs[wire.to] =
          (inputs[wire.to] & ~(1 << wire.tp)) | (high << wire.tp);
        driven[wire.to] |= 1 << wire.tp;
        calculatePins(wire.to);
      }
      for (let index = 0; index < this.ports.length; index++) {
        const port = this.ports[index];
        const definition = this.device.ports[index];
        for (const base of [definition.base, ...definition.aliases]) {
          for (const register of GPIO_REGISTERS[this.device.gpioKind]) {
            this._writeCached(
              base + register.offset,
              register.access === "WO" ? 0 : port[register.field],
            );
          }
        }
      }
      this.nvic.observePins();
      this._writeCached(
        this.device.uart.base + this.device.uart.statusOffset,
        this._uartStatus(),
      );
    }

    getPeripheralRegisters(index) {
      const definition = this.device.ports[index];
      if (!definition) return [];
      return GPIO_REGISTERS[this.device.gpioKind].map((register) => ({
        ...register,
        address: definition.base + register.offset,
        value:
          register.access === "WO"
            ? 0
            : this.ports[index][register.field] >>> 0,
      }));
    }

    writePeripheral(address, value, size = 4) {
      if (!this._findPort(address))
        throw Error("Endereço fora de um GPIO modelado.");
      if (![1, 2, 4].includes(size)) throw Error("Tamanho de acesso inválido.");
      const bytes = new Uint8Array(size);
      for (let i = 0; i < size; i++) bytes[i] = value >>> (8 * i);
      this.e.mem_write(address, bytes);
      this.onWrite(address, size, value >>> 0);
      this.sync();
      this.sample();
      this.log("GPIO: escrita 0x" + hex(value) + " em 0x" + hex(address));
    }

    // Configura os registradores de GPIO modelados. O pull vale para a entrada
    // sem nada ligado; componentes virtuais dirigem o próprio nível de repouso.
    configurePin(index, bit, mode, pull = "none") {
      const definition = this.device.ports[index];
      if (
        !Number.isInteger(index) ||
        !definition ||
        !Number.isInteger(bit) ||
        bit < 0 ||
        bit > 15 ||
        !(definition.mask & (1 << bit))
      )
        throw Error("Pino não disponível neste encapsulamento.");
      if (!Number.isInteger(mode) || mode < 0 || mode > 3)
        throw Error("Modo GPIO inválido: use entrada, saída, AF ou analógico.");
      if (!["none", "up", "down"].includes(pull))
        throw Error("Pull inválido: use none, up ou down.");
      const port = this.ports[index];
      const mask = 1 << bit;
      const write = (offset, value) =>
        this.writePeripheral(definition.base + offset, value >>> 0);
      const bitValue = (field, on) => (port[field] & ~mask) | (on ? mask : 0);
      if (this.device.gpioKind === "stm32f1") {
        const shift = (bit % 8) * 4;
        const field = bit < 8 ? "crl" : "crh";
        const config =
          mode === 0 ? (pull === "none" ? 4 : 8) : [0, 2, 10, 0][mode];
        // In F1 input-pull mode, ODR selects pull-up (1) or pull-down (0).
        if (mode === 0 && pull !== "none")
          write(0x10, pull === "up" ? mask : mask << 16);
        write(
          bit < 8 ? 0x00 : 0x04,
          (port[field] & ~(15 << shift)) | (config << shift),
        );
      } else if (this.device.gpioKind === "stm32f4") {
        const shift = bit * 2;
        const pullBits = { none: 0, up: 1, down: 2 }[pull];
        write(0x0c, (port.pupdr & ~(3 << shift)) | (pullBits << shift));
        write(0x00, (port.moder & ~(3 << shift)) | (mode << shift));
      } else {
        write(0x510, bitValue("pur", pull === "up"));
        write(0x514, bitValue("pdr", pull === "down"));
        write(0x400, bitValue("dir", mode === 1));
        write(0x420, bitValue("afsel", mode === 2));
        write(0x528, bitValue("amsel", mode === 3));
        write(0x51c, bitValue("den", mode !== 3));
      }
      return this.pinMode(index, bit);
    }

    setPinOutput(index, bit, high) {
      const definition = this.device.ports[index];
      if (
        !Number.isInteger(index) ||
        !definition ||
        !Number.isInteger(bit) ||
        bit < 0 ||
        bit > 15 ||
        !(definition.mask & (1 << bit))
      )
        throw Error("Pino não disponível neste encapsulamento.");
      if (this.pinMode(index, bit) !== 1)
        throw Error("Configure o pino como saída antes de alterar seu nível.");
      if (![true, false, 0, 1].includes(high))
        throw Error("Nível digital inválido: use 0 ou 1.");
      const mask = 1 << bit;
      if (this.device.gpioKind === "tiva") {
        // Tiva DATA masked-address aperture changes only the selected latch bit.
        this.writePeripheral(definition.base + (mask << 2), high ? mask : 0);
      } else {
        const offset = this.device.gpioKind === "stm32f1" ? 0x10 : 0x18;
        this.writePeripheral(
          definition.base + offset,
          (high ? mask : mask << 16) >>> 0,
        );
      }
    }

    sample() {
      const sample = { t: this.t, v: this.ports.map((port) => port.pins) };
      if (this.trace.length && this.trace.at(-1).t === this.t)
        this.trace[this.trace.length - 1] = sample;
      else this.trace.push(sample);
      if (this.trace.length > 20000) this.trace.splice(0, 2000);
    }

    step() {
      if (!this.code) throw Error("Monte um programa primeiro");
      if (this.halted && this.breakpointPause) {
        this.halted = false;
        this.breakpointPause = false;
      }
      if (this.halted) return false;
      this.lastStepEvent = null;
      this.sync();
      if (this.nvic.dispatch()) {
        this.t++;
        this.nvic.tick();
        this.sample();
        return true;
      }
      if (this.halted) return false;
      const pc = this.reg("PC"),
        start = this.device.flashBase,
        end = start + this.code.length;
      if (pc === end) {
        this.halted = true;
        this.stopReason = "Fim do programa";
        return false;
      }
      if (pc < start || pc >= end) {
        this.halted = true;
        this.stopReason = "PC fora do programa: 0x" + hex(pc);
        return false;
      }
      if (this.nvic.interceptReturn(pc)) {
        this.t++;
        this.nvic.tick();
        this.sync();
        this.sample();
        return true;
      }
      const bytes = this.e.mem_read(pc, 2),
        opcode = bytes[0] | (bytes[1] << 8);
      const softwareTrap = (trap, at) => {
        if ((trap & 0xff00) === 0xbe00) {
          this.setReg("PC", (at + 2) | 1);
          this.halted = true;
          this.breakpointPause = true;
          this.stopReason =
            "Breakpoint BKPT #" +
            (trap & 255) +
            " em 0x" +
            hex(at) +
            ". Execução pausada; Executar continua após o BKPT.";
          this.lastStepEvent = {
            type: "breakpoint",
            pc: at,
            immediate: trap & 255,
          };
          return true;
        }
        if ((trap & 0xff00) === 0xdf00) {
          this.setReg("PC", (at + 2) | 1);
          this.nvic.setPending(-5);
          if (this.nvic.candidate() !== 11) {
            this.nvic.clearPending(-5);
            this.nvic.setPending(-13);
          }
          this.lastStepEvent = {
            type: "svc",
            pc: at,
            exception: 11,
            irq: -5,
            immediate: trap & 255,
          };
          return true;
        }
        return false;
      };
      this._engineException = null;
      try {
        if (!softwareTrap(opcode, pc)) this.e.emu_start(pc | 1, end, 0, 1);
        if (this._engineException) {
          const event = this._engineException;
          let handled = false;
          for (const at of [event.pc, event.pc - 2]) {
            if (at < start || at + 2 > end) continue;
            const b = this.e.mem_read(at, 2),
              op = b[0] | (b[1] << 8);
            if (
              (event.number === 7 && (op & 0xff00) === 0xbe00) ||
              (event.number === 2 && (op & 0xff00) === 0xdf00)
            ) {
              handled = softwareTrap(op, at);
              break;
            }
          }
          if (!handled) {
            this.halted = true;
            this.stopReason = this._faultText(event);
          }
        }
      } catch (error) {
        this.halted = true;
        const instruction = this.byAddr.get(pc);
        this.stopReason = String(error).includes("UC_ERR_INSN_INVALID")
          ? "Instrução " +
            (instruction ? instruction.mnemonic + " " : "") +
            "em 0x" +
            hex(pc) +
            " não existe no " +
            this.device.core +
            (this.model === 8
              ? " (instruções DSP e de ponto flutuante só no Cortex-M4)."
              : ".") +
            " Na placa isso gera UsageFault."
          : "Falha em 0x" + hex(pc) + ": " + String(error);
        throw Error(this.stopReason);
      }
      this.t++;
      this.nvic.tick();
      this.sync();
      this.sample();
      return !this.halted;
    }

    _faultText(event) {
      const at = " em 0x" + hex(event.pc) + ": ";
      if (event.number === 17)
        return (
          "UsageFault NOCP" +
          at +
          "instrução de ponto flutuante, mas " +
          (this.model === 8
            ? "o " + this.device.core + " não tem FPU."
            : "a FPU está desligada (CPACR).")
        );
      if (event.number === 1)
        return (
          "UsageFault UNDEFINSTR" +
          at +
          "instrução não definida para o " +
          this.device.core +
          "."
        );
      if (event.number === 18)
        return (
          "UsageFault INVSTATE" +
          at +
          "desvio para endereço sem o bit 0 (estado Thumb)."
        );
      return (
        "Exceção do motor Unicorn (código " +
        event.number +
        ") não traduzida em exceção ARM. PC 0x" +
        hex(event.pc) +
        "."
      );
    }

    input(index, bit, high) {
      const definition = this.device.ports[index];
      if (!definition || !(definition.mask & (1 << bit)))
        throw Error("Pino não disponível neste encapsulamento.");
      this.manual[index] =
        (this.manual[index] & ~(1 << bit)) | (high ? 1 << bit : 0);
      this.driven[index] |= 1 << bit;
      this.sync();
      this.sample();
      this.log("P" + definition.name + bit + " entrada = " + Number(high));
    }

    // Mantém o nível manual atual como externo (componente ligado no pino).
    hold(index, bit) {
      if (!this.device.ports[index] || this.driven[index] & (1 << bit)) return;
      this.driven[index] |= 1 << bit;
      this.sync();
      this.sample();
    }

    // Solta o pino: sem nada ligado ele volta ao pull configurado (ou 0).
    release(index, bit) {
      const definition = this.device.ports[index];
      if (!definition || !(definition.mask & (1 << bit))) return;
      this.manual[index] &= ~(1 << bit);
      this.driven[index] &= ~(1 << bit);
      this.sync();
      this.sample();
      this.log("P" + definition.name + bit + " solto");
    }

    // Texto do Terminal: os bytes chegam pelo RX um quadro depois do outro.
    serial(text) {
      const linha = this.linha;
      linha.ativa = true;
      for (const byte of new TextEncoder().encode(text)) {
        const inicio = Math.max(this.t, linha.fimRx);
        linha.rx.push({ inicio, byte });
        linha.fimRx = inicio + QUADRO;
      }
      this.sync();
      this.sample();
      this.log("UART RX: " + JSON.stringify(text));
    }

    // Bytes do Terminal ainda não lidos pelo programa (na linha ou no DR).
    get rxPendente() {
      return this.rx.length + this.linha.rx.length;
    }

    registers() {
      const result = {};
      const names = [
        ...Array.from({ length: 13 }, (_, index) => "R" + index),
        "SP",
        "LR",
        "PC",
        "MSP",
        "PSP",
        "XPSR",
        "CONTROL",
        "PRIMASK",
        "BASEPRI",
        "FAULTMASK",
        "IPSR",
        "FPSCR",
      ];
      for (const name of names) result[name] = this.reg(name);
      return result;
    }

    memory(address, size = 128) {
      this._refreshRead(address, size, false);
      return Array.from(this.e.mem_read(address, size));
    }

    editMemory(address, value) {
      const region = this.getMemoryRegions().find(
        (candidate) =>
          candidate.kind === "ram" &&
          address >= candidate.base &&
          address < candidate.base + candidate.size,
      );
      if (!region) throw Error("Edição disponível apenas nas regiões de RAM.");
      this.e.mem_write(address, new Uint8Array([value & 255]));
    }
  }

  root.LabSimulador = LabSimulador;
  root.LAB = {
    FLASH,
    RAM,
    GPIO,
    UART,
    hex,
    PASSOS_BIT,
    printErr: (texto) => saidaMontador.push(String(texto)),
  };
  if (typeof module !== "undefined")
    module.exports = { LabSimulador, LAB: root.LAB };
})(typeof globalThis !== "undefined" ? globalThis : this);
