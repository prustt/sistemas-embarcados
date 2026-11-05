/* Aba Placa: gravar e monitorar a placa real (ICDI via WebUSB; serial por Web Serial ou, sem ela, direto pela USB). GPL-2.0-or-later. */
(function (root) {
  "use strict";
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const h8 = (n) => (n >>> 0).toString(16).toUpperCase().padStart(8, "0");
  const RCGCGPIO = 0x400fe608;
  // Classe do DID0 (bits 23:16): 0x05 = TM4C123, 0x0A = TM4C129.
  const DEVICE_CLASS = { tm4c123gh6pm: 0x05, tm4c1294ncpdt: 0x0a };
  const BOARD = {
    tm4c1294ncpdt: {
      name: "EK-TM4C1294XL",
      pins: [
        { label: "D1", port: "N", bit: 1, kind: "led" },
        { label: "D2", port: "N", bit: 0, kind: "led" },
        { label: "D3", port: "F", bit: 4, kind: "led" },
        { label: "D4", port: "F", bit: 0, kind: "led" },
        { label: "SW1", port: "J", bit: 0, kind: "button" },
        { label: "SW2", port: "J", bit: 1, kind: "button" },
      ],
    },
    tm4c123gh6pm: {
      name: "EK-TM4C123GXL",
      pins: [
        { label: "Vermelho", port: "F", bit: 1, kind: "led" },
        { label: "Azul", port: "F", bit: 2, kind: "led" },
        { label: "Verde", port: "F", bit: 3, kind: "led" },
        { label: "SW1", port: "F", bit: 4, kind: "button" },
        { label: "SW2", port: "F", bit: 0, kind: "button" },
      ],
    },
  };
  const REGS = ["R0", "R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9",
    "R10", "R11", "R12", "SP", "LR", "PC", "xPSR"];

  class LabPlacaPanel {
    constructor(host, lab, callbacks = {}) {
      this.host = host;
      this.lab = lab;
      this.callbacks = callbacks;
      this.icdi = null;
      this.port = null;
      this.monitoring = false;
      this.regs = null;
      this.watches = [];
      this.build();
      this.configureDevice();
      if (root.navigator?.usb)
        navigator.usb.addEventListener("disconnect", (e) => {
          if (this.port instanceof LabCdcSerial && e.device === this.port.device) {
            this.port = null;
            this.update();
          }
          if (this.icdi && e.device === this.icdi.device) this._lost();
        });
    }
    get supported() {
      return DEVICE_CLASS[this.lab.device.id] !== undefined;
    }
    // Dentro de um iframe sem permissão o navegador bloqueia a USB.
    get usbAllowed() {
      const policy = root.document?.featurePolicy;
      return !!root.navigator?.usb && (!policy || policy.allowsFeature("usb"));
    }
    _button(text, fn, cls = "") {
      const b = el("button", cls, text);
      b.type = "button";
      b.onclick = async () => {
        b.disabled = true;
        try {
          await fn();
        } catch (error) {
          this._error(error);
        } finally {
          b.disabled = false;
          this.update();
        }
      };
      return b;
    }
    _message(text, error = false) {
      this.message.textContent = text;
      this.message.classList.toggle("error", error);
    }
    _error(error) {
      if (error?.name === "NotFoundError") return this._message("Nenhum dispositivo escolhido.");
      if (error?.name === "SecurityError" && !this.usbAllowed)
        return this._message(
          "O navegador bloqueou o acesso à USB porque a página está dentro de outro site: abra https://prustt.github.io/sistemas-embarcados/ direto no Chrome ou Edge.",
          true,
        );
      if (error?.name === "SecurityError")
        return this._message(
          "O sistema não deu permissão para usar a placa (" + error.message + "). Veja a aba Instalação: no Linux falta a regra do udev; no Windows, o driver da TI.",
          true,
        );
      this._message(error?.message || String(error), true);
    }

    build() {
      const head = el("div", "workbench-heading");
      const text = el("div");
      this.title = el("h2", "", "Gravar e monitorar");
      text.append(
        el("div", "eyebrow", "PLACA REAL / DEPURADOR ICDI"),
        this.title,
        el(
          "p",
          "",
          "Ligue a placa pela USB DEBUG e use o Chrome ou o Edge, no computador ou no Android (cabo OTG). O Build para a placa coloca uma tabela de vetores no início da Flash e o seu código em 0x400; " +
            "rótulos com nomes de handler (SysTick_Handler, GPIOJ_Handler…) entram na tabela.",
        ),
      );
      this.badge = el("span", "workbench-badge placa-badge", "Desconectada");
      head.append(text, this.badge);

      const conn = el("div", "placa-row");
      this.connectBtn = this._button("Conectar placa", () => this.connect(), "primary");
      this.disconnectBtn = this._button("Desconectar", () => this.disconnect());
      this.info = el("span", "placa-info");
      conn.append(this.connectBtn, this.disconnectBtn, this.info);

      const flash = el("div", "placa-row");
      this.flashBtn = this._button("⚡ Build e gravar", () => this.flash(), "primary");
      this.progress = el("progress", "placa-progress");
      this.progress.max = 1;
      this.progress.value = 0;
      this.imageInfo = el("span", "placa-info");
      flash.append(this.flashBtn, this.progress, this.imageInfo);

      const run = el("div", "placa-row");
      this.runBtns = [
        this._button("↺ Reset", () => this._run(() => this.icdi.reset(), "Placa reiniciada.")),
        this._button("❚❚ Parar", () => this._run(() => this.icdi.halt(), "Programa parado.")),
        this._button("▶ Continuar", () => this._run(() => this.icdi.resume(), "Programa rodando.")),
        this._button("↦ Passo", () => this._run(() => this.icdi.step(), "Uma instrução executada.")),
      ];
      this.monitorBtn = this._button("Monitorar ao vivo", () => this.toggleMonitor());
      this.state = el("span", "placa-state", "—");
      run.append(...this.runBtns, this.monitorBtn, this.state);

      this.message = el("div", "placa-status");
      this.message.setAttribute("role", "status");

      const grid = el("div", "placa-grid");
      const live = el("section", "placa-card");
      live.append(el("h3", "", "Pinos da placa"));
      this.pins = el("div", "placa-pins");
      this.ports = el("div", "placa-ports");
      live.append(this.pins, this.ports);

      const cpu = el("section", "placa-card");
      cpu.append(el("h3", "", "CPU e memória"));
      this.regTable = el("div", "placa-regs");
      const watchForm = el("form", "placa-watch-form");
      this.watchInput = el("input");
      this.watchInput.id = "placaWatchInput";
      this.watchInput.placeholder = "Endereço ou símbolo (ex.: 0x20000000, GPIOA)";
      watchForm.append(this.watchInput, el("button", "", "Observar"));
      watchForm.onsubmit = (e) => {
        e.preventDefault();
        try {
          this.addWatch(this.watchInput.value);
          this.watchInput.value = "";
        } catch (error) {
          this._error(error);
        }
      };
      this.watchList = el("div", "placa-watches");
      cpu.append(this.regTable, watchForm, this.watchList);

      const serial = el("section", "placa-card placa-serial");
      const sh = el("div", "placa-serial-head");
      sh.append(el("h3", "", "Serial (UART0 · porta virtual do ICDI)"));
      this.baud = el("select");
      this.baud.id = "placaBaud";
      for (const b of [9600, 19200, 38400, 57600, 115200]) {
        const o = el("option", "", b + " bps");
        o.value = b;
        o.selected = b === 115200;
        this.baud.append(o);
      }
      this.serialBtn = this._button("Abrir serial", () => this.toggleSerial());
      sh.append(this.baud, this.serialBtn, this._button("Limpar", () => (this.terminal.textContent = "")));
      this.terminal = el("pre", "placa-terminal");
      const send = el("form", "placa-send");
      this.sendInput = el("input");
      this.sendInput.id = "placaSendInput";
      this.sendInput.placeholder = "Texto para enviar à placa";
      this.ending = el("select");
      this.ending.id = "placaEnding";
      for (const [v, t] of [["\r\n", "CR + LF"], ["\n", "LF"], ["", "Sem final"]]) {
        const o = el("option", "", t);
        o.value = v;
        this.ending.append(o);
      }
      send.append(this.sendInput, this.ending, el("button", "", "Enviar"));
      send.onsubmit = (e) => {
        e.preventDefault();
        this.sendSerial(this.sendInput.value + this.ending.value).catch((error) => this._error(error));
        this.sendInput.value = "";
      };
      serial.append(sh, this.terminal, send);

      grid.append(live, cpu, serial);
      this.host.append(head, conn, flash, run, this.message, grid);
    }

    configureDevice() {
      const board = BOARD[this.lab.device.id];
      this.title.textContent = board ? "Gravar e monitorar · " + board.name : "Gravar e monitorar";
      if (!root.navigator?.usb)
        this._message(
          "Este navegador não tem WebUSB (Safari e Firefox não têm). Abra esta página no Chrome ou no Edge (computador ou Android) para gravar e monitorar a placa.",
          true,
        );
      else if (!this.supported)
        this._message(
          "Por enquanto a gravação funciona só nas placas Tiva com depurador ICDI (EK-TM4C1294XL e EK-TM4C123GXL). Selecione um desses micros no topo.",
        );
      else if (!this.usbAllowed)
        this._message(
          "Esta página está dentro de outro site que bloqueia a USB. Para gravar, abra https://prustt.github.io/sistemas-embarcados/ direto no Chrome ou Edge.",
          true,
        );
      else this._message("");
      this.renderPins(null);
      this.update();
    }
    update() {
      const on = !!this.icdi;
      this.connectBtn.hidden = on;
      this.disconnectBtn.hidden = !on;
      this.connectBtn.disabled = !this.supported || !this.usbAllowed;
      this.flashBtn.disabled = !on || !this.supported;
      for (const b of this.runBtns) b.disabled = !on;
      this.monitorBtn.disabled = !on;
      this.monitorBtn.classList.toggle("active", this.monitoring);
      this.monitorBtn.textContent = this.monitoring ? "Parar monitor" : "Monitorar ao vivo";
      this.serialBtn.textContent = this.port ? "Fechar serial" : "Abrir serial";
      this.serialBtn.disabled = !this.serialMode;
      this.badge.textContent = on ? "Conectada" : "Desconectada";
      this.badge.classList.toggle("off", !on);
    }

    async connect() {
      this.icdi = (await LabICDI.known()) || (await LabICDI.request());
      try {
        await this.icdi.open();
        const id = await this.icdi.identify();
        const cls = (id.did0 >>> 16) & 0xff;
        const names = { 0x05: "TM4C123", 0x0a: "TM4C129" };
        this.info.textContent =
          "ICDI " + this.icdi.device.serialNumber + " · firmware " + this.icdi.version +
          " · " + (names[cls] || "classe 0x" + cls.toString(16)) + " (DID0 0x" + h8(id.did0) + ")";
        this.deviceClass = cls;
        this._message("Placa conectada.");
      } catch (error) {
        await this.icdi.close();
        this.icdi = null;
        if (error?.name !== "SecurityError")
          error.message = (error.message || String(error)) + " Se é a primeira vez neste computador, veja a aba Instalação.";
        throw error;
      }
      this.update();
      this.toggleMonitor(true);
    }
    async disconnect() {
      this.monitoring = false;
      const icdi = this.icdi;
      this.icdi = null;
      this.regs = null;
      await icdi?.close();
      this.info.textContent = "";
      this.state.textContent = "—";
      this._message("Placa desconectada.");
    }
    _lost() {
      this.monitoring = false;
      this.icdi = null;
      this.info.textContent = "";
      this.state.textContent = "—";
      this._message("A placa foi desconectada da USB.", true);
      this.update();
    }
    async _run(fn, done) {
      await fn();
      this.regs = null;
      this._message(done);
      if (!this.monitoring) await this.refresh();
    }

    async flash() {
      const want = DEVICE_CLASS[this.lab.device.id];
      if (this.deviceClass !== undefined && this.deviceClass !== want)
        throw new Error(
          "A placa conectada não é " + this.lab.device.name + ". Troque o micro selecionado no topo ou conecte a placa certa.",
        );
      const result = this.callbacks.build();
      // O monitor não pode ler a placa no meio da gravação.
      this.monitoring = false;
      while (this.looping) await new Promise((r) => setTimeout(r, 20));
      this.imageInfo.textContent =
        result.image.length + " bytes · vetores em 0x" + h8(result.base) + " · código em 0x" + h8(result.codeBase);
      const t0 = performance.now();
      try {
        await this.icdi.flash(result.image, result.base, (msg, p) => {
          this.progress.value = p;
          this._message(msg + "…");
        });
      } finally {
        this.progress.value = 0;
      }
      this.regs = null;
      this._message(
        "Gravado, conferido e rodando: " + result.image.length + " bytes em " + Math.round(performance.now() - t0) + " ms.",
      );
      this.toggleMonitor(true);
    }

    toggleMonitor(force) {
      this.monitoring = force === undefined ? !this.monitoring : force;
      this.update();
      if (this.monitoring && !this.looping) this._loop();
    }
    async _loop() {
      this.looping = true;
      try {
        while (this.monitoring && this.icdi) {
          await this.refresh();
          await new Promise((r) => setTimeout(r, 200));
        }
      } catch (error) {
        this.monitoring = false;
        this._error(error);
      } finally {
        this.looping = false;
        this.update();
      }
    }
    async refresh() {
      if (!this.icdi) return;
      const st = await this.icdi.state();
      let pc = null;
      if (st.halted) {
        if (!this.regs) this.regs = await this.icdi.readRegisters();
        pc = this.regs.PC;
      } else this.regs = null;
      this.state.textContent = st.halted
        ? pc === 0x3fc
          ? "Parado num handler padrão (exceção sem tratamento)"
          : "Parado em 0x" + h8(pc)
        : st.lockup
          ? "Travado (lockup)"
          : st.sleeping
            ? "Rodando (dormindo, WFI)"
            : "Rodando";
      this.state.className = "placa-state " + (st.halted ? "halted" : "running");
      const enabled = await this.icdi.read32(RCGCGPIO);
      const ports = [];
      this.lab.device.ports.forEach((p, i) => {
        if (enabled & (1 << i)) ports.push(p);
      });
      const values = {};
      for (const p of ports) {
        values[p.name] = {
          data: await this.icdi.read32(p.base + 0x3fc),
          dir: await this.icdi.read32(p.base + 0x400),
        };
      }
      for (const w of this.watches) {
        try {
          w.value = await this.icdi.read32(w.address);
          w.error = "";
        } catch (error) {
          w.error = error.message;
        }
      }
      this.renderPins(values);
      this.renderPorts(ports, values);
      this.renderRegs();
      this.renderWatches();
    }
    renderPins(values) {
      const board = BOARD[this.lab.device.id];
      this.pins.replaceChildren();
      if (!board) return;
      for (const pin of board.pins) {
        const v = values?.[pin.port];
        const level = v ? (v.data >> pin.bit) & 1 : null;
        const on = pin.kind === "button" ? level === 0 : level === 1;
        const item = el("div", "placa-pin " + pin.kind + (on ? " on" : ""));
        item.title = "P" + pin.port + pin.bit + (pin.kind === "button" ? " · ativo em 0" : " · ativo em 1");
        item.append(
          el("span", "dot"),
          el("strong", "", pin.label),
          el("small", "", "P" + pin.port + pin.bit + (level === null ? " · sem clock" : " = " + level)),
        );
        this.pins.append(item);
      }
    }
    renderPorts(ports, values) {
      this.ports.replaceChildren();
      if (!ports.length) {
        this.ports.append(el("p", "placa-empty", "Nenhuma porta GPIO com clock ligado (RCGCGPIO = 0)."));
        return;
      }
      for (const p of ports) {
        const row = el("div", "placa-port");
        row.append(el("strong", "", "GPIO " + p.name));
        const bits = el("div", "placa-bits");
        for (let b = 7; b >= 0; b--) {
          if (!p.pins.includes(b)) {
            bits.append(el("span", "bit none", "·"));
            continue;
          }
          const level = (values[p.name].data >> b) & 1;
          const out = (values[p.name].dir >> b) & 1;
          const s = el("span", "bit" + (level ? " high" : "") + (out ? " out" : ""), String(level));
          s.title = "P" + p.name + b + (out ? " saída" : " entrada");
          bits.append(s);
        }
        row.append(bits, el("small", "", "DATA 0x" + h8(values[p.name].data).slice(6) + " · DIR 0x" + h8(values[p.name].dir).slice(6)));
        this.ports.append(row);
      }
    }
    renderRegs() {
      this.regTable.replaceChildren();
      if (!this.regs) {
        this.regTable.append(el("p", "placa-empty", "Registradores aparecem quando o programa está parado (❚❚ Parar)."));
        return;
      }
      for (const name of REGS) {
        const item = el("div", "placa-reg");
        item.append(el("span", "", name), el("code", "", h8(this.regs[name])));
        this.regTable.append(item);
      }
    }
    addWatch(expr) {
      expr = expr.trim();
      if (!expr) return;
      const address = /^(0x)?[0-9a-f]+$/i.test(expr)
        ? parseInt(expr.replace(/^0x/i, ""), 16)
        : this.callbacks.resolve?.(expr);
      if (!Number.isFinite(address)) throw new Error("Não encontrei o endereço de " + expr + ".");
      this.watches.push({ expr, address: address >>> 0, value: null, error: "" });
      this.renderWatches();
    }
    renderWatches() {
      this.watchList.replaceChildren();
      this.watches.forEach((w, i) => {
        const row = el("div", "placa-watch");
        const remove = el("button", "", "✕");
        remove.type = "button";
        remove.title = "Parar de observar";
        remove.onclick = () => {
          this.watches.splice(i, 1);
          this.renderWatches();
        };
        row.append(
          el("span", "", w.expr),
          el("small", "", "0x" + h8(w.address)),
          el("code", w.error ? "error" : "", w.error ? "erro" : w.value === null ? "—" : "0x" + h8(w.value)),
          remove,
        );
        this.watchList.append(row);
      });
    }

    // Web Serial no computador; no Chrome do Android (sem Web Serial) a serial vai direto pela USB.
    get serialMode() {
      const policy = root.document?.featurePolicy;
      if (root.navigator?.serial && (!policy || policy.allowsFeature("serial"))) return "webserial";
      if (this.supported && this.usbAllowed) return "usb";
      return null;
    }
    _appendTerminal(text) {
      this.terminal.textContent = (this.terminal.textContent + text).slice(-20000);
      this.terminal.scrollTop = this.terminal.scrollHeight;
    }

    async toggleSerial() {
      if (this.port) return this.closeSerial();
      if (this.serialMode === "usb") return this._openUsbSerial();
      const filters = [{ usbVendorId: LabICDI.VID, usbProductId: LabICDI.PID }];
      const known = (await navigator.serial.getPorts()).find((p) => {
        const info = p.getInfo();
        return info.usbVendorId === LabICDI.VID && info.usbProductId === LabICDI.PID;
      });
      const port = known || (await navigator.serial.requestPort({ filters }));
      await port.open({ baudRate: Number(this.baud.value) });
      this.port = port;
      this.update();
      this._message("Serial aberta a " + this.baud.value + " bps.");
      this.readLoop = this._readSerial();
    }
    async _readSerial() {
      const decoder = new TextDecoder();
      while (this.port?.readable) {
        this.reader = this.port.readable.getReader();
        try {
          for (;;) {
            const { value, done } = await this.reader.read();
            if (done) break;
            this._appendTerminal(decoder.decode(value, { stream: true }));
          }
        } catch (error) {
          if (this.port) this._error(error);
        } finally {
          this.reader.releaseLock();
          this.reader = null;
        }
      }
    }
    async _openUsbSerial() {
      const cdc = (await LabCdcSerial.known(LabICDI.filters)) || (await LabCdcSerial.request(LabICDI.filters));
      await cdc.open(Number(this.baud.value));
      this.port = cdc;
      this.update();
      this._message("Serial aberta a " + this.baud.value + " bps (direto pela USB).");
      this.readLoop = this._readUsbSerial(cdc);
    }
    async _readUsbSerial(cdc) {
      const decoder = new TextDecoder();
      while (this.port === cdc) {
        try {
          this._appendTerminal(decoder.decode(await cdc.read(), { stream: true }));
        } catch (error) {
          if (this.port === cdc) this._error(error);
          break;
        }
      }
    }
    async closeSerial() {
      const port = this.port;
      this.port = null;
      if (port instanceof LabCdcSerial) {
        // soltar a interface encerra a leitura pendente
        await port.close();
        await this.readLoop;
      } else {
        // A porta só fecha depois que o laço de leitura soltar o reader.
        await this.reader?.cancel().catch(() => {});
        await this.readLoop;
        await port.close();
      }
      this._message("Serial fechada.");
    }
    async sendSerial(textToSend) {
      if (this.port instanceof LabCdcSerial) return this.port.write(new TextEncoder().encode(textToSend));
      if (!this.port?.writable) throw new Error("Abra a serial primeiro.");
      const writer = this.port.writable.getWriter();
      try {
        await writer.write(new TextEncoder().encode(textToSend));
      } finally {
        writer.releaseLock();
      }
    }

    serialize() {
      return null;
    }
    render() {}
    afterReset() {}
  }
  root.LabPlacaPanel = LabPlacaPanel;
})(typeof globalThis !== "undefined" ? globalThis : window);
