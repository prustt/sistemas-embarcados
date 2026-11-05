/* Visual GPIO bench. GPL-2.0-or-later. */
(function (root) {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const MODES = [
    "Entrada",
    "Saída",
    "Função alternativa",
    "Analógico / desligado",
  ];
  const TYPES = { button: "Botão", switch: "Chave", led: "LED" };
  const COLORS = [
    "#39d6b0",
    "#56a9ff",
    "#f0bc65",
    "#bd93ff",
    "#ff8093",
    "#6dd7e7",
  ];
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function svg(tag, attrs = {}, text) {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs))
      node.setAttribute(key, value);
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(text, fn, className = "") {
    const node = el("button", className, text);
    node.type = "button";
    node.onclick = fn;
    return node;
  }
  function select(options, label) {
    const node = el("select");
    node.setAttribute("aria-label", label);
    for (const [value, text] of options) {
      const option = el("option", "", text);
      option.value = value;
      node.append(option);
    }
    return node;
  }
  function field(text, input) {
    const node = el("label", "board-field");
    node.append(el("span", "", text), input);
    return node;
  }
  function pinName(lab, port, bit) {
    return "P" + lab.device.ports[port].name + bit;
  }
  function parsePin(device, name) {
    const match = /^P([A-Z])(\d{1,2})$/.exec(name || "");
    if (!match) return null;
    const port = device.ports.findIndex((p) => p.name === match[1]),
      bit = +match[2];
    if (port < 0 || bit > 15 || !(device.ports[port].mask & (1 << bit)))
      return null;
    return { port, bit, name };
  }
  function freshProfile(device) {
    return {
      selected: device.accessiblePins[0].name,
      pins: {},
      components: [],
    };
  }
  function sanitizedState(input) {
    const out = { version: 1, profiles: {} };
    if (!input || typeof input !== "object" || !input.profiles) return out;
    for (const [id, value] of Object.entries(input.profiles)) {
      const device = Object.hasOwn(root.DEVICES, id) ? root.DEVICES[id] : null;
      if (!device || !value || typeof value !== "object") continue;
      const profile = freshProfile(device);
      if (parsePin(device, value.selected)) profile.selected = value.selected;
      for (const [name, config] of Object.entries(value.pins || {})) {
        if (
          !parsePin(device, name) ||
          !config ||
          ![0, 1, 2, 3].includes(config.mode)
        )
          continue;
        profile.pins[name] = {
          mode: config.mode,
          pull: ["none", "up", "down"].includes(config.pull)
            ? config.pull
            : "none",
          level: config.level ? 1 : 0,
        };
      }
      const occupied = new Set();
      for (const item of (Array.isArray(value.components)
        ? value.components
        : []
      ).slice(0, 6)) {
        if (
          !item ||
          !Object.hasOwn(TYPES, item.type) ||
          !parsePin(device, item.pin)
        )
          continue;
        if (item.type !== "led" && occupied.has(item.pin)) continue;
        if (item.type !== "led") occupied.add(item.pin);
        profile.components.push({
          id: "c" + profile.components.length,
          type: item.type,
          pin: item.pin,
          label: String(item.label || TYPES[item.type]).slice(0, 40),
          activeLow: !!item.activeLow,
          latched: item.type === "switch" && !!item.latched,
        });
      }
      out.profiles[id] = profile;
    }
    return out;
  }

  class LabBoard {
    constructor(host, lab, callbacks = {}) {
      this.host = host;
      this.lab = lab;
      this.callbacks = callbacks;
      this.state = { version: 1, profiles: {} };
      this.pinNodes = new Map();
      this.cardNodes = new Map();
      this.pinPositions = new Map();
      this.pressed = new Set();
      this.nextId = 1;
      this.currentId = null;
      this.zoom = 100;
      this.releaseListener = () => this.releaseAll();
      window.addEventListener("blur", this.releaseListener);
      this.visibilityListener = () => {
        if (document.hidden) this.releaseAll();
      };
      document.addEventListener("visibilitychange", this.visibilityListener);
      this.configureDevice();
    }
    dispose() {
      this.releaseAll();
      window.removeEventListener("blur", this.releaseListener);
      document.removeEventListener("visibilitychange", this.visibilityListener);
    }
    get profile() {
      return this.state.profiles[this.lab.device.id];
    }
    configureDevice() {
      // selectDevice already replaced the core. Do not release old pins into it.
      this.pressed.clear();
      this.currentId = this.lab.device.id;
      if (!this.state.profiles[this.currentId])
        this.state.profiles[this.currentId] = freshProfile(this.lab.device);
      this.lastSelected = null;
      this.build();
      this.render();
    }
    serialize() {
      return sanitizedState(this.state);
    }
    restore(value) {
      this.pressed.clear();
      this.state = sanitizedState(value);
      this.configureDevice();
    }
    afterReset() {
      if (this.currentId !== this.lab.device.id) this.configureDevice();
      this.pressed.clear();
      for (const [name, config] of Object.entries(this.profile.pins)) {
        const pin = parsePin(this.lab.device, name);
        if (!pin) continue;
        this.lab.configurePin(pin.port, pin.bit, config.mode, config.pull);
        if (config.mode === 1)
          this.lab.setPinOutput(pin.port, pin.bit, !!config.level);
      }
      for (const item of this.profile.components)
        if (item.type !== "led") this.drive(item, false);
      this.render();
    }
    safe(fn) {
      return (...args) => {
        try {
          fn(...args);
        } catch (error) {
          this.message(error.message || String(error), true);
        }
      };
    }
    message(text, error = false) {
      if (!this.notice) return;
      this.notice.textContent = text;
      this.notice.classList.toggle("error", error);
    }
    changed(save = true) {
      this.render();
      this.callbacks.onChange?.();
      if (save) this.callbacks.onSave?.();
    }
    allPins() {
      return this.lab.device.accessiblePins.map((p) => [p.name, p.name]);
    }
    build() {
      this.host.replaceChildren();
      this.host.classList.add("board-panel");
      const toolbar = el("div", "board-toolbar");
      const title = el("div");
      title.append(
        el("strong", "", "Chip & componentes"),
        el(
          "span",
          "board-toolbar-sub",
          "Clique em um pino para configurar ou conectar um componente.",
        ),
      );
      const actions = el("div", "board-toolbar-actions");
      actions.append(
        button(
          "Botão + LED",
          this.safe(() => this.demo()),
          "board-demo",
        ),
      );
      const zoom = select(
        [
          [100, "100%"],
          [125, "125%"],
          [150, "150%"],
        ],
        "Zoom do chip",
      );
      zoom.value = this.zoom;
      zoom.onchange = () => {
        this.zoom = +zoom.value;
        this.stage.style.width = `${(1000 * this.zoom) / 100}px`;
      };
      actions.append(field("Zoom", zoom));
      toolbar.append(title, actions);
      this.host.append(toolbar);
      const layout = el("div", "board-layout"),
        work = el("div", "board-work");
      this.viewport = el("div", "board-viewport");
      this.stage = el("div", "board-stage");
      this.stage.style.width = `${(1000 * this.zoom) / 100}px`;
      this.svg = svg("svg", {
        viewBox: "0 0 1000 760",
        "aria-label":
          "Chip " +
          this.lab.device.name +
          ", vista superior. Pinos GPIO selecionáveis.",
        role: "group",
        class: "board-svg",
      });
      this.stage.append(this.svg);
      this.viewport.append(this.stage);
      work.append(this.viewport);
      this.drawChip();
      this.componentsLayer = el("div", "board-components-layer");
      this.stage.append(this.componentsLayer);
      this.legend = el("div", "board-legend");
      for (const [cls, text] of [
        ["input", "Entrada"],
        ["output", "Saída"],
        ["high", "Nível 1"],
        ["inactive", "AF / analógico"],
        ["power", "Alimentação / controle"],
      ]) {
        const item = el("span", cls);
        item.append(el("i"), document.createTextNode(text));
        this.legend.append(item);
      }
      work.append(this.legend);
      this.notice = el(
        "p",
        "board-notice",
        "Adicione um botão, uma chave ou um LED ao pino selecionado. Os sinais aparecem também no analisador lógico.",
      );
      this.notice.setAttribute("role", "status");
      work.append(this.notice);
      this.inspector = el("aside", "board-inspector");
      this.buildInspector();
      layout.append(work, this.inspector);
      this.host.append(layout);
      this.rebuildCards();
    }
    drawChip() {
      const d = this.lab.device,
        source = root.LabPinouts?.[d.id];
      let pins;
      this.physical = !!(
        source &&
        Array.isArray(source.pins) &&
        source.pins.length
      );
      if (this.physical) pins = source.pins;
      else
        pins = d.accessiblePins.map((p) => ({
          name: p.name,
          port: d.ports[p.port].name,
          bit: p.bit,
          kind: "gpio",
        }));
      this.packagePins = pins;
      this.pinNodes.clear();
      this.pinPositions.clear();
      this.svg.append(
        svg("rect", {
          x: 1,
          y: 1,
          width: 998,
          height: 758,
          rx: 18,
          class: "pcb-background",
        }),
      );
      const pattern = svg("pattern", {
        id: "board-grid",
        width: 20,
        height: 20,
        patternUnits: "userSpaceOnUse",
      });
      pattern.append(svg("circle", { cx: 1, cy: 1, r: 0.8, fill: "#294257" }));
      const defs = svg("defs");
      defs.append(pattern);
      this.svg.append(defs);
      this.svg.append(
        svg("rect", {
          x: 1,
          y: 1,
          width: 998,
          height: 758,
          rx: 18,
          fill: "url(#board-grid)",
        }),
      );
      const left = 310,
        top = 185,
        size = 380,
        perSide = Math.ceil(pins.length / 4);
      this.connectionGroup = svg("g", {
        class: "board-connections",
        "aria-hidden": "true",
      });
      this.svg.append(this.connectionGroup);
      this.svg.append(
        svg("rect", {
          x: left - 4,
          y: top - 4,
          width: size + 8,
          height: size + 8,
          rx: 15,
          class: "chip-shadow",
        }),
      );
      this.svg.append(
        svg("rect", {
          x: left,
          y: top,
          width: size,
          height: size,
          rx: 12,
          class: "chip-body",
        }),
      );
      this.svg.append(
        svg("path", {
          d: `M ${left + 21} ${top + 2} L ${left + size - 20} ${top + 2} L ${left + size - 2} ${top + 20}`,
          class: "chip-bevel",
        }),
      );
      this.svg.append(
        svg("circle", {
          cx: left + 28,
          cy: top + 28,
          r: 7,
          class: "chip-marker",
        }),
      );
      this.svg.append(
        svg(
          "text",
          { x: 500, y: 310, "text-anchor": "middle", class: "chip-vendor" },
          d.vendor === "Texas Instruments"
            ? "TEXAS INSTRUMENTS"
            : "STMicroelectronics",
        ),
      );
      this.svg.append(
        svg(
          "text",
          { x: 500, y: 352, "text-anchor": "middle", class: "chip-name" },
          d.name,
        ),
      );
      this.svg.append(
        svg(
          "text",
          { x: 500, y: 382, "text-anchor": "middle", class: "chip-core" },
          d.core,
        ),
      );
      this.svg.append(
        svg(
          "text",
          { x: 500, y: 423, "text-anchor": "middle", class: "chip-package" },
          d.package,
        ),
      );
      this.liveText = svg(
        "text",
        { x: 500, y: 465, "text-anchor": "middle", class: "chip-live" },
        "GPIO EM TEMPO REAL",
      );
      this.svg.append(this.liveText);
      this.svg.append(
        svg(
          "text",
          { x: 500, y: 734, "text-anchor": "middle", class: "chip-footnote" },
          this.physical
            ? "Vista superior · numeração do encapsulamento · clique em um terminal GPIO"
            : "Distribuição funcional dos GPIO · sem numeração física dos terminais",
        ),
      );
      pins.forEach((pin, index) => {
        const side = Math.floor(index / perSide),
          slot = index % perSide;
        const pitch = (size - 36) / perSide,
          along = 18 + (slot + 0.5) * pitch;
        let x, y, angle;
        if (side === 0) {
          x = left;
          y = top + along;
          angle = 180;
        } else if (side === 1) {
          x = left + along;
          y = top + size;
          angle = 90;
        } else if (side === 2) {
          x = left + size;
          y = top + size - along;
          angle = 0;
        } else {
          x = left + size - along;
          y = top;
          angle = -90;
        }
        const gpioName =
          pin.port !== undefined && pin.bit !== undefined
            ? "P" + pin.port + pin.bit
            : pin.name.split("/")[0];
        const gpio = parsePin(d, gpioName);
        const group = svg("g", {
          class: "board-pin " + (gpio ? "gpio" : "fixed"),
          transform: `translate(${x} ${y}) rotate(${angle})`,
        });
        const terminalWidth = Math.min(16, pitch - 2);
        group.append(
          svg("rect", {
            x: 0,
            y: -terminalWidth / 2,
            width: 29,
            height: terminalWidth,
            rx: 2,
            class: "pin-pad",
          }),
        );
        group.append(
          svg("rect", {
            x: -3,
            y: -pitch / 2,
            width: 91,
            height: pitch,
            fill: "transparent",
            class: "pin-hit",
          }),
        );
        const labelGroup = svg("g", {
          transform:
            side === 0 || side === 3
              ? "translate(40 0) rotate(180)"
              : "translate(40 0)",
        });
        const label = svg(
          "text",
          {
            x: 0,
            y: 3,
            "text-anchor": side === 0 || side === 3 ? "end" : "start",
            class: "pin-label" + (!gpio ? " non-gpio" : ""),
            "font-size": perSide > 25 ? 9 : 11,
          },
          pin.name,
        );
        labelGroup.append(label);
        group.append(labelGroup);
        if (this.physical)
          group.append(
            svg(
              "text",
              {
                x: 12,
                y: 3,
                "text-anchor": "middle",
                transform: side === 0 || side === 3 ? "rotate(180 12 0)" : "",
                class: "pin-number",
                "font-size": perSide > 25 ? 7 : 8,
              },
              pin.number,
            ),
          );
        const hint = gpio
          ? `${gpio.name}, terminal ${pin.number || "funcional"}. Selecionar pino.`
          : `${pin.name}${pin.number ? ", terminal " + pin.number : ""}. Alimentação ou função não GPIO.`;
        group.append(svg("title", {}, hint));
        group.setAttribute("aria-label", hint);
        if (gpio) {
          group.setAttribute("role", "button");
          group.setAttribute("tabindex", "0");
          group.dataset.pin = gpio.name;
          group.onclick = () => this.selectPin(gpio.name);
          group.onkeydown = (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              this.selectPin(gpio.name);
            }
          };
          this.pinNodes.set(gpio.name, {
            node: group,
            pin: gpio,
            number: pin.number,
          });
          const radians = (angle * Math.PI) / 180;
          this.pinPositions.set(gpio.name, {
            x: x + Math.cos(radians) * 29,
            y: y + Math.sin(radians) * 29,
            side,
          });
        } else
          group.classList.add(
            pin.kind === "ground" || pin.kind === "power" ? "power" : "control",
          );
        this.svg.append(group);
      });
      const emptyLeft = svg("g", { class: "board-empty-slot" });
      emptyLeft.append(
        svg("rect", { x: 16, y: 290, width: 168, height: 130, rx: 10 }),
        svg("text", { x: 100, y: 342, "text-anchor": "middle" }, "+"),
        svg(
          "text",
          { x: 100, y: 371, "text-anchor": "middle", class: "slot-text" },
          "Seus componentes",
        ),
      );
      this.emptySlot = emptyLeft;
      this.svg.append(emptyLeft);
    }
    buildInspector() {
      const head = el("div", "board-pin-heading");
      this.selectedName = el("strong");
      this.selectedLevel = el("span", "board-level-pill");
      head.append(this.selectedName, this.selectedLevel);
      this.selectedDetail = el("p", "board-pin-detail");
      this.inspector.append(head, this.selectedDetail);
      this.pinSelect = select(this.allPins(), "Pino selecionado");
      this.pinSelect.onchange = () => this.selectPin(this.pinSelect.value);
      this.inspector.append(field("Selecionar GPIO", this.pinSelect));
      this.modeSelect = select(
        MODES.map((name, index) => [index, name]),
        "Direção do pino",
      );
      this.pullSelect = select(
        [
          ["none", "Sem pull"],
          ["up", "Pull-up"],
          ["down", "Pull-down"],
        ],
        "Pull do pino",
      );
      this.inspector.append(
        field("Configuração inicial", this.modeSelect),
        field("Pull no registrador", this.pullSelect),
      );
      this.inspector.append(
        button(
          "Aplicar ao pino",
          this.safe(() => this.applyPin()),
          "board-apply primary",
        ),
      );
      const defaults = el(
        "p",
        "board-small",
        "Aplicada agora e após Build/Reset. O Assembly pode alterar esta configuração durante a execução. Pulls são armazenados; os componentes dirigem 0/1 explicitamente.",
      );
      this.inspector.append(defaults);
      this.outputControls = el("div", "board-output-controls");
      this.outputControls.append(
        el("span", "", "Escrever saída"),
        button(
          "0",
          this.safe(() => this.setOutput(false)),
        ),
        button(
          "1",
          this.safe(() => this.setOutput(true)),
        ),
      );
      this.inspector.append(this.outputControls);
      this.inspector.append(
        button(
          "Ver no canal 1 do scope",
          this.safe(() => {
            const p = this.selectedPin();
            this.callbacks.onScope?.(p.port, p.bit);
            this.message(p.name + " selecionado no canal 1.");
          }),
          "board-scope-button",
        ),
      );
      const separator = el("hr");
      this.inspector.append(separator, el("h3", "", "Conectar componente"));
      this.attachType = select(
        [
          ["button", "Botão momentâneo"],
          ["switch", "Chave liga/desliga"],
          ["led", "LED indicador"],
        ],
        "Componente",
      );
      this.attachPolarity = select(
        [
          ["high", "Ativo em 1 · repouso 0"],
          ["low", "Ativo em 0 · repouso 1"],
        ],
        "Polaridade do componente",
      );
      this.inspector.append(
        field("Tipo", this.attachType),
        field("Polaridade", this.attachPolarity),
      );
      this.inspector.append(
        button(
          "＋ Conectar ao pino",
          this.safe(() => this.attach()),
          "board-attach",
        ),
      );
      this.inspector.append(
        el(
          "p",
          "board-small",
          "Botão/chave configuram o pino como entrada. O LED apenas observa o nível. Até 6 componentes por micro.",
        ),
      );
      this.conflict = el("p", "board-conflict");
      this.conflict.setAttribute("role", "status");
      this.inspector.append(this.conflict);
      this.inspector.append(
        button(
          "Remover configuração inicial",
          this.safe(() => {
            delete this.profile.pins[this.profile.selected];
            this.message(
              "Configuração inicial removida. O valor atual do GPIO foi preservado.",
            );
            this.changed();
          }),
          "board-clear-config",
        ),
      );
    }
    selectedPin() {
      return parsePin(this.lab.device, this.profile.selected);
    }
    selectPin(name) {
      if (!parsePin(this.lab.device, name)) return;
      this.profile.selected = name;
      this.updateInspector(true);
      this.render();
      this.callbacks.onSave?.();
    }
    readPull(pin) {
      const p = this.lab.ports[pin.port],
        kind = this.lab.device.gpioKind;
      if (kind === "stm32f4")
        return ["none", "up", "down", "none"][(p.pupdr >>> (pin.bit * 2)) & 3];
      if (kind === "tiva")
        return p.pur & (1 << pin.bit)
          ? "up"
          : p.pdr & (1 << pin.bit)
            ? "down"
            : "none";
      const config =
        ((pin.bit < 8 ? p.crl : p.crh) >>> ((pin.bit % 8) * 4)) & 15;
      return config === 8 ? (p.odr & (1 << pin.bit) ? "up" : "down") : "none";
    }
    updateInspector(force = false) {
      const pin = this.selectedPin();
      if (!pin) return;
      const mode = this.lab.pinMode(pin.port, pin.bit),
        high = (this.lab.ports[pin.port].pins >>> pin.bit) & 1;
      const number = this.pinNodes.get(pin.name)?.number;
      this.selectedName.textContent = pin.name;
      this.pinSelect.value = pin.name;
      this.selectedLevel.textContent =
        mode < 2 ? "Nível " + high : "Sem sinal digital";
      this.selectedLevel.classList.toggle("high", mode < 2 && !!high);
      this.selectedDetail.textContent =
        (number ? "Terminal " + number + " · " : "") +
        MODES[mode] +
        " · GPIO" +
        this.lab.device.ports[pin.port].name;
      if (force || this.lastSelected !== pin.name) {
        this.modeSelect.value = mode;
        this.pullSelect.value = this.readPull(pin);
        this.lastSelected = pin.name;
      }
      this.outputControls
        .querySelectorAll("button")
        .forEach((b) => (b.disabled = mode !== 1));
      const warnings = [];
      if (mode >= 2)
        warnings.push(
          "Habilite entrada ou saída para observar sinais digitais.",
        );
      const g = this.lab.generator,
        w = this.lab.wire;
      if (g.enabled && g.port === pin.port && g.pin === pin.bit)
        warnings.push("O gerador tem prioridade sobre o botão/chave.");
      if (w.enabled && w.to === pin.port && w.tp === pin.bit)
        warnings.push("A ligação virtual tem prioridade sobre o botão/chave.");
      if (
        this.profile.components.some(
          (c) => c.pin === pin.name && c.type !== "led",
        ) &&
        mode !== 0
      )
        warnings.push(
          "Botão/chave desconectado do sinal: o programa mudou o modo do pino.",
        );
      this.conflict.textContent = warnings.join(" ");
      this.conflict.hidden = !warnings.length;
    }
    applyPin() {
      const pin = this.selectedPin(),
        mode = +this.modeSelect.value,
        pull = this.pullSelect.value;
      this.callbacks.onPause?.();
      this.lab.configurePin(pin.port, pin.bit, mode, pull);
      this.profile.pins[pin.name] = {
        mode,
        pull,
        level: (this.lab.ports[pin.port].odr >>> pin.bit) & 1,
      };
      for (const item of this.profile.components)
        if (item.pin === pin.name && item.type !== "led")
          this.drive(item, false);
      this.message(
        pin.name + " configurado como " + MODES[mode].toLowerCase() + ".",
      );
      this.changed();
    }
    setOutput(high) {
      const pin = this.selectedPin();
      this.callbacks.onPause?.();
      this.lab.setPinOutput(pin.port, pin.bit, high);
      const config = this.profile.pins[pin.name];
      if (config) config.level = high ? 1 : 0;
      this.changed();
    }
    attach() {
      if (this.profile.components.length >= 6)
        throw Error(
          "Esta bancada comporta até 6 componentes. Remova um para adicionar outro.",
        );
      const pin = this.selectedPin(),
        type = this.attachType.value;
      if (
        type !== "led" &&
        this.profile.components.some(
          (c) => c.pin === pin.name && c.type !== "led",
        )
      )
        throw Error(
          "Este GPIO já possui um botão ou chave. Remova ou mova o componente existente.",
        );
      const item = {
        id: "c" + Date.now() + "-" + this.nextId++,
        type,
        pin: pin.name,
        label: TYPES[type] + " · " + pin.name,
        activeLow: this.attachPolarity.value === "low",
        latched: false,
      };
      if (type !== "led") {
        this.callbacks.onPause?.();
        const pull = item.activeLow ? "up" : "down";
        this.lab.configurePin(pin.port, pin.bit, 0, pull);
        this.profile.pins[pin.name] = { mode: 0, pull, level: 0 };
      }
      this.profile.components.push(item);
      this.drive(item, false);
      this.rebuildCards();
      this.updateInspector(true);
      this.message(TYPES[type] + " conectado a " + pin.name + ".");
      this.changed();
    }
    drive(item, notify = true) {
      if (item.type === "led" || this.currentId !== this.lab.device.id) return;
      const pin = parsePin(this.lab.device, item.pin);
      if (!pin) return;
      const active =
        item.type === "switch" ? item.latched : this.pressed.has(item.id);
      const high = item.activeLow ? !active : active;
      if (((this.lab.manual[pin.port] >>> pin.bit) & 1) !== Number(high)) {
        // Record the external level even while GPIO is an output. The core
        // keeps the output latch authoritative; a later IN mode sees the
        // current switch/button state, including a release that happened OUT.
        const before = (this.lab.ports[pin.port].pins >>> pin.bit) & 1;
        this.lab.input(pin.port, pin.bit, high);
        const after = (this.lab.ports[pin.port].pins >>> pin.bit) & 1;
        if (before !== after)
          this.callbacks.onPinInput?.(pin.port, pin.bit, !!after);
      }
      if (notify) this.changed(item.type === "switch");
    }
    press(item, active) {
      if (item.type !== "button") return;
      if (active) this.pressed.add(item.id);
      else this.pressed.delete(item.id);
      this.drive(item);
      this.render();
    }
    releaseAll() {
      if (!this.pressed.size) return;
      const ids = new Set(this.pressed);
      this.pressed.clear();
      if (this.currentId === this.lab.device.id)
        for (const item of this.profile.components)
          if (ids.has(item.id)) this.drive(item, false);
      this.render();
      this.callbacks.onChange?.();
    }
    remove(item) {
      this.pressed.delete(item.id);
      if (item.type !== "led") {
        item.latched = false;
        this.drive(item, false);
      }
      this.profile.components = this.profile.components.filter(
        (c) => c.id !== item.id,
      );
      this.rebuildCards();
      this.message("Componente removido. Configuração do GPIO preservada.");
      this.changed();
    }
    reassign(item, name) {
      const pin = parsePin(this.lab.device, name);
      if (!pin) throw Error("Pino indisponível.");
      if (
        item.type !== "led" &&
        this.profile.components.some(
          (c) => c !== item && c.type !== "led" && c.pin === name,
        )
      )
        throw Error("O pino já tem um componente de entrada.");
      this.callbacks.onPause?.();
      this.pressed.delete(item.id);
      if (item.type !== "led") {
        item.latched = false;
        this.drive(item, false);
      }
      item.pin = name;
      if (item.type !== "led") {
        const pull = item.activeLow ? "up" : "down";
        this.lab.configurePin(pin.port, pin.bit, 0, pull);
        this.profile.pins[name] = { mode: 0, pull, level: 0 };
        this.drive(item, false);
      }
      this.rebuildCards();
      this.selectPin(name);
      this.changed();
    }
    rebuildCards() {
      this.componentsLayer.replaceChildren();
      this.connectionGroup.replaceChildren();
      this.cardNodes.clear();
      this.emptySlot.style.display = this.profile.components.length
        ? "none"
        : "";
      this.profile.components.forEach((item, index) => {
        const leftSide = index % 2 === 0,
          row = Math.floor(index / 2),
          x = leftSide ? 16 : 816,
          y = 100 + row * 200;
        const card = el("article", "board-component " + item.type);
        card.style.left = x / 10 + "%";
        card.style.top = y / 7.6 + "%";
        card.style.setProperty("--component-color", COLORS[index]);
        const head = el("div", "component-head"),
          name = el("input", "component-name");
        name.value = item.label;
        name.maxLength = 40;
        name.setAttribute("aria-label", "Nome do componente em " + item.pin);
        name.onchange = () => {
          item.label = name.value.trim().slice(0, 40) || TYPES[item.type];
          name.value = item.label;
          this.callbacks.onSave?.();
        };
        const remove = button("×", () => this.remove(item), "component-remove");
        remove.title = "Remover " + item.label;
        remove.setAttribute("aria-label", "Remover " + item.label);
        head.append(name, remove);
        card.append(head);
        let actuator;
        if (item.type === "led") {
          actuator = el("div", "board-led");
          actuator.setAttribute("role", "img");
          actuator.setAttribute("aria-label", "LED " + item.pin);
          actuator.append(el("span", "led-dome"), el("span", "led-foot"));
          card.append(actuator);
        } else if (item.type === "switch") {
          actuator = button(
            "",
            () => {
              item.latched = !item.latched;
              this.drive(item);
            },
            "board-switch",
          );
          actuator.setAttribute("role", "switch");
          actuator.setAttribute("aria-label", "Chave em " + item.pin);
          actuator.append(
            el("span", "switch-track"),
            el("span", "switch-label", "Desligada"),
          );
          card.append(actuator);
        } else {
          actuator = button("Pressionar", () => {}, "board-pushbutton");
          actuator.setAttribute(
            "aria-label",
            "Pressionar botão em " + item.pin,
          );
          actuator.onpointerdown = (event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            actuator.focus();
            actuator.setPointerCapture(event.pointerId);
            this.press(item, true);
          };
          actuator.onpointerup = () => this.press(item, false);
          actuator.onpointercancel = () => this.press(item, false);
          actuator.onlostpointercapture = () => this.press(item, false);
          actuator.onkeydown = (event) => {
            if (event.key === " " || event.key === "Enter") {
              event.preventDefault();
              if (!event.repeat) this.press(item, true);
            }
          };
          actuator.onkeyup = (event) => {
            if (event.key === " " || event.key === "Enter") {
              event.preventDefault();
              this.press(item, false);
            }
          };
          actuator.onblur = () => this.press(item, false);
          card.append(actuator);
        }
        const footer = el("div", "component-footer"),
          pinChoice = select(this.allPins(), "Pino de " + item.label);
        pinChoice.value = item.pin;
        pinChoice.onchange = this.safe(() => {
          try {
            this.reassign(item, pinChoice.value);
          } finally {
            pinChoice.value = item.pin;
          }
        });
        const polarity = button(
          item.activeLow ? "Ativo 0" : "Ativo 1",
          this.safe(() => {
            this.pressed.delete(item.id);
            item.activeLow = !item.activeLow;
            this.drive(item, false);
            this.rebuildCards();
            this.changed();
          }),
          "component-polarity",
        );
        polarity.title = "Alternar polaridade; o repouso é o nível oposto";
        footer.append(pinChoice, polarity);
        card.append(footer);
        const state = el("div", "component-state");
        card.append(state);
        this.componentsLayer.append(card);
        const point = this.pinPositions.get(item.pin);
        let wire = null;
        if (point) {
          const startX = leftSide ? x + 168 : x,
            startY = y + 87,
            elbow = leftSide ? 214 + row * 10 : 786 - row * 10;
          let path = `M ${startX} ${startY} H ${elbow}`;
          if (point.side === 1 || point.side === 3) {
            const clearanceY =
              point.side === 3 ? 140 - row * 10 : 610 + row * 10;
            path += ` V ${clearanceY} H ${point.x} V ${point.y}`;
          } else path += ` V ${point.y} H ${point.x}`;
          wire = svg("path", {
            d: path,
            fill: "none",
            stroke: COLORS[index],
            "stroke-width": 2,
            class: "component-wire",
          });
          this.connectionGroup.append(wire);
          this.connectionGroup.append(
            svg("circle", {
              cx: point.x,
              cy: point.y,
              r: 4,
              fill: COLORS[index],
            }),
          );
        }
        this.cardNodes.set(item.id, { card, actuator, state, wire });
      });
      this.render();
    }
    demo() {
      const input =
        parsePin(this.lab.device, "PB0") || this.lab.device.accessiblePins[1];
      const output =
        parsePin(this.lab.device, "PA0") || this.lab.device.accessiblePins[0];
      this.callbacks.onPause?.();
      this.callbacks.onDemo?.();
      this.pressed.clear();
      this.profile.components = [
        {
          id: "demo-button",
          type: "button",
          pin: input.name,
          label: "Botão de entrada",
          activeLow: false,
          latched: false,
        },
        {
          id: "demo-led",
          type: "led",
          pin: output.name,
          label: "LED de saída",
          activeLow: false,
          latched: false,
        },
      ];
      this.profile.pins[input.name] = { mode: 0, pull: "down", level: 0 };
      this.profile.pins[output.name] = { mode: 1, pull: "none", level: 0 };
      this.profile.selected = input.name;
      this.afterReset();
      this.rebuildCards();
      this.updateInspector(true);
      this.message(
        this.callbacks.onDemo
          ? "Execute o programa e mantenha o botão pressionado para acender o LED."
          : "Bancada pronta. Carregue o exemplo Entrada → saída e execute para o botão comandar o LED.",
      );
      this.changed();
    }
    render() {
      if (this.currentId !== this.lab.device.id || !this.profile) return;
      for (const [name, item] of this.pinNodes) {
        const mode = this.lab.pinMode(item.pin.port, item.pin.bit),
          high = (this.lab.ports[item.pin.port].pins >>> item.pin.bit) & 1;
        item.node.classList.toggle("input", mode === 0);
        item.node.classList.toggle("output", mode === 1);
        item.node.classList.toggle("high", mode < 2 && !!high);
        item.node.classList.toggle("inactive", mode >= 2);
        item.node.classList.toggle("selected", name === this.profile.selected);
        item.node.setAttribute(
          "aria-pressed",
          name === this.profile.selected ? "true" : "false",
        );
      }
      this.liveText.textContent =
        this.lab.t.toLocaleString("pt-BR") + " PASSOS · GPIO AO VIVO";
      this.updateInspector();
      for (const item of this.profile.components) {
        const nodes = this.cardNodes.get(item.id),
          pin = parsePin(this.lab.device, item.pin);
        if (!nodes || !pin) continue;
        const mode = this.lab.pinMode(pin.port, pin.bit),
          high = (this.lab.ports[pin.port].pins >>> pin.bit) & 1;
        const valid = item.type === "led" ? mode < 2 : mode === 0;
        const active = valid && (item.activeLow ? !high : !!high);
        nodes.card.classList.toggle("lit", active);
        nodes.card.classList.toggle("disconnected", !valid);
        if (nodes.wire) {
          nodes.wire.classList.toggle("high", valid && !!high);
          nodes.wire.classList.toggle("disconnected", !valid);
        }
        nodes.state.textContent = valid
          ? item.pin +
            " · nível " +
            high +
            (item.type === "led" ? (active ? " · aceso" : " · apagado") : "")
          : item.pin + " · " + MODES[mode] + " · desconectado";
        if (item.type === "button") {
          nodes.actuator.disabled = !valid;
          nodes.actuator.classList.toggle("pressed", this.pressed.has(item.id));
          nodes.actuator.textContent = this.pressed.has(item.id)
            ? "Pressionado"
            : "Pressionar";
        }
        if (item.type === "switch") {
          nodes.actuator.disabled = !valid;
          nodes.actuator.setAttribute(
            "aria-checked",
            item.latched ? "true" : "false",
          );
          nodes.actuator.querySelector(".switch-label").textContent =
            item.latched ? "Ligada" : "Desligada";
        }
        if (item.type === "led")
          nodes.actuator.setAttribute(
            "aria-label",
            "LED " + item.pin + (active ? " aceso" : " apagado"),
          );
      }
    }
  }
  LabBoard.validateState = sanitizedState;
  root.LabBoard = LabBoard;
  if (typeof module !== "undefined") module.exports = LabBoard;
})(typeof globalThis !== "undefined" ? globalThis : this);
