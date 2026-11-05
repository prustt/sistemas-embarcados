/* Depurador ICDI das placas Tiva (EK-TM4C1294XL, EK-TM4C123GXL) via WebUSB. GPL-2.0-or-later.
   Fala o protocolo remoto do GDB pela interface 2 do ICDI, como o lm4flash e o driver ti_icdi do OpenOCD. */
(function (root) {
  "use strict";
  const VID = 0x1cbe,
    PID = 0x00fd,
    IFACE = 2,
    EP_OUT = 2,
    EP_IN = 3;
  const DHCSR = 0xe000edf0,
    FP_CTRL = 0xe0002000,
    DID0 = 0x400fe000,
    DID1 = 0x400fe004,
    ROMCTL = 0x400fe0f0,
    FMA = 0x400fd000;
  const enc = new TextEncoder();
  const text = (bytes) => String.fromCharCode(...bytes);
  const hex8 = (n) => (n >>> 0).toString(16).padStart(8, "0");
  const toHex = (bytes) =>
    [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  const fromHex = (s) =>
    Uint8Array.from(s.match(/../g) || [], (h) => parseInt(h, 16));

  function concat(parts) {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let pos = 0;
    for (const p of parts) {
      out.set(p, pos);
      pos += p.length;
    }
    return out;
  }
  // Bytes binários dentro de um pacote: '#', '$', '}' e '*' viram '}' + (byte ^ 0x20).
  function escape(bytes) {
    const out = [];
    for (const b of bytes) {
      if (b === 0x23 || b === 0x24 || b === 0x7d || b === 0x2a)
        out.push(0x7d, b ^ 0x20);
      else out.push(b);
    }
    return Uint8Array.from(out);
  }
  function unescape(bytes) {
    const out = [];
    for (let i = 0; i < bytes.length; i++)
      out.push(bytes[i] === 0x7d ? bytes[++i] ^ 0x20 : bytes[i]);
    return Uint8Array.from(out);
  }
  function timeout(promise, ms, what) {
    let id;
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        id = setTimeout(
          () => reject(new Error("A placa não respondeu (" + what + ").")),
          ms,
        );
      }),
    ]).finally(() => clearTimeout(id));
  }

  class LabICDI {
    constructor(device) {
      this.device = device;
      this.queue = Promise.resolve();
      this.maxPacket = 2048;
      this.version = "";
      this.broken = false;
    }
    static get filters() {
      return [{ vendorId: VID, productId: PID }];
    }
    static async request(usb = navigator.usb) {
      return new LabICDI(
        await usb.requestDevice({ filters: LabICDI.filters }),
      );
    }
    static async known(usb = navigator.usb) {
      const device = (await usb.getDevices()).find(
        (d) => d.vendorId === VID && d.productId === PID,
      );
      return device ? new LabICDI(device) : null;
    }
    get name() {
      return this.device.productName + " · " + this.device.serialNumber;
    }

    async open() {
      const d = this.device;
      if (!d.opened) await d.open();
      if (!d.configuration) await d.selectConfiguration(1);
      await d.claimInterface(IFACE);
      this.broken = false;
      this.version = text(fromHex(await this.monitor("version"))).trim();
      const supported = await this.command("qSupported");
      const size = /PacketSize=([0-9a-f]+)/i.exec(supported);
      if (size) this.maxPacket = parseInt(size[1], 16);
      await this.command("!");
      return this;
    }
    // Fecha o dispositivo só se a serial USB (placa-cdc.js) não estiver usando outra interface dele.
    async close() {
      const d = this.device;
      try {
        await d.releaseInterface(IFACE);
      } catch {}
      try {
        if (d.opened && !d.configuration?.interfaces.some((i) => i.claimed)) await d.close();
      } catch {}
    }

    // Um pacote por vez: a interface do monitor e a gravação podem pedir ao mesmo tempo.
    _exclusive(fn) {
      const run = this.queue.then(fn, fn);
      this.queue = run.catch(() => {});
      return run;
    }
    async _transact(body, ms) {
      if (this.broken)
        throw new Error("Conexão com a placa perdida. Conecte de novo.");
      let sum = 0;
      for (const b of body) sum = (sum + b) & 255;
      const frame = concat([
        enc.encode("$"),
        body,
        enc.encode("#" + sum.toString(16).padStart(2, "0")),
      ]);
      try {
        for (let attempt = 0; ; attempt++) {
          await timeout(this.device.transferOut(EP_OUT, frame), ms, "envio");
          let all = await this._read(ms);
          while (!all.length) all = await this._read(ms);
          if (all[0] === 0x2d && attempt < 3) continue; // '-': reenviar
          // Resposta completa: '+' de confirmação e depois $dados#cc.
          while (all.length < 4 || all[all.length - 3] !== 0x23)
            all = concat([all, await this._read(ms)]);
          return all.subarray(all.indexOf(0x24) + 1, all.length - 3);
        }
      } catch (error) {
        this.broken = true;
        throw error;
      }
    }
    async _read(ms) {
      const result = await timeout(
        this.device.transferIn(EP_IN, Math.max(this.maxPacket, 512)),
        ms,
        "resposta",
      );
      if (result.status !== "ok")
        throw new Error("Falha na leitura USB: " + result.status);
      return new Uint8Array(result.data.buffer, result.data.byteOffset, result.data.byteLength);
    }
    _check(payload, what) {
      const s = text(payload.subarray(0, 3));
      if (s[0] === "E" && /^E[0-9a-f]{2}$/i.test(s))
        throw new Error(what + " falhou na placa (" + s + ").");
      return payload;
    }

    async command(body, ms = 3000) {
      const bytes = typeof body === "string" ? enc.encode(body) : body;
      return text(
        this._check(
          await this._exclusive(() => this._transact(bytes, ms)),
          typeof body === "string" ? body : "comando",
        ),
      );
    }
    monitor(cmd, ms = 3000) {
      const bytes = typeof cmd === "string" ? enc.encode(cmd) : cmd;
      return this.command("qRcmd," + toHex(bytes), ms);
    }

    get maxRw() {
      return Math.floor((this.maxPacket - 64) / 4 / 2) * 4;
    }
    async readMemory(address, length) {
      const parts = [];
      for (let done = 0; done < length; ) {
        const n = Math.min(this.maxRw, length - done);
        const payload = await this._exclusive(() =>
          this._transact(
            enc.encode("x" + (address + done).toString(16) + "," + n.toString(16)),
            3000,
          ),
        );
        if (text(payload.subarray(0, 3)) !== "OK:")
          this._check(payload, "Leitura de 0x" + hex8(address + done));
        const data = unescape(payload.subarray(3));
        if (data.length !== n)
          throw new Error("Leitura incompleta em 0x" + hex8(address + done));
        parts.push(data);
        done += n;
      }
      return concat(parts);
    }
    async writeMemory(address, bytes) {
      for (let done = 0; done < bytes.length; ) {
        const n = Math.min(this.maxRw, bytes.length - done);
        const body = concat([
          enc.encode("X" + (address + done).toString(16) + "," + n.toString(16) + ":"),
          escape(bytes.subarray(done, done + n)),
        ]);
        this._check(
          await this._exclusive(() => this._transact(body, 3000)),
          "Escrita em 0x" + hex8(address + done),
        );
        done += n;
      }
    }
    async read32(address) {
      const b = await this.readMemory(address, 4);
      return (b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)) >>> 0;
    }
    write32(address, value) {
      const b = new Uint8Array(4);
      new DataView(b.buffer).setUint32(0, value >>> 0, true);
      return this.writeMemory(address, b);
    }

    async state() {
      const dhcsr = await this.read32(DHCSR);
      return {
        dhcsr,
        halted: !!(dhcsr & (1 << 17)),
        sleeping: !!(dhcsr & (1 << 18)),
        lockup: !!(dhcsr & (1 << 19)),
        debug: !!(dhcsr & 1),
      };
    }
    halt() {
      return this.command("?");
    }
    resume() {
      return this.command("c");
    }
    step() {
      return this.command("s");
    }
    // Número do registrador como no DCRSR: 0-15 = R0..PC, 16 = xPSR, 17 = MSP, 18 = PSP.
    async readRegister(n) {
      const reply = await this.command("p" + n.toString(16));
      const b = fromHex(reply.slice(0, 8));
      return (b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)) >>> 0;
    }
    async readRegisters() {
      const names = ["R0", "R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8",
        "R9", "R10", "R11", "R12", "SP", "LR", "PC", "xPSR", "MSP", "PSP"];
      const regs = {};
      for (let i = 0; i < names.length; i++)
        regs[names[i]] = await this.readRegister(i);
      return regs;
    }
    // Reinicia o chip e deixa o programa rodando (sequência do lm4flash).
    // Depois do "debug disable" a placa responde E07 a alguns desses passos; o
    // lm4flash ignora essas respostas, então aqui também só a perda da USB é erro.
    async reset() {
      const step = (fn) =>
        fn().catch((error) => {
          if (this.broken) throw error;
        });
      await step(() => this.write32(FP_CTRL, 0x3000000));
      await step(() => this.monitor("set vectorcatch 0"));
      await step(() => this.monitor("debug disable"));
      await step(() => this.monitor("debug hreset"));
      await step(() => this.monitor("set vectorcatch 0"));
      await step(() => this.monitor("debug disable"));
      // Religa o acesso de depuração (como na conexão) para o monitor continuar lendo a memória.
      await this.command("qSupported");
      await this.command("!");
    }

    async identify() {
      return { did0: await this.read32(DID0), did1: await this.read32(DID1) };
    }

    // Grava a imagem na Flash a partir de base, confere lendo de volta e reinicia a placa.
    async flash(image, base = 0, onProgress = () => {}) {
      const block = 512;
      onProgress("Preparando a placa", 0);
      await this.monitor(enc.encode("debug clock \0"));
      await this.command("qSupported");
      await this.halt();
      await this.write32(FP_CTRL, 0x3000000);
      const id = await this.identify();
      await this.monitor("debug sreset");
      await this.write32(ROMCTL, 0);
      await this.write32(FMA, 0);
      const sector = 16 * 1024;
      const length = Math.ceil(image.length / sector) * sector;
      onProgress("Apagando " + length / 1024 + " KiB", 0.05);
      await this.command("vFlashErase:" + hex8(base) + "," + hex8(length), 30000);
      await this.monitor("debug creset");
      await this.write32(ROMCTL, 0);
      for (let done = 0; done < image.length; done += block) {
        const chunk = image.subarray(done, done + block);
        const body = concat([
          enc.encode("vFlashWrite:" + hex8(base + done) + ":"),
          escape(chunk),
        ]);
        this._check(
          await this._exclusive(() => this._transact(body, 5000)),
          "Gravação em 0x" + hex8(base + done),
        );
        onProgress("Gravando", 0.1 + (0.7 * (done + chunk.length)) / image.length);
      }
      onProgress("Conferindo", 0.85);
      const back = await this.readMemory(base, image.length);
      const bad = back.findIndex((b, i) => b !== image[i]);
      if (bad >= 0)
        throw new Error(
          "A conferência falhou em 0x" + hex8(base + bad) + ": a Flash não ficou igual ao programa.",
        );
      onProgress("Reiniciando", 0.95);
      await this.reset();
      onProgress("Gravado e rodando", 1);
      return { bytes: image.length, erased: length, ...id };
    }
  }
  LabICDI.VID = VID;
  LabICDI.PID = PID;
  root.LabICDI = LabICDI;
})(typeof globalThis !== "undefined" ? globalThis : window);
