/* Clock configuration workbench. GPL-2.0-or-later. */
(function (root) {
  "use strict";
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const hz = (n) =>
    Number.isFinite(n)
      ? (n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 4 }) + " MHz"
      : "—";
  const svgEl = (tag, attrs, text) => {
    const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [key, value] of Object.entries(attrs || {}))
      e.setAttribute(key, value);
    if (text !== undefined) e.textContent = text;
    return e;
  };
  class LabClockPanel {
    constructor(host, lab, callbacks = {}) {
      this.host = host;
      this.lab = lab;
      this.callbacks = callbacks;
      this.profiles = {};
      this.configureDevice();
    }
    configureDevice(draft) {
      this.device = this.lab.device;
      this.draft = {
        ...(draft ||
          this.profiles[this.device.id] ||
          LabClocks.defaultConfig(this.device)),
      };
      this.host.replaceChildren();
      const heading = el("div", "workbench-heading");
      const title = el("div");
      title.append(
        el("span", "eyebrow", "CLOCK CONFIGURATION"),
        el("h2", "", "Árvore de clock"),
        el(
          "p",
          "",
          "Escolha a fonte e os divisores. A árvore calcula as frequências e verifica os limites do perfil.",
        ),
      );
      heading.append(
        title,
        el("span", "workbench-badge", "Planejador de frequências"),
      );
      this.host.append(heading);
      const notice = el(
        "p",
        "clock-notice",
        "Configuração salva no projeto. Não grava RCC/SYSCTL e não altera o ritmo da CPU ou o SysTick, que usam passos lógicos.",
      );
      this.host.append(notice);
      const layout = el("div", "clock-layout");
      const controls = el("form", "clock-controls");
      const presetLabel = el("label", "clock-preset");
      presetLabel.append(el("span", "", "Configuração pronta"));
      const presetSelect = el("select");
      presetSelect.setAttribute("aria-label", "Preset de clock");
      const custom = el("option", "", "Personalizada");
      custom.value = "";
      presetSelect.append(custom);
      const presets = LabClocks.presets(this.device);
      for (const preset of presets) {
        const o = el("option", "", preset.name);
        o.value = preset.id;
        presetSelect.append(o);
        if (JSON.stringify(preset.config) === JSON.stringify(this.draft))
          presetSelect.value = preset.id;
      }
      presetSelect.onchange = () => {
        const preset = presets.find((p) => p.id === presetSelect.value);
        if (preset) this.configureDevice(preset.config);
      };
      presetLabel.append(presetSelect);
      controls.append(presetLabel);
      this.inputs = [];
      const grouped = new Map();
      for (const field of LabClocks.fields(this.device)) {
        const group = field.group || "Fontes e divisores";
        if (!grouped.has(group)) {
          const section = el("fieldset");
          section.append(el("legend", "", group));
          controls.append(section);
          grouped.set(group, section);
        }
        const label = el("label", "clock-field");
        label.append(el("span", "", field.label));
        const input = el(field.options ? "select" : "input");
        input.id = "clock-" + field.key;
        input.setAttribute("aria-label", field.label);
        if (field.options)
          for (const option of field.options) {
            const v = typeof option === "object" ? option.value : option;
            const o = el(
              "option",
              "",
              typeof option === "object"
                ? (option.label ?? String(v))
                : String(v),
            );
            o.value = v;
            input.append(o);
          }
        else {
          input.type = "number";
          input.step = field.step ?? "any";
          if (field.min !== undefined) input.min = field.min;
          if (field.max !== undefined) input.max = field.max;
        }
        input.value = this.draft[field.key] ?? "";
        input.addEventListener("input", () => {
          const initial = LabClocks.defaultConfig(this.device)[field.key];
          this.draft[field.key] =
            typeof initial === "number" && input.value !== ""
              ? Number(input.value)
              : input.value;
          this.update();
        });
        label.append(input);
        if (field.unit) label.append(el("small", "", field.unit));
        grouped.get(group).append(label);
        this.inputs.push({ field, input, label });
      }
      const buttons = el("div", "clock-actions");
      this.apply = el("button", "primary", "Aplicar configuração");
      this.apply.id = "clockApply";
      const reset = el("button", "", "Padrão do perfil");
      reset.type = "button";
      reset.onclick = () => {
        this.profiles[this.device.id] = LabClocks.defaultConfig(this.device);
        this.configureDevice();
        this.callbacks.onSave?.();
      };
      buttons.append(this.apply, reset);
      controls.append(buttons);
      controls.onsubmit = (e) => {
        e.preventDefault();
        const result = LabClocks.calculate(this.device, this.draft);
        if (!result.valid) return;
        this.profiles[this.device.id] = { ...this.draft };
        this.update();
        this.message.textContent =
          "Configuração aplicada ao projeto. Frequências calculadas; sem alterar a temporização da execução.";
        this.callbacks.onSave?.();
      };
      const view = el("div", "clock-view");
      this.metrics = el("div", "clock-metrics");
      this.graph = el("div", "clock-graph");
      this.graph.id = "clockGraph";
      this.message = el("div", "clock-status");
      this.message.id = "clockStatus";
      this.message.setAttribute("role", "status");
      this.validation = el("div", "clock-validation");
      this.refs = el("div", "clock-references");
      view.append(
        this.metrics,
        this.graph,
        this.message,
        this.validation,
        this.refs,
      );
      layout.append(controls, view);
      this.host.append(layout);
      this.update();
    }
    update() {
      for (const { field, input, label } of this.inputs) {
        const visible =
          !field.when ||
          Object.entries(field.when).every(
            ([key, value]) => this.draft[key] === value,
          );
        label.hidden = !visible;
        input.disabled = !visible;
      }
      const result = LabClocks.calculate(this.device, this.draft);
      this.apply.disabled = !result.valid;
      this.message.className =
        "clock-status " + (result.valid ? "valid" : "invalid");
      this.message.textContent = result.valid
        ? "Frequências dentro dos limites verificados. Aplique para salvar esta configuração."
        : "Configuração inválida. Corrija os valores indicados abaixo.";
      this.metrics.replaceChildren();
      for (const name of ["SYSCLK", "HCLK", "PCLK1", "PCLK2"])
        if (Number.isFinite(result.values?.[name])) {
          const card = el("div", "clock-metric");
          card.append(
            el("span", "", name),
            el("strong", "", hz(result.values[name])),
          );
          this.metrics.append(card);
        }
      this.validation.replaceChildren();
      for (const text of result.errors || [])
        this.validation.append(el("p", "error-note", text));
      for (const text of result.warnings || [])
        this.validation.append(el("p", "clock-warning", text));
      for (const text of result.notes || [])
        this.validation.append(el("p", "clock-note", text));
      this.refs.replaceChildren();
      for (const source of result.sources || []) {
        const url = typeof source === "string" ? source : source.url;
        if (!/^https:\/\//.test(url || "")) continue;
        const a = el(
          "a",
          "",
          typeof source === "string"
            ? "Referência do fabricante ↗"
            : source.label || source.title || "Referência ↗",
        );
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener";
        this.refs.append(a);
      }
      this.draw(result.nodes || []);
    }
    draw(nodes) {
      this.graph.replaceChildren();
      const map = new Map(nodes.map((n) => [n.id, n]));
      const levels = new Map();
      const visiting = new Set();
      const parents = (n) =>
        (Array.isArray(n.parent)
          ? n.parent
          : n.parent
            ? [n.parent]
            : []
        ).filter((id) => map.has(id));
      const depth = (id) => {
        if (levels.has(id)) return levels.get(id);
        if (visiting.has(id)) return 0;
        visiting.add(id);
        const ps = parents(map.get(id));
        const d = ps.length ? 1 + Math.max(...ps.map(depth)) : 0;
        visiting.delete(id);
        levels.set(id, d);
        return d;
      };
      nodes.forEach((n) => depth(n.id));
      const columns = [];
      nodes.forEach((n) => {
        const d = levels.get(n.id);
        (columns[d] ||= []).push(n);
      });
      const width = Math.max(850, columns.length * 186 + 24),
        height = Math.max(350, ...columns.map((a) => a.length * 94 + 40));
      const svg = svgEl("svg", {
        viewBox: `0 0 ${width} ${height}`,
        role: "img",
        "aria-label":
          "Árvore de clock com fontes, PLL, divisores e frequências calculadas",
      });
      svg.style.minWidth = width + "px";
      const positions = new Map();
      columns.forEach((group, col) =>
        group.forEach((n, row) =>
          positions.set(n.id, {
            x: 18 + col * 186,
            y: (height - group.length * 94) / 2 + row * 94,
          }),
        ),
      );
      for (const node of nodes)
        for (const parent of parents(node)) {
          const from = positions.get(parent),
            to = positions.get(node.id);
          const mid = (from.x + 158 + to.x) / 2;
          svg.append(
            svgEl("path", {
              d: `M${from.x + 158},${from.y + 34} H${mid} V${to.y + 34} H${to.x}`,
              class: "clock-wire" + (node.active === false ? " inactive" : ""),
            }),
          );
        }
      for (const node of nodes) {
        const p = positions.get(node.id);
        const group = svgEl("g", {
          transform: `translate(${p.x} ${p.y})`,
          class: "clock-node" + (node.active === false ? " inactive" : ""),
        });
        group.append(svgEl("rect", { width: 158, height: 72, rx: 10 }));
        group.append(
          svgEl(
            "text",
            { x: 12, y: 19, class: "clock-node-label" },
            node.label || node.id,
          ),
        );
        group.append(
          svgEl("text", { x: 12, y: 40, class: "clock-node-hz" }, hz(node.hz)),
        );
        const formula = String(node.formula || "");
        group.append(
          svgEl(
            "text",
            { x: 12, y: 58, class: "clock-node-formula" },
            formula.length > 27 ? formula.slice(0, 25) + "…" : formula,
          ),
        );
        group.append(
          svgEl(
            "title",
            {},
            [node.label, hz(node.hz), formula].filter(Boolean).join(" · "),
          ),
        );
        svg.append(group);
      }
      this.graph.append(svg);
    }
    serialize() {
      return {
        version: 1,
        profiles: JSON.parse(JSON.stringify(this.profiles)),
      };
    }
    restore(state) {
      this.profiles = {};
      if (
        state?.version === 1 &&
        state.profiles &&
        typeof state.profiles === "object"
      )
        for (const d of Object.values(DEVICES)) {
          const value = state.profiles[d.id];
          if (!value || typeof value !== "object") continue;
          const filtered = {};
          for (const field of LabClocks.fields(d))
            if (["string", "number"].includes(typeof value[field.key]))
              filtered[field.key] = value[field.key];
          const config = { ...LabClocks.defaultConfig(d), ...filtered };
          try {
            if (LabClocks.calculate(d, config).valid)
              this.profiles[d.id] = config;
          } catch {}
        }
      this.configureDevice();
    }
    render() {}
    afterReset() {}
  }
  root.LabClockPanel = LabClockPanel;
})(typeof globalThis !== "undefined" ? globalThis : window);
