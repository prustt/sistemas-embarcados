/* NVIC inspector — GPL-2.0-or-later. */
(function (root) {
  "use strict";
  const SYSTEM_IRQS = [-14, -13, -5, -2, -1];
  const PAGE_SIZE = 16;
  const hex = (n) =>
    "0x" + (Number(n) >>> 0).toString(16).toUpperCase().padStart(8, "0");
  const integer = (v, min, max, label) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max)
      throw Error(label + ": valor entre " + min + " e " + max + ".");
    return n;
  };
  const element = (tag, className, text) => {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const label = (text, control, className = "") => {
    const l = element("label", className, text);
    l.append(control);
    return l;
  };
  const input = (aria, type = "text", value = "") => {
    const i = element("input");
    i.type = type;
    i.value = value;
    i.setAttribute("aria-label", aria);
    return i;
  };
  const select = (aria, options) => {
    const s = element("select");
    s.setAttribute("aria-label", aria);
    for (const [value, text] of options) {
      const o = element("option", "", text);
      o.value = value;
      s.append(o);
    }
    return s;
  };
  const safeText = (value, limit = 120) =>
    typeof value === "string" ? value.slice(0, limit) : "";
  const defaultProfile = () => ({
    selected: 0,
    page: 0,
    entries: Object.create(null),
    vtor: "",
    systick: null,
    route: null,
  });

  class LabInterruptPanel {
    constructor(host, lab, callbacks = {}) {
      this.host = host;
      this.lab = lab;
      this.callbacks = callbacks;
      this.profiles = Object.create(null);
      this.rows = new Map();
      this.deviceId = null;
      this.configureDevice();
    }
    get profile() {
      const id = this.lab.device.id;
      return this.profiles[id] || (this.profiles[id] = defaultProfile());
    }
    _button(text, fn, cls = "") {
      const b = element("button", cls, text);
      b.type = "button";
      b.onclick = () => this._act(fn);
      return b;
    }
    _act(fn, message) {
      try {
        fn();
        if (message) this._message(message);
      } catch (error) {
        this._message(error.message || String(error), true);
      }
    }
    _message(text, error = false) {
      if (!this.message) return;
      this.message.textContent = text;
      this.message.classList.toggle("error", error);
    }
    _changed(message) {
      this.render();
      this.callbacks.onChange?.();
      this.callbacks.onSave?.();
      if (message) this._message(message);
    }
    _resolve(expr) {
      if (this.callbacks.resolve) return this.callbacks.resolve(expr);
      if (!/^(?:0x[\da-f]+|\d+)$/i.test(expr.trim()))
        throw Error(
          "Use um endereço numérico ou faça Build para resolver símbolos.",
        );
      return integer(Number(expr), 0, 0xffffffff, "Endereço");
    }
    _state() {
      return this.lab.nvic?.state();
    }
    configureDevice() {
      this.deviceId = this.lab.device.id;
      this.rows.clear();
      this.host.replaceChildren();
      this.host.classList.add("irq-panel");
      if (!this.lab.nvic) {
        this.host.append(
          element(
            "p",
            "irq-empty",
            "Inicializando controlador de interrupções…",
          ),
        );
        return;
      }
      const heading = element("div", "irq-heading"),
        title = element("div");
      title.append(
        element("h3", "", "Interrupções · NVIC"),
        element(
          "p",
          "",
          "Pendências, prioridades e handlers do núcleo em execução.",
        ),
      );
      this.activeBadge = element("span", "irq-badge", "Thread mode");
      const headingActions = element("div", "irq-actions");
      if (this.callbacks.onDemo) {
        headingActions.append(
          this._button("Carregar exemplo IRQ0", () => {
            this.callbacks.onDemo();
            this._message(
              "Clique Executar para instalar o vetor na SRAM e habilitar IRQ0. Depois use Disparar na linha IRQ 0 ou configure a ligação virtual PB0 → IRQ0.",
            );
          }),
        );
      }
      headingActions.append(this.activeBadge);
      heading.append(title, headingActions);
      this.host.append(heading);
      this.stats = element("div", "irq-statline");
      this.statNodes = {};
      for (const key of ["IPSR", "PRIMASK", "BASEPRI", "FAULTMASK", "VTOR"]) {
        const n = element("code");
        this.statNodes[key] = n;
        this.stats.append(n);
      }
      this.host.append(this.stats);
      const work = element("div", "irq-workspace"),
        tableCard = element("section", "irq-card");
      const toolbar = element("div", "irq-toolbar");
      toolbar.append(element("h3", "", "Fontes de interrupção"));
      this.pageSelect = select("Página de IRQs", []);
      const count = this._state().irqCount;
      for (let start = 0; start < count; start += PAGE_SIZE) {
        const o = element(
          "option",
          "",
          "IRQ " + start + "–" + Math.min(count - 1, start + PAGE_SIZE - 1),
        );
        o.value = start / PAGE_SIZE;
        this.pageSelect.append(o);
      }
      this.pageSelect.value = this.profile.page;
      this.pageSelect.onchange = () => {
        this.profile.page = Number(this.pageSelect.value);
        this._buildRows();
        this.render();
      };
      toolbar.append(this.pageSelect);
      tableCard.append(toolbar);
      const tableWrap = element("div", "irq-table-wrap");
      this.table = element("table", "irq-table");
      const head = element("thead"),
        tr = element("tr");
      for (const text of [
        "Fonte",
        "Habilitada",
        "Pendente",
        "Ativa",
        "Prioridade",
        "Ação",
      ])
        tr.append(element("th", "", text));
      head.append(tr);
      this.table.append(head);
      this.tbody = element("tbody");
      this.table.append(this.tbody);
      tableWrap.append(this.table);
      tableCard.append(tableWrap);
      tableCard.append(
        element(
          "p",
          "irq-help",
          "Clique na fonte para configurar o handler. IRQs externas são linhas genéricas do NVIC; a ligação aos periféricos de cada micro não é presumida.",
        ),
      );
      this.summary = element("div", "irq-paging");
      tableCard.append(this.summary);
      const side = element("div", "irq-sidebar");
      side.append(this._handlerCard(), this._vectorCard());
      work.append(tableCard, side);
      this.host.append(work);
      const bottom = element("div", "irq-bottom");
      bottom.append(this._systickCard(), this._routeCard());
      this.host.append(bottom);
      this.message = element("p", "irq-message");
      this.message.setAttribute("role", "status");
      this.message.setAttribute("aria-live", "polite");
      this.host.append(this.message);
      this.eventLog = element("pre", "irq-events");
      this.eventLog.setAttribute("aria-label", "Eventos de interrupção");
      this.host.append(this.eventLog);
      this.host.append(
        element(
          "p",
          "irq-note",
          "Modelo didático com quadro básico de exceção e prioridades. Sem empilhamento estendido/lazy da FPU, tail-chaining ou precisão de ciclos. SysTick usa passos do motor, não o tempo calculado na árvore de clock. A rota GPIO abaixo é uma ligação virtual, não uma implementação de EXTI/GPIO interrupt do fabricante.",
        ),
      );
      this._buildRows();
      this._fillSelected();
      this._fillConfiguration();
      this.render();
    }
    _buildRows() {
      this.rows.clear();
      this.tbody.replaceChildren();
      const state = this._state(),
        byIrq = new Map(state.irqs.map((e) => [e.irq, e]));
      const first = this.profile.page * PAGE_SIZE;
      const ids = SYSTEM_IRQS.concat(
        Array.from(
          { length: Math.min(PAGE_SIZE, state.irqCount - first) },
          (_, i) => first + i,
        ),
      );
      for (const irq of ids) {
        const entry = byIrq.get(irq);
        if (!entry) continue;
        const tr = element("tr"),
          name = this._button(
            entry.name || "IRQ " + irq,
            () => {
              this.profile.selected = irq;
              this._fillSelected();
              this.render();
            },
            "irq-name",
          );
        name.setAttribute(
          "aria-label",
          "Configurar " + (entry.name || "IRQ " + irq),
        );
        const enabled = input(
          "Habilitar " + (entry.name || "IRQ " + irq),
          "checkbox",
        );
        enabled.disabled = irq < 0;
        enabled.onchange = () =>
          this._act(() => {
            this.lab.nvic.enable(irq, enabled.checked);
            const config =
              this.profile.entries[irq] || (this.profile.entries[irq] = {});
            config.enabled = enabled.checked;
            this._changed();
          });
        const pend = element("span", "irq-state"),
          active = element("span", "irq-state"),
          priority = element("code");
        const trigger = this._button("Disparar", () => {
          this.lab.nvic.setPending(irq, true);
          this._changed(
            (entry.name || "IRQ " + irq) +
              " pendente. Execute ou avance um passo para atender.",
          );
        });
        const controls = element("div", "irq-actions");
        controls.append(
          trigger,
          this._button("×", () => {
            this.lab.nvic.setPending(irq, false);
            this._changed();
          }),
        );
        controls.lastChild.title = "Limpar pendência";
        for (const content of [
          name,
          enabled,
          pend,
          active,
          priority,
          controls,
        ]) {
          const td = element("td");
          td.append(content);
          tr.append(td);
        }
        this.tbody.append(tr);
        this.rows.set(irq, { tr, enabled, pend, active, priority });
      }
    }
    _handlerCard() {
      const card = element("section", "irq-card");
      this.selectedTitle = element("h3");
      card.append(this.selectedTitle);
      this.selectedValue = element("div", "irq-detail-value");
      card.append(this.selectedValue);
      const form = element("form", "irq-form");
      this.handlerInput = input("Handler: símbolo ou endereço");
      this.handlerInput.placeholder = "ex.: irq_handler ou 0x08000100";
      this.priorityInput = input("Prioridade bruta NVIC", "number");
      this.priorityInput.min = 0;
      this.priorityInput.max = 255;
      form.append(
        label("Handler personalizado", this.handlerInput),
        label("Prioridade · byte do registrador", this.priorityInput),
      );
      const actions = element("div", "irq-actions"),
        apply = element("button", "primary", "Aplicar handler e prioridade");
      apply.type = "submit";
      actions.append(
        apply,
        this._button("Usar vetor", () => {
          const irq = this.profile.selected;
          this.callbacks.onPause?.();
          this.lab.nvic.setHandler(irq, null);
          const c =
            this.profile.entries[irq] || (this.profile.entries[irq] = {});
          c.handler = "";
          this.handlerInput.value = "";
          this._changed("Handler obtido da tabela em VTOR.");
        }),
      );
      form.append(actions);
      form.onsubmit = (e) => {
        e.preventDefault();
        this._act(() => {
          const irq = this.profile.selected,
            expression = this.handlerInput.value.trim();
          const address = expression ? this._resolve(expression) : null;
          const priority = integer(
            this.priorityInput.value,
            0,
            255,
            "Prioridade",
          );
          this.callbacks.onPause?.();
          this.lab.nvic.setHandler(irq, address);
          if (irq !== -14 && irq !== -13)
            this.lab.nvic.setPriority(irq, priority);
          const c =
            this.profile.entries[irq] || (this.profile.entries[irq] = {});
          c.handler = expression;
          c.priority = priority;
          this._fillSelected();
          this._changed(
            "Configuração aplicada. Valores menores têm maior prioridade.",
          );
        });
      };
      card.append(
        form,
        element(
          "p",
          "irq-help",
          "Símbolos precisam de Build. Vazio usa VTOR + 4 × número da exceção. Prioridade 0 é a mais alta; os bits não implementados são ignorados pelo modelo.",
        ),
      );
      return card;
    }
    _vectorCard() {
      const card = element("section", "irq-card");
      card.append(element("h3", "", "Tabela de vetores e máscaras"));
      const form = element("form", "irq-form");
      this.vtorInput = input("Base VTOR");
      this.vtorInput.placeholder = "0x08000000";
      this.primaskInput = input("PRIMASK", "checkbox");
      this.faultmaskInput = input("FAULTMASK", "checkbox");
      this.basepriInput = input("BASEPRI", "number", 0);
      this.basepriInput.min = 0;
      this.basepriInput.max = 255;
      const grid = element("div", "irq-fields");
      grid.append(
        label("VTOR", this.vtorInput, "wide"),
        label("PRIMASK · bloquear IRQs", this.primaskInput, "irq-checkbox"),
        label("FAULTMASK", this.faultmaskInput, "irq-checkbox"),
        label("BASEPRI · 0 libera", this.basepriInput, "wide"),
      );
      const apply = element("button", "", "Aplicar VTOR e máscaras");
      apply.type = "submit";
      form.append(grid, apply);
      form.onsubmit = (e) => {
        e.preventDefault();
        this._act(() => {
          const vtor = this._resolve(this.vtorInput.value.trim()),
            basepri = integer(this.basepriInput.value, 0, 255, "BASEPRI");
          this.callbacks.onPause?.();
          this.lab.nvic.setVTOR(vtor);
          this.lab.setReg("PRIMASK", Number(this.primaskInput.checked));
          this.lab.setReg("FAULTMASK", Number(this.faultmaskInput.checked));
          this.lab.setReg("BASEPRI", basepri);
          this.profile.vtor = this.vtorInput.value.trim();
          this._changed(
            "VTOR e máscaras aplicados; máscaras são estado da CPU e serão limpas no reset.",
          );
        });
      };
      card.append(
        form,
        element(
          "p",
          "irq-help",
          "PRIMASK bloqueia exceções de prioridade configurável. BASEPRI bloqueia a partir do limiar informado. As máscaras exibidas acima refletem também instruções CPS/MSR do programa.",
        ),
      );
      return card;
    }
    _systickCard() {
      const card = element("section", "irq-card");
      card.append(element("h3", "", "SysTick · base de tempo lógica"));
      const form = element("form", "irq-form"),
        fields = element("div", "irq-fields");
      this.reloadInput = input("SysTick reload", "number", 99);
      this.reloadInput.min = 0;
      this.reloadInput.max = 0xffffff;
      this.clockSelect = select("Fonte do SysTick", [
        [1, "1 tick por passo"],
        [0, "1 tick a cada 8 passos"],
      ]);
      this.tickEnable = input("SysTick habilitado", "checkbox");
      this.tickInterrupt = input("SysTick gera interrupção", "checkbox");
      fields.append(
        label("RELOAD · 24 bits", this.reloadInput),
        label("Fonte lógica", this.clockSelect),
        label("Contador habilitado", this.tickEnable, "irq-checkbox"),
        label("Gerar interrupção", this.tickInterrupt, "irq-checkbox"),
      );
      this.tickInfo = element("div", "irq-detail-value");
      const apply = element("button", "", "Aplicar SysTick");
      apply.type = "submit";
      form.append(fields, this.tickInfo, apply);
      form.onsubmit = (e) => {
        e.preventDefault();
        this._act(() => {
          const config = {
            reload: integer(this.reloadInput.value, 0, 0xffffff, "RELOAD"),
            enabled: this.tickEnable.checked,
            interrupt: this.tickInterrupt.checked,
            clockSource: Number(this.clockSelect.value),
          };
          this.callbacks.onPause?.();
          this.lab.nvic.configureSysTick(config);
          this.profile.systick = config;
          this._changed(
            "SysTick configurado. Configure o handler de SysTick antes de habilitar sua interrupção.",
          );
        });
      };
      card.append(
        form,
        element(
          "p",
          "irq-help",
          "O contador gera uma pendência periódica quando TICKINT está habilitado. O programa pode configurar CTRL/LOAD/VAL em 0xE000E010. RELOAD é contado em passos, sem conversão para segundos.",
        ),
      );
      return card;
    }
    _routeCard() {
      const card = element("section", "irq-card");
      card.append(element("h3", "", "Pino → IRQ · ligação virtual"));
      const form = element("form", "irq-form"),
        fields = element("div", "irq-fields");
      const options = this.lab.device.ports.flatMap((p, index) =>
        p.pins.map((bit) => [index + ":" + bit, "P" + p.name + bit]),
      );
      this.routePin = select("Pino da interrupção virtual", options);
      this.routeEdge = select("Borda da interrupção virtual", [
        ["rise", "Subida 0 → 1"],
        ["fall", "Descida 1 → 0"],
        ["both", "Ambas as bordas"],
      ]);
      this.routeIrq = input("IRQ da ligação virtual", "number", 0);
      this.routeIrq.min = 0;
      this.routeIrq.max = this._state().irqCount - 1;
      this.routeEnabled = input("Ligação virtual habilitada", "checkbox");
      fields.append(
        label("Pino observado", this.routePin),
        label("Evento", this.routeEdge),
        label("IRQ externa", this.routeIrq),
        label("Ligação habilitada", this.routeEnabled, "irq-checkbox"),
      );
      const apply = element("button", "", "Aplicar ligação");
      apply.type = "submit";
      form.append(fields, apply);
      form.onsubmit = (e) => {
        e.preventDefault();
        this._act(() => {
          const [port, bit] = this.routePin.value.split(":").map(Number);
          const config = {
            port,
            bit,
            irq: integer(
              this.routeIrq.value,
              0,
              this._state().irqCount - 1,
              "IRQ",
            ),
            edge: this.routeEdge.value,
            enabled: this.routeEnabled.checked,
          };
          this.callbacks.onPause?.();
          this.lab.nvic.setRoute(config);
          this.profile.route = config;
          this._changed(
            "Ligação aplicada. Habilite a IRQ e configure seu handler; depois pressione o botão da bancada durante a execução.",
          );
        });
      };
      card.append(
        form,
        element(
          "p",
          "irq-help",
          "Uma ligação por vez. Observa o nível do pino da bancada e coloca a IRQ em pending; prioridades e máscaras decidem quando ela será atendida. Não configura registradores EXTI/SYSCFG.",
        ),
      );
      return card;
    }
    _fillSelected() {
      const irq = this.profile.selected,
        entry = this._state()?.irqs.find((e) => e.irq === irq);
      if (!entry) return;
      this.selectedTitle.textContent = entry.name || "IRQ " + irq;
      this.handlerInput.value = this.profile.entries[irq]?.handler || "";
      this.priorityInput.value = entry.priority < 0 ? 0 : entry.priority;
      this.priorityInput.disabled = irq === -14 || irq === -13;
      this.priorityInput.step = 2 ** (8 - this._state().priorityBits);
    }
    _fillConfiguration() {
      const state = this._state();
      this.vtorInput.value = this.profile.vtor || hex(state.vtor);
      this.primaskInput.checked = !!this.lab.reg("PRIMASK");
      this.faultmaskInput.checked = !!this.lab.reg("FAULTMASK");
      this.basepriInput.value = this.lab.reg("BASEPRI");
      const tick = this.profile.systick || state.systick;
      this.reloadInput.value = tick.reload;
      this.tickEnable.checked = tick.enabled;
      this.tickInterrupt.checked = tick.interrupt;
      this.clockSelect.value = tick.clockSource;
      const route = this.profile.route || state.route;
      if (route) {
        this.routePin.value = route.port + ":" + route.bit;
        this.routeIrq.value = route.irq;
        this.routeEdge.value = route.edge;
        this.routeEnabled.checked = route.enabled;
      }
    }
    render() {
      if (this.deviceId !== this.lab.device.id || !this.table) {
        if (this.lab.nvic) this.configureDevice();
        return;
      }
      if (this.host.hidden) return;
      const state = this._state();
      if (!state) return;
      const byIrq = new Map(state.irqs.map((e) => [e.irq, e]));
      this.activeBadge.textContent = state.active
        ? "Handler · exceção " + state.active + " · nível " + state.depth
        : "Thread mode · nenhuma exceção ativa";
      for (const key of ["IPSR", "PRIMASK", "BASEPRI", "FAULTMASK"]) {
        const value = this.lab.reg(key);
        this.statNodes[key].textContent =
          key + " " + (key === "BASEPRI" ? hex(value) : value);
        this.statNodes[key].classList.toggle(
          "irq-mask-on",
          key !== "IPSR" && !!value,
        );
      }
      this.statNodes.VTOR.textContent = "VTOR " + hex(state.vtor);
      for (const [irq, row] of this.rows) {
        const entry = byIrq.get(irq);
        if (!entry) continue;
        row.tr.classList.toggle("selected", irq === this.profile.selected);
        row.tr.classList.toggle("irq-running", !!entry.active);
        row.enabled.checked = !!entry.enabled;
        row.pend.classList.toggle("pending", !!entry.pending);
        row.active.classList.toggle("active", !!entry.active);
        row.pend.title = entry.pending ? "Pendente" : "Sem pendência";
        row.pend.setAttribute("aria-label", row.pend.title);
        row.active.title = entry.active ? "Ativa" : "Inativa";
        row.active.setAttribute("aria-label", row.active.title);
        row.priority.textContent = String(entry.priority);
      }
      const selected = byIrq.get(this.profile.selected);
      if (selected)
        this.selectedValue.textContent =
          "Exceção " +
          selected.exception +
          " · " +
          (selected.handler == null
            ? "handler não definido"
            : hex(selected.handler)) +
          (selected.source ? " · " + selected.source : "");
      this.summary.textContent =
        state.priorityBits +
        " bits de prioridade · " +
        state.irqs.filter((e) => e.pending).length +
        " pendente(s) · " +
        state.irqs.filter((e) => e.active).length +
        " ativa(s)";
      const tick = state.systick;
      this.tickInfo.textContent =
        "CURRENT " +
        tick.current +
        " · RELOAD " +
        tick.reload +
        " · COUNTFLAG " +
        Number(tick.countFlag);
      const events = (state.events || [])
        .slice(0, 6)
        .map((e) =>
          typeof e === "string"
            ? e
            : (e.step ?? "") +
              " · " +
              (e.type || "") +
              " · " +
              (e.name || "") +
              (e.text ? " · " + e.text : ""),
        );
      this.eventLog.textContent = events.length
        ? events.join("\n")
        : "Nenhum atendimento de interrupção desde o reset.";
    }
    afterReset() {
      if (!this.lab.nvic) return;
      const config = this.profile,
        errors = [];
      const apply = (fn) => {
        try {
          fn();
        } catch (error) {
          errors.push(error.message || String(error));
        }
      };
      if (config.vtor)
        apply(() => this.lab.nvic.setVTOR(this._resolve(config.vtor)));
      for (const [id, entry] of Object.entries(config.entries)) {
        const irq = Number(id);
        if (entry.handler)
          apply(() =>
            this.lab.nvic.setHandler(irq, this._resolve(entry.handler)),
          );
        if (entry.priority !== undefined && irq !== -14 && irq !== -13)
          apply(() => this.lab.nvic.setPriority(irq, entry.priority));
        if (irq >= 0 && entry.enabled !== undefined)
          apply(() => this.lab.nvic.enable(irq, entry.enabled));
      }
      if (config.systick)
        apply(() => this.lab.nvic.configureSysTick(config.systick));
      if (config.route) apply(() => this.lab.nvic.setRoute(config.route));
      this._fillSelected();
      this._fillConfiguration();
      this.render();
      if (errors.length)
        this._message(
          "Revisar configuração de interrupções: " + errors.join(" · "),
          true,
        );
    }
    serialize() {
      return {
        version: 1,
        profiles: JSON.parse(JSON.stringify(this.profiles)),
      };
    }
    restore(value) {
      this.profiles = Object.create(null);
      if (
        !value ||
        value.version !== 1 ||
        !value.profiles ||
        typeof value.profiles !== "object"
      ) {
        this.configureDevice();
        return;
      }
      for (const [id, saved] of Object.entries(value.profiles).slice(0, 10)) {
        if (
          !root.DEVICES ||
          !Object.prototype.hasOwnProperty.call(root.DEVICES, id) ||
          !saved ||
          typeof saved !== "object"
        )
          continue;
        const p = defaultProfile();
        const legalIrq = (n) =>
          Number.isInteger(n) &&
          (SYSTEM_IRQS.includes(n) || (n >= 0 && n < 240));
        if (legalIrq(saved.selected)) p.selected = saved.selected;
        if (Number.isInteger(saved.page) && saved.page >= 0 && saved.page < 15)
          p.page = saved.page;
        p.vtor = safeText(saved.vtor);
        for (const [key, entry] of Object.entries(saved.entries || {}).slice(
          0,
          245,
        )) {
          const irq = Number(key);
          if (!legalIrq(irq) || !entry || typeof entry !== "object") continue;
          const e = {};
          if (typeof entry.enabled === "boolean") e.enabled = entry.enabled;
          if (
            Number.isInteger(entry.priority) &&
            entry.priority >= 0 &&
            entry.priority <= 255
          )
            e.priority = entry.priority;
          e.handler = safeText(entry.handler);
          p.entries[irq] = e;
        }
        const tick = saved.systick;
        if (
          tick &&
          Number.isInteger(tick.reload) &&
          tick.reload >= 0 &&
          tick.reload <= 0xffffff
        )
          p.systick = {
            reload: tick.reload,
            enabled: !!tick.enabled,
            interrupt: !!tick.interrupt,
            clockSource: tick.clockSource === 0 ? 0 : 1,
          };
        const route = saved.route,
          device = root.DEVICES[id];
        if (
          route &&
          Number.isInteger(route.port) &&
          Number.isInteger(route.bit) &&
          device.ports[route.port]?.pins.includes(route.bit) &&
          Number.isInteger(route.irq) &&
          route.irq >= 0 &&
          route.irq < 240 &&
          ["rise", "fall", "both"].includes(route.edge)
        )
          p.route = {
            port: route.port,
            bit: route.bit,
            irq: route.irq,
            edge: route.edge,
            enabled: !!route.enabled,
          };
        this.profiles[id] = p;
      }
      this.configureDevice();
    }
  }
  root.LabInterruptPanel = LabInterruptPanel;
  if (typeof module !== "undefined" && module.exports)
    module.exports = LabInterruptPanel;
})(typeof globalThis !== "undefined" ? globalThis : window);
