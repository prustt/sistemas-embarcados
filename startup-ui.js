/* Aba Startup: arquivos de inicialização de cada micro. GPL-2.0-or-later. */
(function (root) {
  "use strict";
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const SYNTAX = { gnu: "GNU · GCC", keil: "Keil · ARMASM" };

  class LabStartupPanel {
    constructor(host, lab, callbacks = {}) {
      this.host = host;
      this.lab = lab;
      this.callbacks = callbacks;
      this.data = root.LabStartups || {};
      this.deviceId = Object.keys(this.data)[0];
      this.syntax = "gnu";
      this.build();
      this.configureDevice();
    }
    _button(text, fn) {
      const b = el("button", "", text);
      b.type = "button";
      b.onclick = () => {
        try {
          fn();
        } catch (error) {
          this._message(error.message || String(error), true);
        }
      };
      return b;
    }
    _message(text, error = false) {
      this.message.textContent = text;
      this.message.classList.toggle("error", error);
    }
    build() {
      const head = el("div", "workbench-heading");
      const text = el("div");
      text.append(
        el("div", "eyebrow", "STARTUP / TABELA DE VETORES"),
        el("h2", "", "Arquivos de inicialização"),
        el(
          "p",
          "",
          "Tabela de vetores, Reset_Handler e handlers fracos de cada micro, em GNU (GCC) e Keil (ARMASM). " +
            "ST: arquivos oficiais do CMSIS. TI: montados a partir do TivaWare 2.2.0.295 (inc/hw_ints.h). " +
            "O simulador começa a executar na base da Flash e não lê a tabela de vetores: use estes arquivos no GCC ou no Keil.",
        ),
      );
      this.badge = el("span", "workbench-badge");
      head.append(text, this.badge);

      const bar = el("div", "startup-bar");
      this.devices = el("div", "segmented startup-devices");
      for (const [id, item] of Object.entries(this.data)) {
        const b = this._button(item.device, () => this.show(id));
        b.dataset.device = id;
        this.devices.append(b);
      }
      this.syntaxes = el("div", "segmented");
      for (const [key, label] of Object.entries(SYNTAX)) {
        const b = this._button(label, () => {
          this.syntax = key;
          this.show(this.deviceId);
        });
        b.dataset.syntax = key;
        this.syntaxes.append(b);
      }
      bar.append(this.devices, this.syntaxes);

      const file = el("div", "startup-file");
      const name = el("div");
      this.fileName = el("strong");
      this.fileInfo = el("span");
      name.append(this.fileName, this.fileInfo);
      const actions = el("div", "startup-actions");
      actions.append(
        this._button("Copiar", () => this.copy()),
        this._button("↓ Arquivo", () =>
          this.callbacks.download?.(this.current.name, this.current.source),
        ),
        this._button("↓ Todos (.zip)", () => this.downloadAll()),
        this._button("＋ Adicionar ao projeto", () => {
          this.callbacks.addFile?.(this.current.name, this.current.source);
          this._message(
            this.current.name +
              " adicionado ao projeto. Ele só entra no Build se for a Entrada ou estiver num .include.",
          );
        }),
      );
      file.append(name, actions);

      this.code = el("pre", "startup-code");
      this.code.tabIndex = 0;
      this.message = el("div", "startup-status");
      this.message.setAttribute("role", "status");
      this.host.append(head, bar, file, this.code, this.message);
    }
    get current() {
      return this.data[this.deviceId][this.syntax];
    }
    configureDevice() {
      const id = this.lab?.device?.id;
      this.show(this.data[id] ? id : this.deviceId);
    }
    show(id) {
      if (!this.data[id]) return;
      this.deviceId = id;
      const item = this.data[id],
        file = this.current;
      for (const b of this.devices.children)
        b.classList.toggle("active", b.dataset.device === id);
      for (const b of this.syntaxes.children)
        b.classList.toggle("active", b.dataset.syntax === this.syntax);
      this.badge.textContent = item.origin;
      this.fileName.textContent = file.name;
      this.fileInfo.textContent =
        file.vectors +
        " vetores · " +
        file.source.split("\n").length +
        " linhas";
      this.code.textContent = file.source;
      this.code.scrollTop = 0;
      this._message("");
    }
    copy() {
      const source = this.current.source;
      const select = () => {
        const range = document.createRange();
        range.selectNodeContents(this.code);
        getSelection().removeAllRanges();
        getSelection().addRange(range);
        this._message("Texto selecionado. Use Cmd+C / Ctrl+C para copiar.");
      };
      if (!navigator.clipboard?.writeText) return select();
      navigator.clipboard
        .writeText(source)
        .then(() => this._message(this.current.name + " copiado."), select);
    }
    downloadAll() {
      const entries = [];
      for (const item of Object.values(this.data))
        for (const key of Object.keys(SYNTAX))
          entries.push({ name: item[key].name, data: item[key].source });
      for (const license of root.LabStartupLicenses || [])
        entries.push({ name: license.name, data: license.source });
      this.callbacks.downloadZip?.("startups-elf74.zip", entries);
    }
    serialize() {
      return null;
    }
    render() {}
    afterReset() {}
  }
  root.LabStartupPanel = LabStartupPanel;
})(typeof globalThis !== "undefined" ? globalThis : window);
