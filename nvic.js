/* NVIC/SCB/SysTick model — GPL-2.0-or-later.
 * ARMv7-M basic exception frames; virtual time is emulator steps, not cycles.
 * References: ARM DUI0553A ch.2.3,4.2–4.4; CMSIS NVIC documentation.
 */
(function (root) {
  "use strict";
  const BASE = 0xe000e000,
    SIZE = 0x2000,
    IRQ_COUNT = 240;
  const SYSTEM = {
    2: "NMI",
    3: "HardFault",
    4: "MemManage",
    5: "BusFault",
    6: "UsageFault",
    11: "SVC",
    12: "DebugMonitor",
    14: "PendSV",
    15: "SysTick",
  };
  const RETURNS = new Set([0xfffffff1, 0xfffffff9, 0xfffffffd]);
  const hex = (n) => (n >>> 0).toString(16).toUpperCase().padStart(8, "0");
  class LabNVIC {
    constructor(lab) {
      this.lab = lab;
      this.reset();
    }
    reset() {
      this.irqCount = IRQ_COUNT;
      this.priorityBits = this.lab.device.gpioKind === "tiva" ? 3 : 4;
      this.priorityMask = (255 << (8 - this.priorityBits)) & 255;
      this.enabled = new Uint8Array(256);
      this.pending = new Uint8Array(256);
      this.priorities = new Uint8Array(256);
      for (const e of [2, 3, 11, 12, 14, 15]) this.enabled[e] = 1;
      this.handlers = new Map();
      this.frames = [];
      this.events = [];
      this.vtor = this.lab.device.flashBase;
      this.grouping = 0;
      this.ccr = 0x200;
      this.scr = 0;
      this.shcsr = 0;
      this.route = null;
      this.systick = {
        reload: 0,
        current: 0,
        enabled: false,
        interrupt: false,
        clockSource: 1,
        countFlag: false,
        divider: 0,
      };
      this.lastEvent = null;
      this.scsDirty = true;
    }
    owns(address) {
      return address >= BASE && address < BASE + SIZE;
    }
    exception(irq) {
      if (!Number.isInteger(irq)) throw Error("IRQ deve ser um inteiro CMSIS.");
      const e = irq + 16;
      if (e < 16 ? !SYSTEM[e] : irq < 0 || irq >= IRQ_COUNT)
        throw Error(
          "IRQ inválida: use 0–239, SVC −5, PendSV −2 ou SysTick −1.",
        );
      return e;
    }
    name(e) {
      return SYSTEM[e] || "IRQ " + (e - 16);
    }
    enable(irq, enabled = true) {
      const e = this.exception(irq);
      if (e === 2 || e === 3 || e === 11 || e === 14 || e === 15) {
        if (!enabled)
          throw Error(
            "Esta exceção não usa ISER/ICER; use sua fonte ou máscara de prioridade.",
          );
      }
      this.enabled[e] = Number(!!enabled);
      this.scsDirty = true;
    }
    disable(irq) {
      this.enable(irq, false);
    }
    setPending(irq, pending = true) {
      const e = this.exception(irq);
      this.pending[e] = Number(!!pending);
      this.scsDirty = true;
    }
    request(irq) {
      this.setPending(irq);
    }
    clearPending(irq) {
      this.setPending(irq, false);
    }
    setPriority(irq, priority) {
      const e = this.exception(irq);
      if (e === 2 || e === 3)
        throw Error("NMI e HardFault têm prioridade fixa.");
      if (!Number.isInteger(priority) || priority < 0 || priority > 255)
        throw Error("Prioridade: byte de 0 a 255.");
      this.priorities[e] = priority & this.priorityMask;
      this.scsDirty = true;
      return this.priorities[e];
    }
    setHandler(irq, address) {
      const e = this.exception(irq);
      if (address === null || address === undefined || address === "")
        this.handlers.delete(e);
      else {
        if (!Number.isInteger(address) || address < 0 || address > 0xffffffff)
          throw Error("Endereço de handler inválido.");
        this.handlers.set(e, (address | 1) >>> 0);
      }
    }
    setVTOR(address) {
      if (
        !Number.isInteger(address) ||
        address < 0 ||
        address > 0xffffffff ||
        address & 127
      )
        throw Error("VTOR deve ser alinhado a 128 bytes.");
      this.vtor = address >>> 0;
      this.scsDirty = true;
    }
    setGrouping(value) {
      if (!Number.isInteger(value) || value < 0 || value > 7)
        throw Error("PRIGROUP deve estar entre 0 e 7.");
      this.grouping = value;
    }
    configureSysTick(config = {}) {
      const s = this.systick;
      if (config.reload !== undefined) {
        if (
          !Number.isInteger(config.reload) ||
          config.reload < 0 ||
          config.reload > 0xffffff
        )
          throw Error("SysTick LOAD: 0 a 0xFFFFFF.");
        s.reload = config.reload;
        s.current = 0;
        s.countFlag = false;
        s.divider = 0;
      }
      for (const key of ["enabled", "interrupt"])
        if (config[key] !== undefined) s[key] = !!config[key];
      if (config.clockSource !== undefined) {
        if (![0, 1].includes(config.clockSource))
          throw Error("Fonte SysTick: 0 ou 1.");
        s.clockSource = config.clockSource;
        s.divider = 0;
      }
      this.scsDirty = true;
    }
    setGpioRoute(route) {
      if (!route || route.enabled === false) {
        this.route = null;
        return;
      }
      const { port, irq } = route,
        pin = route.pin ?? route.bit,
        edge = route.edge || "rise";
      const p = this.lab.device.ports[port];
      if (
        !Number.isInteger(port) ||
        !p ||
        !Number.isInteger(pin) ||
        !(p.mask & (1 << pin)) ||
        pin < 0 ||
        pin > 15
      )
        throw Error("Pino de IRQ virtual inválido.");
      if (irq < 0) this.exception(240);
      else this.exception(irq);
      if (!["rise", "fall", "both"].includes(edge))
        throw Error("Borda inválida.");
      this.route = {
        port,
        pin,
        bit: pin,
        irq,
        edge,
        enabled: true,
        last: (this.lab.ports[port].pins >>> pin) & 1,
      };
    }
    setRoute(route) {
      this.setGpioRoute(route);
    }
    clearGpioRoute() {
      this.route = null;
    }
    clearRoute() {
      this.route = null;
    }
    observePins() {
      const r = this.route;
      if (!r || !this.lab.ports[r.port]) return;
      const value = (this.lab.ports[r.port].pins >>> r.pin) & 1;
      if (
        value !== r.last &&
        (r.edge === "both" ||
          (r.edge === "rise" && value) ||
          (r.edge === "fall" && !value))
      ) {
        this.setPending(r.irq);
        this.record("pending", r.irq + 16, {
          text:
            "Borda GPIO virtual P" + this.lab.device.ports[r.port].name + r.pin,
        });
      }
      r.last = value;
    }
    tick() {
      const s = this.systick;
      if (!s.enabled) return;
      if (!s.clockSource && ++s.divider < 8) return;
      s.divider = 0;
      if (!s.current) s.current = s.reload;
      else if (--s.current === 0) {
        s.countFlag = true;
        if (s.interrupt) this.pending[15] = 1;
      }
    }
    priority(e) {
      return e === 2 ? -2 : e === 3 ? -1 : this.priorities[e];
    }
    groupPriority(e) {
      if (e === 2) return -2;
      if (e === 3) return -1;
      const pre = Math.min(7 - this.grouping, this.priorityBits),
        sub = this.priorityBits - pre;
      return (this.priorities[e] >>> (8 - this.priorityBits)) >>> sub;
    }
    candidate() {
      const lab = this.lab,
        active = this.frames.at(-1)?.exception;
      const current = active ? this.groupPriority(active) : Infinity;
      const primask = lab.reg("PRIMASK") & 1,
        faultmask = lab.reg("FAULTMASK") & 1,
        basepri = lab.reg("BASEPRI") & this.priorityMask;
      let best = null;
      for (let e = 2; e < 256; e++) {
        if (
          !this.pending[e] ||
          !this.enabled[e] ||
          this.frames.some((f) => f.exception === e)
        )
          continue;
        if (e < 16 && !SYSTEM[e]) continue;
        if (e !== 2 && faultmask) continue;
        if (e > 3 && primask) continue;
        if (e > 3 && basepri && this.priorities[e] >= basepri) continue;
        if (this.groupPriority(e) >= current) continue;
        if (
          best === null ||
          this.priority(e) < this.priority(best) ||
          (this.priority(e) === this.priority(best) && e < best)
        )
          best = e;
      }
      return best;
    }
    vector(e) {
      if (this.handlers.has(e)) return this.handlers.get(e);
      try {
        const b = this.lab.e.mem_read((this.vtor + e * 4) >>> 0, 4);
        return new DataView(Uint8Array.from(b).buffer).getUint32(0, true);
      } catch {
        return 0;
      }
    }
    record(type, exception, extra = {}) {
      const event = {
        step: this.lab.t,
        type,
        exception,
        irq: exception - 16,
        name: this.name(exception),
        ...extra,
      };
      this.events.unshift(event);
      if (this.events.length > 200) this.events.pop();
      this.lastEvent = event;
      this.lab.log(
        "NVIC " +
          type +
          " · " +
          event.name +
          (extra.text ? " · " + extra.text : ""),
      );
      return event;
    }
    dispatch() {
      const e = this.candidate();
      if (e === null) return false;
      const lab = this.lab,
        handler = this.vector(e),
        target = (handler & 0xfffffffe) >>> 0;
      if (
        !(handler & 1) ||
        target < lab.device.flashBase ||
        target >= lab.device.flashBase + (lab.code?.length || 0)
      ) {
        lab.halted = true;
        lab.stopReason =
          this.name(e) +
          " pendente sem handler Thumb válido. Configure o handler no painel NVIC ou a tabela VTOR.";
        this.record("unhandled", e);
        return false;
      }
      if (lab.reg("CONTROL") & 4) {
        lab.halted = true;
        lab.stopReason =
          "Exceção com contexto FPU ativo: empilhamento estendido não modelado. Desative FPCA para usar quadro básico.";
        this.record("unsupported-frame", e);
        return false;
      }
      const previous = this.frames.at(-1)?.exception || 0;
      const usePSP = !previous && !!(lab.reg("CONTROL") & 2);
      const stack = usePSP ? "PSP" : "MSP",
        sp = lab.reg(stack),
        align = !!(this.ccr & 0x200) && !!(sp & 4),
        newSP = (sp - 32 - (align ? 4 : 0)) >>> 0;
      const regions = lab.getMemoryRegions().filter((r) => r.kind === "ram");
      if (
        !regions.some((r) => newSP >= r.base && newSP + 32 <= r.base + r.size)
      )
        throw Error("NVIC: empilhamento fora da SRAM.");
      const savedXPSR =
        ((lab.reg("XPSR") & ~0x200) | (align ? 0x200 : 0)) >>> 0;
      const values = ["R0", "R1", "R2", "R3", "R12", "LR", "PC"].map((r) =>
        lab.reg(r),
      );
      values.push(savedXPSR);
      values.forEach((v, i) => lab.put(newSP + i * 4, v));
      const excReturn = previous
        ? 0xfffffff1
        : usePSP
          ? 0xfffffffd
          : 0xfffffff9;
      this.frames.push({
        exception: e,
        previous,
        stack,
        sp: newSP,
        excReturn,
        returnAddress: values[6],
      });
      this.pending[e] = 0;
      lab.setReg(stack, newSP);
      lab.setReg("IPSR", e);
      lab.setReg(
        "XPSR",
        ((lab.reg("XPSR") & 0xf8000000) | 0x01000000 | e) >>> 0,
      );
      lab.setReg("LR", excReturn);
      lab.setReg("PC", handler);
      lab.lastStepEvent = this.record("exception-entry", e, {
        handler: target,
        sp: newSP,
        returnAddress: values[6],
      });
      return true;
    }
    returnException(token) {
      token >>>= 0;
      if (!RETURNS.has(token) || !this.frames.length)
        throw Error("EXC_RETURN inválido ou sem exceção ativa.");
      const frame = this.frames.at(-1),
        returnHandler = token === 0xfffffff1;
      if (returnHandler !== !!frame.previous)
        throw Error(
          "EXC_RETURN incompatível com o nível de aninhamento ativo.",
        );
      const lab = this.lab,
        stack = token & 4 ? "PSP" : "MSP",
        sp = lab.reg(stack);
      const bytes = lab.e.mem_read(sp, 32),
        view = new DataView(Uint8Array.from(bytes).buffer),
        values = Array.from({ length: 8 }, (_, i) =>
          view.getUint32(i * 4, true),
        );
      const xpsr = values[7],
        ipsr = xpsr & 0x1ff;
      if (!(xpsr & 0x01000000) || ipsr !== (frame.previous || 0))
        throw Error("Quadro de exceção inválido: xPSR/Thumb/IPSR.");
      const newSP = (sp + 32 + (xpsr & 0x200 ? 4 : 0)) >>> 0;
      ["R0", "R1", "R2", "R3", "R12", "LR"].forEach((r, i) =>
        lab.setReg(r, values[i]),
      );
      lab.setReg(stack, newSP);
      if (!returnHandler)
        lab.setReg("CONTROL", (lab.reg("CONTROL") & ~2) | (token & 4 ? 2 : 0));
      lab.setReg("XPSR", xpsr & ~0x200);
      lab.setReg("IPSR", ipsr);
      lab.setReg("PC", values[6] | 1);
      this.frames.pop();
      if (frame.exception !== 2) lab.setReg("FAULTMASK", 0);
      lab.lastStepEvent = this.record("exception-return", frame.exception, {
        sp: newSP,
        returnAddress: values[6],
      });
      return true;
    }
    interceptReturn(pc) {
      if (!this.frames.length) return false;
      const lab = this.lab,
        ins = lab.byAddr.get(pc);
      if (!ins) return false;
      const mnemonic = ins.mnemonic.toLowerCase().replace(/\.[wn]$/, ""),
        op = ins.op.toLowerCase();
      if (mnemonic === "bx" && /^(?:lr|r\d+)$/.test(op)) {
        const value = lab.reg(op.toUpperCase());
        if (RETURNS.has(value)) return this.returnException(value);
      }
      if (
        (mnemonic === "pop" || (mnemonic === "ldm" && op.startsWith("sp!"))) &&
        /\bpc\b/.test(op)
      ) {
        const regs = op
          .match(/\{([^}]+)\}/)?.[1]
          .split(",")
          .map((s) => s.trim());
        if (!regs) return false;
        const list = [];
        for (const r of regs) {
          const range = /^r(\d+)-r(\d+)$/.exec(r);
          if (range) {
            for (let i = +range[1]; i <= +range[2]; i++) list.push("r" + i);
          } else list.push(r);
        }
        const pcIndex = list.indexOf("pc"),
          sp = lab.reg("SP"),
          value = lab.word(sp + pcIndex * 4);
        if (RETURNS.has(value)) {
          list.forEach((r, i) => {
            if (r !== "pc") lab.setReg(r.toUpperCase(), lab.word(sp + i * 4));
          });
          lab.setReg("SP", (sp + list.length * 4) >>> 0);
          return this.returnException(value);
        }
      }
      if (mnemonic === "ldr" && /^pc,\s*\[sp\]/.test(op)) {
        const value = lab.word(lab.reg("SP"));
        if (RETURNS.has(value)) {
          const post = /\],\s*#(0x[0-9a-f]+|\d+)/.exec(op);
          if (post) lab.setReg("SP", lab.reg("SP") + Number(post[1]));
          return this.returnException(value);
        }
      }
      return false;
    }
    wordValue(address, sideEffects = false) {
      const off = address - BASE;
      if (off === 4) return Math.ceil(IRQ_COUNT / 32) - 1;
      const s = this.systick;
      if (off === 0x10) {
        const v =
          Number(s.enabled) |
          (Number(s.interrupt) << 1) |
          (s.clockSource << 2) |
          (Number(s.countFlag) << 16);
        if (sideEffects) s.countFlag = false;
        return v;
      }
      if (off === 0x14) return s.reload;
      if (off === 0x18) return s.current;
      if (off === 0x1c) return 0x80000000;
      for (const [start, kind] of [
        [0x100, "enabled"],
        [0x180, "enabled"],
        [0x200, "pending"],
        [0x280, "pending"],
        [0x300, "active"],
      ]) {
        if (off >= start && off < start + 32) {
          let v = 0;
          const index = (off - start) * 8;
          for (let b = 0; b < 32; b++) {
            const e = index + b + 16;
            if (
              e < 256 &&
              (kind === "active"
                ? this.frames.some((f) => f.exception === e)
                : this[kind][e])
            )
              v |= 1 << b;
          }
          return v >>> 0;
        }
      }
      if (off >= 0x400 && off < 0x4f0) {
        let v = 0;
        for (let b = 0; b < 4; b++)
          v |= this.priorities[16 + off - 0x400 + b] << (b * 8);
        return v >>> 0;
      }
      if (off === 0xd00) return this.lab.model === 8 ? 0x411fc231 : 0x410fc241;
      if (off === 0xd04) {
        const active = this.frames.at(-1)?.exception || 0,
          best = this.candidate();
        return (
          (active |
            ((best || 0) << 12) |
            (this.frames.length <= 1 ? 1 << 11 : 0) |
            (this.pending.slice(16).some(Boolean) ? 1 << 22 : 0) |
            (this.pending[15] ? 1 << 26 : 0) |
            (this.pending[14] ? 1 << 28 : 0) |
            (this.pending[2] ? 1 << 31 : 0)) >>>
          0
        );
      }
      if (off === 0xd08) return this.vtor;
      if (off === 0xd0c) return 0xfa050000 | (this.grouping << 8);
      if (off === 0xd10) return this.scr;
      if (off === 0xd14) return this.ccr;
      if (off >= 0xd18 && off <= 0xd20) {
        let v = 0;
        for (let b = 0; b < 4; b++)
          v |= this.priorities[off - 0xd18 + 4 + b] << (8 * b);
        return v >>> 0;
      }
      if (off === 0xd24) {
        let v = 0;
        for (const [e, bit] of [
          [4, 0],
          [5, 1],
          [6, 3],
          [11, 7],
          [12, 8],
          [14, 10],
          [15, 11],
        ])
          if (this.frames.some((f) => f.exception === e)) v |= 1 << bit;
        for (const [e, bit] of [
          [6, 12],
          [4, 13],
          [5, 14],
          [11, 15],
        ])
          if (this.pending[e]) v |= 1 << bit;
        for (const [e, bit] of [
          [4, 16],
          [5, 17],
          [6, 18],
        ])
          if (this.enabled[e]) v |= 1 << bit;
        return v >>> 0;
      }
      return 0;
    }
    refresh(address, size, sideEffects = false) {
      for (let a = (address & ~3) >>> 0; a < address + size; a += 4)
        if (this.owns(a)) this.lab.put(a, this.wordValue(a, sideEffects));
    }
    write(address, size, value) {
      const aligned = (address & ~3) >>> 0,
        off = aligned - BASE,
        shift = (address & 3) * 8;
      const mask =
          ((size === 4 ? 0xffffffff : 2 ** (size * 8) - 1) << shift) >>> 0,
        bits = (value << shift) >>> 0;
      const merged = ((this.wordValue(aligned) & ~mask) | (bits & mask)) >>> 0,
        s = this.systick;
      if (off === 0x10) {
        s.enabled = !!(merged & 1);
        s.interrupt = !!(merged & 2);
        s.clockSource = (merged >>> 2) & 1;
        return;
      }
      if (off === 0x14) {
        s.reload = merged & 0xffffff;
        return;
      }
      if (off === 0x18) {
        s.current = 0;
        s.countFlag = false;
        s.divider = 0;
        return;
      }
      for (const [start, kind, set] of [
        [0x100, "enabled", 1],
        [0x180, "enabled", 0],
        [0x200, "pending", 1],
        [0x280, "pending", 0],
      ]) {
        if (off >= start && off < start + 32) {
          const index = (off - start) * 8;
          for (let b = 0; b < 32; b++) {
            const e = index + b + 16;
            if (e < 256 && bits & (1 << b)) this[kind][e] = set;
          }
          return;
        }
      }
      if (off >= 0x400 && off < 0x4f0) {
        for (let b = 0; b < size; b++) {
          const index = address - BASE - 0x400 + b;
          if (index < 240)
            this.priorities[index + 16] =
              (value >>> (b * 8)) & 255 & this.priorityMask;
        }
        return;
      }
      if (off === 0xd04) {
        if (bits & (1 << 31)) this.pending[2] = 1;
        if (bits & (1 << 28)) this.pending[14] = 1;
        if (bits & (1 << 27)) this.pending[14] = 0;
        if (bits & (1 << 26)) this.pending[15] = 1;
        if (bits & (1 << 25)) this.pending[15] = 0;
        return;
      }
      if (off === 0xd08) {
        this.vtor = merged & 0xffffff80;
        return;
      }
      if (off === 0xd0c) {
        if (bits >>> 16 === 0x5fa) {
          this.grouping = (bits >>> 8) & 7;
          if (bits & 4) {
            this.lab.halted = true;
            this.lab.stopReason =
              "SYSRESETREQ solicitado. Use Reset para reiniciar a bancada.";
          }
        }
        return;
      }
      if (off === 0xd10) {
        this.scr = merged;
        return;
      }
      if (off === 0xd14) {
        this.ccr = merged;
        return;
      }
      if (off >= 0xd18 && off <= 0xd20) {
        for (let b = 0; b < size; b++) {
          const e = address - BASE - 0xd18 + b + 4;
          if (SYSTEM[e] && e !== 2 && e !== 3)
            this.priorities[e] = (value >>> (b * 8)) & 255 & this.priorityMask;
        }
        return;
      }
      if (off === 0xd24) {
        for (const [e, bit] of [
          [4, 16],
          [5, 17],
          [6, 18],
        ])
          this.enabled[e] = Number(!!(merged & (1 << bit)));
        return;
      }
      if (off === 0xf00) {
        const irq = bits & 511;
        if (irq < IRQ_COUNT) this.pending[irq + 16] = 1;
      }
    }
    state() {
      const irqs = [
        ...Object.keys(SYSTEM).map(Number),
        ...Array.from({ length: IRQ_COUNT }, (_, i) => i + 16),
      ].map((e) => ({
        irq: e - 16,
        exception: e,
        name: this.name(e),
        enabled: !!this.enabled[e],
        pending: !!this.pending[e],
        active: this.frames.some((f) => f.exception === e),
        priority: this.priority(e),
        handler: this.vector(e),
        source: this.handlers.has(e) ? "manual" : "VTOR",
      }));
      return {
        irqCount: IRQ_COUNT,
        priorityBits: this.priorityBits,
        grouping: this.grouping,
        vtor: this.vtor,
        active: this.frames.at(-1)?.exception || 0,
        depth: this.frames.length,
        systick: { ...this.systick },
        irqs,
        events: [...this.events],
        route: this.route ? { ...this.route } : null,
      };
    }
  }
  root.LabNVIC = LabNVIC;
  if (typeof module !== "undefined") module.exports = { LabNVIC };
})(typeof globalThis !== "undefined" ? globalThis : this);
