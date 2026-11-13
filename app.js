/* Sistemas Embarcados · ELF74 — IDE de Assembly. GPL-2.0-or-later. */
"use strict";
const $ = (id) => document.getElementById(id);
const h = LAB.hex;
const colors = [
  "#38d7b4",
  "#58b1ff",
  "#b28cff",
  "#f4bd61",
  "#ff8591",
  "#66d9eb",
];
let lab, debug, project, built, examples;
let boardPanel,
  clockPanel,
  interruptPanel,
  startupPanel,
  placaPanel,
  instalacaoPanel,
  feedbackPanel,
  restoringSettings = false;
let activeWorkspace = "bench";
let running = false,
  timer = null,
  dirty = false,
  port = 0,
  memAddr = 0x20000000;
let prevRegs = {},
  frozen = null,
  viewEnd = null,
  cursors = [];
let triggerArmed = false,
  triggerAt = null,
  triggerPrevious = 0,
  editAction = null;
let channels = [],
  fileMode = "add",
  followRequested = false,
  avisoScope = "",
  rotaAutomatica = null,
  pinosBancada = [];
const STORAGE = "elf74-projeto";
const kb = (n) => (n / 1024).toLocaleString("pt-BR") + " KiB";
const pinName = (p, b) => "P" + (lab?.device.ports[p]?.name || "?") + b;
function element(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}
function action(label, fn, title = "") {
  const b = element("button", "", label);
  b.type = "button";
  b.onclick = guard(fn);
  b.title = title;
  return b;
}
function status(text, error = false) {
  $("status").textContent = text;
  $("status").parentElement.className =
    "statusbar" + (error ? " error" : running ? " running" : "");
}
function guard(fn) {
  return (...args) => {
    try {
      return fn(...args);
    } catch (error) {
      pause();
      status(error.message || String(error), true);
      if (lab) render();
    }
  };
}
function saveFile(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function download(name, data, type = "text/plain") {
  saveFile(name, new Blob([data], { type }));
}
function downloadZip(name, entries) {
  saveFile(name, new Blob([LabZip.make(entries)], { type: "application/zip" }));
}
function nomeArquivo() {
  return (
    project.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w.-]+/g, "-")
      .replace(/^-|-$/g, "") || "projeto"
  );
}
function nomeBase() {
  return nomeArquivo() + "-" + lab.device.id;
}
// Depois de um Build com erro (ou do fonte alterado) o binário na memória é velho.
function baixarBin() {
  if (!lab?.code || dirty) throw Error("Faça um Build sem erros primeiro.");
  download(nomeBase() + ".bin", lab.code, "application/octet-stream");
}
function baixarHex() {
  if (!lab?.code || dirty) throw Error("Faça um Build sem erros primeiro.");
  download(
    nomeBase() + ".hex",
    LabProject.toIntelHex(lab.code, lab.device.flashBase),
  );
}
function exportBuildFiles() {
  buildProject();
  baixarBin();
  setTimeout(guard(baixarHex), 300);
}
function pinoPorNome(nome) {
  return lab.device.accessiblePins.find((p) => p.name === nome);
}
function syncEditor() {
  if (project && project.files[project.activeFile] !== $("source").value)
    project.setSource(project.activeFile, $("source").value);
}
function save() {
  if (!project) return;
  syncEditor();
  if (!restoringSettings) project.labSettings = laboratorySettings();
  try {
    localStorage.setItem(STORAGE, JSON.stringify(project.toJSON()));
  } catch {
    status(
      "Armazenamento local indisponível. Use ↓ Projeto para guardar seus arquivos.",
    );
  }
}
function pause() {
  running = false;
  clearInterval(timer);
  timer = null;
  if (debug?.running) debug.pause();
  $("run").textContent = "▶ Executar";
  $("run").classList.remove("primary");
}
function markDirty(message = "Projeto alterado. Faça Build para executar.") {
  pause();
  dirty = true;
  $("sourceState").textContent = "Alterado · rebuild necessário";
  for (const id of ["run", "step", "stepOver", "stepOut", "runCursor"])
    $(id).disabled = true;
  status(message);
  save();
}
function cleanCapture() {
  frozen = null;
  viewEnd = null;
  cursors = [];
  triggerAt = null;
  triggerArmed = false;
  $("capture").textContent = "❚❚ Congelar";
  $("captureBadge").textContent = "Capturando";
  $("captureBadge").style.background = "";
  $("triggerStatus").textContent = "Tempo lógico · passos do motor";
}
function currentSourceLine() {
  return $("source").value.slice(0, $("source").selectionStart).split("\n")
    .length;
}
function sourceAddress(line = currentSourceLine()) {
  if (dirty || !built)
    throw Error("Faça Build antes de usar breakpoints na fonte.");
  const addr = project.addressForLine(project.activeFile, line);
  if (addr === null || addr === undefined)
    throw Error("Sem instrução mapeada nesta linha. Use o código de máquina.");
  return addr;
}
function toggleBreakpoint(address) {
  const existing = debug.breakpoints.find((b) => b.address === address);
  if (existing) debug.removeBreakpoint(existing.id);
  else debug.addBreakpoint({ address });
  renderBreakpoints();
  renderSourceLines();
  highlightAssembly();
}
function renderSourceLines() {
  const current = built?.sourceMap?.get(lab?.reg("PC"));
  const top = $("source").scrollTop;
  $("lines").replaceChildren();
  for (let line = 1; line <= $("source").value.split("\n").length; line++) {
    const b = action(
      String(line),
      () => toggleBreakpoint(sourceAddress(line)),
      "Alternar breakpoint nesta linha",
    );
    b.className = "source-line";
    b.dataset.line = line;
    if (!dirty && built) {
      const mapped = built.lineAddresses?.find(
        (x) => x.file === project.activeFile && x.line === line,
      );
      if (
        mapped &&
        debug.breakpoints.some((bp) => bp.address === mapped.address)
      )
        b.classList.add("has-bp");
    }
    if (current && current.file === project.activeFile && current.line === line)
      b.classList.add("executing");
    $("lines").append(b);
  }
  $("lines").scrollTop = top;
}
function renderProjectFiles() {
  $("projectName").value = project.name;
  $("fileTabs").replaceChildren();
  $("entryFile").replaceChildren();
  for (const name of Object.keys(project.files)) {
    const b = action(name, () => switchFile(name));
    b.className = "filetab" + (name === project.activeFile ? " active" : "");
    $("fileTabs").append(b);
    const o = element("option", "", name);
    o.value = name;
    $("entryFile").append(o);
  }
  $("entryFile").value = project.entryFile;
}
function switchFile(name, followLine = null) {
  syncEditor();
  project.setActive(name);
  $("source").value = project.files[name];
  renderProjectFiles();
  renderSourceLines();
  if (followLine) $("source").scrollTop = Math.max(0, (followLine - 6) * 22);
  $("lines").scrollTop = $("source").scrollTop;
  save();
}
function loadProject(p, abrirRelatorio = true) {
  if (!DEVICES[p.deviceId])
    throw Error("Dispositivo desconhecido no projeto: " + p.deviceId);
  pause();
  debug?.dispose();
  project = p;
  lab.selectDevice(project.deviceId);
  $("device").value = project.deviceId;
  debug = new LabDebugger(lab);
  debug.onStep = afterStep;
  for (const expr of ["R0", "R1", "SP", "mem32(0x20000000)"])
    debug.addWatch(expr);
  built = null;
  prevRegs = {};
  port = 0;
  avisoScope = "";
  memAddr = lab.device.ramBase;
  $("memAddress").value = "0x" + h(memAddr);
  $("source").value = project.files[project.activeFile];
  renderProjectFiles();
  configureDevice();
  restoringSettings = true;
  try {
    boardPanel?.restore(project.labSettings?.board);
    clockPanel?.restore(project.labSettings?.clocks);
    interruptPanel?.restore(project.labSettings?.interrupts);
  } finally {
    restoringSettings = false;
  }
  cleanCapture();
  buildProject(abrirRelatorio);
}
function laboratorySettings() {
  return {
    board: boardPanel?.serialize() || null,
    clocks: clockPanel?.serialize() || null,
    interrupts: interruptPanel?.serialize() || null,
  };
}
function restoreLaboratoryDefaults() {
  boardPanel?.afterReset();
  marcarBancada();
  interruptPanel?.afterReset();
}
// Botões e chaves da aba Chip & conexões dirigem o pino (o pull não vale ali);
// um componente removido solta o pino.
function marcarBancada() {
  if (!lab || !boardPanel?.profile) return;
  const nomes = boardPanel.profile.components
    .filter((c) => c.type !== "led")
    .map((c) => c.pin);
  for (const nome of pinosBancada) {
    const p = pinoPorNome(nome);
    if (p && !nomes.includes(nome)) lab.release(p.port, p.bit);
  }
  for (const nome of nomes) {
    const p = pinoPorNome(nome);
    if (p) lab.hold(p.port, p.bit);
  }
  pinosBancada = nomes;
}
function showWorkspace(name, refresh = true) {
  activeWorkspace = name;
  for (const item of ["bench", "board", "clock", "interrupts", "startup", "placa", "instalacao", "feedback"])
    $(item + "Panel").hidden = item !== name;
  document.querySelectorAll("[data-workspace]").forEach((button) => {
    const selected = button.dataset.workspace === name;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  if (name === "placa") placaPanel?.atualizarPrograma();
  if (refresh && lab && debug) render();
}
function initializeLaboratory() {
  boardPanel = new LabBoard($("boardPanel"), lab, {
    onChange: () => {
      marcarBancada();
      render();
    },
    onPause: pause,
    onSave: () => {
      if (!restoringSettings) save();
    },
    onScope: (p, b) => {
      channels[0] = { p, b };
      const channel = $("channelLabels").querySelector("select");
      if (channel) channel.value = p * 16 + b;
      triggerArmed = false;
      showWorkspace("bench");
      drawScope();
    },
    onDemo: () => {
      $("examples").value = "mirror";
      $("loadExample").click();
      // O botão virtual comanda PB0; o gerador teria prioridade sobre ele.
      $("genEnabled").checked = false;
      updateGenerator();
      showWorkspace("board");
    },
  });
  clockPanel = new LabClockPanel($("clockPanel"), lab, {
    onSave: () => {
      if (!restoringSettings) save();
    },
  });
  interruptPanel = new LabInterruptPanel($("interruptsPanel"), lab, {
    onChange: () => render(),
    onPause: pause,
    resolve: (expression) => debug.resolveAddress(expression),
    onSave: () => {
      if (!restoringSettings) save();
    },
    onDemo: () => {
      $("examples").value = "interrupt";
      $("loadExample").click();
      showWorkspace("interrupts");
    },
  });
  startupPanel = new LabStartupPanel($("startupPanel"), lab, {
    download,
    downloadZip,
    addFile: (name, source) => {
      syncEditor();
      project.addFile(name, source);
      $("source").value = project.files[project.activeFile];
      renderProjectFiles();
      renderSourceLines();
      markDirty();
      save();
    },
  });
  placaPanel = new LabPlacaPanel($("placaPanel"), lab, {
    build: () => {
      buildProject();
      const imagem = LabBoardImage.build(lab, project);
      $("buildOutput").textContent +=
        "\nimagem da placa: " +
        imagem.image.length +
        " bytes · vetores em 0x" +
        h(imagem.base) +
        " · programa em 0x" +
        h(imagem.codeBase) +
        " (" +
        imagem.codeSize +
        " bytes)";
      return imagem;
    },
    resolve: (expression) => debug.resolveAddress(expression),
    exemplos: () =>
      Object.entries(examples || {}).map(([key, ex]) => ({ key, name: ex.name })),
    exemploAtual: () => $("examples").value,
    carregar: (key) => {
      $("examples").value = key;
      $("loadExample").click();
    },
    programa: () =>
      project && {
      nome: project.name,
      entrada: project.entryFile,
      bytes: built && !dirty ? lab.code.length : 0,
    },
    editar: () => {
      showWorkspace("bench");
      document.querySelector(".editor-panel")?.scrollIntoView({ block: "start" });
    },
  });
  instalacaoPanel = new LabInstalacaoPanel($("instalacaoPanel"));
  feedbackPanel = new LabFeedbackPanel($("feedbackPanel"), {
    micro: () => $("device").selectedOptions[0]?.textContent.trim(),
  });
}
document
  .querySelectorAll("[data-workspace]")
  .forEach(
    (button) =>
      (button.onclick = () => showWorkspace(button.dataset.workspace)),
  );
function deviceSymbols(sourceSymbols = {}) {
  const symbols = { ...sourceSymbols };
  for (let i = 0; i < lab.device.ports.length; i++) {
    const p = lab.device.ports[i];
    symbols["GPIO" + p.name] = p.base;
    for (const r of lab.getPeripheralRegisters(i))
      symbols["GPIO" + p.name + "_" + r.name] = r.address;
  }
  symbols.FLASH_BASE = lab.device.flashBase;
  symbols.SRAM_BASE = lab.device.ramBase;
  return symbols;
}
function arquivosDoBuild() {
  try {
    return [...new Set(project.sourceForBuild().lines.map((l) => l.file))];
  } catch {
    return [project.entryFile];
  }
}
function conferirHex(texto, total) {
  const linhas = texto.trim().split("\n");
  let dados = 0,
    registros = 0,
    soma = true;
  for (const linha of linhas) {
    const bytes = linha
      .slice(1)
      .match(/../g)
      .map((x) => parseInt(x, 16));
    if (bytes.reduce((a, b) => a + b, 0) & 255) soma = false;
    if (bytes[3] === 0) {
      dados += bytes[0];
      registros++;
    }
  }
  return { linhas: linhas.length, registros, ok: soma && dados === total };
}
function cabecalhoBuild(arquivos) {
  const d = lab.device;
  return [
    "Build do alvo '" + d.name + "' (" + d.core + " · " + d.package + ")",
    "Projeto: " + project.name + " · entrada " + project.entryFile,
    ...arquivos.map((nome) => "montando " + nome + "..."),
  ];
}
function relatorioBuild(start, arquivos) {
  const d = lab.device,
    tamanho = lab.code.length,
    base = nomeBase();
  const hex = LabProject.toIntelHex(lab.code, d.flashBase);
  const conferido = conferirHex(hex, tamanho);
  const ram = Object.entries(built.symbols || {}).filter(
    ([, v]) => v >= d.ramBase && v < d.ramBase + d.ramSize,
  );
  const avisos = (built.diagnostics || []).filter(
    (x) => x.level === "warning",
  );
  const infos = (built.diagnostics || []).filter((x) => x.level !== "warning");
  const fora = Object.keys(project.files).filter((n) => !arquivos.includes(n));
  return [
    ...cabecalhoBuild(arquivos),
    ...(fora.length ? ["fora do build (sem .include): " + fora.join(", ")] : []),
    "gerando a imagem (link)... Flash em 0x" + h(d.flashBase),
    "Tamanho do programa: Flash = " +
      tamanho +
      " bytes (0x" +
      h(d.flashBase) +
      "–0x" +
      h(d.flashBase + tamanho - 1) +
      ", " +
      ((tamanho * 100) / d.flashSize < 0.01
        ? "< 0,01"
        : ((tamanho * 100) / d.flashSize).toLocaleString("pt-BR", {
            maximumFractionDigits: 2,
          })) +
      "% de " +
      kb(d.flashSize) +
      ")",
    "RAM: " +
      (ram.length
        ? "símbolos na SRAM " +
          ram.map(([n, v]) => n + " = 0x" + h(v)).join(", ")
        : "nenhum dado estático (o montador gera só a imagem da Flash)") +
      "; pilha (MSP) começa em 0x" +
      h(d.ramBase + d.ramSize) +
      ", topo da SRAM de " +
      kb(d.ramSize),
    "Itens na desmontagem (inclui dados): " + built.listing.length,
    "criando " + base + ".bin... " + tamanho + " bytes",
    "criando " +
      base +
      ".hex... " +
      conferido.linhas +
      " registros Intel HEX (" +
      conferido.registros +
      " de dados) · " +
      (conferido.ok ? "conferido" : "FALHA NA CONFERÊNCIA"),
    ".bin/.hex = imagem do simulador, sem tabela de vetores; para gravar na placa use a aba Placa real",
    ...infos.map((x) => "info: " + (x.message || x)),
    ...avisos.map((x) => "aviso: " + (x.message || x)),
    '"' +
      project.name +
      '" - 0 erro(s), ' +
      avisos.length +
      " aviso(s).",
    "Tempo do build: " + Math.round(performance.now() - start) + " ms",
  ].join("\n");
}
// Erro de montagem: aponta arquivo, linha e o texto da linha.
function erroDeBuild(error) {
  const message = error.message || String(error);
  const doProjeto = /^(.+?):(\d+): (.*)$/.exec(message);
  if (doProjeto && Object.hasOwn(project.files, doProjeto[1])) {
    const [, file, linha, resto] = doProjeto;
    return {
      message: file + "(" + linha + "): erro: " + resto,
      file,
      line: +linha,
      text: (project.files[file].split("\n")[linha - 1] || "").trim(),
    };
  }
  if (!message.startsWith("Assembly inválido")) return { message };
  try {
    const lines = project.sourceForBuild().lines;
    const found = lab.locateError(lines.map((l) => l.text));
    const item = found && lines[found.index];
    if (item)
      return {
        message: item.file + "(" + item.line + "): erro: " + found.message,
        file: item.file,
        line: item.line,
        text: item.text.trim(),
      };
  } catch {}
  return { message };
}
function buildProject(abrirRelatorio = true) {
  pause();
  syncEditor();
  const start = performance.now();
  const arquivos = arquivosDoBuild();
  try {
    built = project.build(lab);
    debug.reset();
    debug.setSymbols(deviceSymbols(built.symbols));
    restoreLaboratoryDefaults();
    /* Device symbols keep memory expressions available in source and binary mode. */
    dirty = false;
    prevRegs = {};
    cleanCapture();

    $("sourceState").textContent = built.exactMapping
      ? "Build OK · fonte e símbolos mapeados"
      : "Build OK · depure na desmontagem";
    $("byteCount").textContent = lab.code.length + " B";
    for (const id of [
      "run",
      "step",
      "stepOver",
      "stepOut",
      "runCursor",
      "reset",
    ])
      $(id).disabled = false;
    $("buildOutput").textContent = relatorioBuild(start, arquivos);
    $("buildOutput").classList.remove("falhou");
    renderListing(built.listing);
    renderSourceLines();
    save();
    if (abrirRelatorio) showBottom("build", false);
    render();
    status(
      "Build concluído · " + lab.code.length + " bytes · " + lab.device.name,
    );
  } catch (error) {
    dirty = true;
    for (const id of ["run", "step", "stepOver", "stepOut", "runCursor"])
      $(id).disabled = true;
    const erro = erroDeBuild(error);
    $("buildOutput").textContent = [
      ...cabecalhoBuild(arquivos),
      erro.message,
      ...(erro.text ? ["    " + erro.line + " | " + erro.text] : []),
      "Alvo não criado: nenhum .bin ou .hex gerado.",
      '"' + project.name + '" - 1 erro(s), 0 aviso(s).',
      "Tempo do build: " + Math.round(performance.now() - start) + " ms",
    ].join("\n");
    $("buildOutput").classList.add("falhou");
    showBottom("build");
    if (erro.file && Object.hasOwn(project.files, erro.file)) {
      switchFile(erro.file, erro.line);
      const linhas = $("source").value.split("\n");
      let inicio = 0;
      for (let i = 0; i < erro.line - 1; i++) inicio += linhas[i].length + 1;
      $("source").setSelectionRange(
        inicio,
        inicio + (linhas[erro.line - 1] || "").length,
      );
    }
    throw erro.file ? Error(erro.message + " · " + erro.text) : error;
  }
}
function configureDevice() {
  const d = lab.device;
  boardPanel?.configureDevice();
  clockPanel?.configureDevice();
  interruptPanel?.configureDevice();
  startupPanel?.configureDevice();
  placaPanel?.configureDevice();
  // selectDevice já soltou todos os pinos do micro.
  pinosBancada = [];
  examples = examplesForDevice(d);
  $("examples").replaceChildren();
  for (const [key, ex] of Object.entries(examples)) {
    const o = element("option", "", ex.name);
    o.value = key;
    if (ex.requiresModel > d.model) {
      o.disabled = true;
      o.textContent += ex.painelFpu
        ? " (requer FPU · Cortex-M4F)"
        : " (requer Cortex-M4)";
    }
    $("examples").append(o);
  }
  placaPanel?.atualizarPrograma();
  const pins = d.ports.flatMap((p, i) => p.pins.map((b) => ({ p: i, b })));
  channels = [
    0,
    1,
    2,
    3,
    Math.min(d.ports[0].pins.length, pins.length - 1),
    pins.length - 1,
  ].map((i) => ({ ...pins[i] }));
  $("targetName").textContent = d.name;
  $("targetSummary").textContent = [
    d.core,
    d.package,
    kb(d.flashSize) + " Flash",
    kb(d.ramSize) + " SRAM",
    pins.length + " GPIO",
  ].join(" · ");
  $("memorySummary").textContent =
    kb(d.flashSize) +
    " Flash · " +
    kb(d.ramSize) +
    " SRAM · " +
    pins.length +
    " GPIO";
  $("portSelector").replaceChildren();
  $("peripheralPort").replaceChildren();
  d.ports.forEach((p, i) => {
    const b = action("P" + p.name, () => {
      port = i;
      renderPins();
    });
    b.dataset.port = i;
    $("portSelector").append(b);
    const o = element("option", "", "GPIO " + p.name);
    o.value = i;
    $("peripheralPort").append(o);
  });
  const pinOptions = () =>
    pins.map((c) => {
      const o = element("option", "", pinName(c.p, c.b));
      o.value = c.p * 16 + c.b;
      return o;
    });
  for (const id of ["genPin", "wireFrom", "wireTo"])
    $(id).replaceChildren(...pinOptions());
  $("genPin").value = channels[4].p * 16 + channels[4].b;
  $("wireTo").value = channels[4].p * 16 + Math.min(channels[4].b + 1, 7);
  $("genEnabled").checked = false;
  $("wireEnabled").checked = false;
  $("channelLabels").replaceChildren();
  channels.forEach((ch, i) => {
    const select = element("select");
    select.setAttribute("aria-label", "Canal " + (i + 1));
    select.style.color = colors[i];
    select.replaceChildren(...pinOptions());
    select.value = ch.p * 16 + ch.b;
    select.onchange = () => {
      const n = +select.value;
      channels[i] = { p: Math.floor(n / 16), b: n % 16 };
      triggerArmed = false;
      drawScope();
    };
    $("channelLabels").append(select);
  });
  $("memoryMap").replaceChildren(element("h3", "", "Mapa de memória"));
  for (const region of lab.getMemoryRegions()) {
    const base = region.base ?? region.start ?? region.address;
    const b = action("", () => goMem(base));
    const span = element("span", "", region.name);
    span.append(
      element("small", "", h(base) + " – " + h(base + region.size - 1)),
    );
    b.append(
      element(
        "i",
        region.name.toLowerCase().includes("flash") ? "flash" : "ram",
      ),
      span,
      element("em", "", region.access || "RW"),
    );
    $("memoryMap").append(b);
  }
  $("terminalPanel").querySelector(".terminaltop span").textContent =
    d.uart.name + " · " + d.uart.description;
  $("terminalPanel").querySelector("small").textContent =
    "Execute e digite em RX → Enviar; o eco volta aqui. Base 0x" +
    h(d.uart.base) +
    " · DR +0x" +
    h(d.uart.dataOffset, 2) +
    " · Status +0x" +
    h(d.uart.statusOffset, 2) +
    ". No analisador, " +
    d.uart.tx +
    " (TX) e " +
    d.uart.rx +
    " (RX) mostram a linha 8N1 com " +
    LAB.PASSOS_BIT +
    " passos por bit (sem baud rate real).";
  $("exampleDescription").textContent =
    "Exemplos adaptados a " +
    d.name +
    ". Carregue um exemplo ou mantenha seus arquivos e ajuste os endereços.";
}
function atualizarCanais() {
  channels.forEach((ch, i) => {
    const select = $("channelLabels").children[i];
    if (select) select.value = ch.p * 16 + ch.b;
  });
}
function renderListing(listing) {
  $("disasm").replaceChildren();
  for (const ins of listing.slice(0, 12000)) {
    const row = element("div", "asmrow");
    row.dataset.addr = ins.address;
    const bp = action(
      h(ins.address),
      () => toggleBreakpoint(ins.address),
      "Breakpoint em 0x" + h(ins.address),
    );
    row.append(
      bp,
      element("span", "bytes", ins.bytes.map((b) => h(b, 2)).join(" ")),
      element("span", "", ins.mnemonic + " " + ins.op),
    );
    const source = built?.sourceMap?.get(ins.address);
    if (source) row.title = source.file + ":" + source.line;
    row.ondblclick = guard(() => startExecution("runto", ins.address));
    $("disasm").append(row);
  }
}
function highlightAssembly() {
  const pc = lab.reg("PC");
  for (const row of $("disasm").children) {
    const address = Number(row.dataset.addr);
    row.classList.toggle("current", address === pc);
    row.classList.toggle(
      "bp",
      debug.breakpoints.some((b) => b.address === address && b.enabled),
    );
  }
  const location = built?.sourceMap?.get(pc);
  $("sourceLocation").textContent = location
    ? location.file + ":" + location.line
    : "";
  if (followRequested && $("followPC").checked && location && !dirty) {
    if (project.activeFile !== location.file)
      switchFile(location.file, location.line);
    const y = (location.line - 1) * 22;
    if (
      y < $("source").scrollTop ||
      y > $("source").scrollTop + $("source").clientHeight - 44
    )
      $("source").scrollTop = Math.max(0, y - 100);
    $("lines").scrollTop = $("source").scrollTop;
  }
  if (followRequested && !$("machinePane").hidden) {
    const row = $("disasm").querySelector(".current");
    if (row)
      $("machinePane").scrollTop = Math.max(
        0,
        row.offsetTop - $("machinePane").offsetTop - 100,
      );
  }
  followRequested = false;
  const old = $("lines").querySelector(".executing");
  if (old) old.classList.remove("executing");
  if (location?.file === project.activeFile)
    $("lines")
      .querySelector(`[data-line="${location.line}"]`)
      ?.classList.add("executing");
}
function afterStep() {
  followRequested = true;
  if (!triggerArmed) return;
  const ch = channels[0],
    current = (lab.ports[ch.p].pins >>> ch.b) & 1;
  if (
    triggerAt === null &&
    (($("trigger").value === "rise" && !triggerPrevious && current) ||
      ($("trigger").value === "fall" && triggerPrevious && !current))
  ) {
    triggerAt = lab.t;
    $("triggerStatus").textContent =
      "Trigger em " + triggerAt + " · pós-trigger";
  }
  triggerPrevious = current;
  if (triggerAt !== null && lab.t >= triggerAt + 64) {
    freeze();
    triggerArmed = false;
    $("triggerStatus").textContent = "Disparado em " + triggerAt + " passos";
  }
}
function startExecution(mode = "run", target = null) {
  if (dirty) throw Error("Faça Build para executar suas alterações.");
  if (running && mode === "run") {
    pause();
    render();
    status("Execução pausada.");
    return;
  }
  pause();
  debug.start(mode, target);
  running = true;
  $("run").textContent = "❚❚ Pausar";
  $("run").classList.add("primary");
  status("Executando · " + mode + " · " + lab.device.name);
  timer = setInterval(
    guard(() => {
      const result = debug.runSlice(Number($("speed").value));
      if (result.stopped) {
        pause();
        status(
          result.reason,
          result.kind === "fault" || result.kind === "expression-error",
        );
      }
      render();
    }),
    33,
  );
}
function singleStep() {
  if (dirty) throw Error("Faça Build antes de avançar.");
  pause();
  const result = debug.step();
  render();
  status(result.reason, result.kind === "fault");
}
function resetCPU() {
  pause();
  lab.reset();
  debug.reset();
  restoreLaboratoryDefaults();
  cleanCapture();
  prevRegs = {};
  followRequested = true;
  render();
  status(
    "CPU, memória e trace reiniciados. Projeto e breakpoints preservados.",
  );
}
function format(value) {
  return $("regFormat").value === "hex"
    ? h(value)
    : $("regFormat").value === "signed"
      ? String(value | 0)
      : String(value >>> 0);
}
function askEdit(title, value, fn) {
  pause();
  editAction = fn;
  $("editTitle").textContent = title;
  $("editValue").value = value;
  $("editValue").setCustomValidity("");
  $("editDialog").showModal();
  $("editValue").focus();
  $("editValue").select();
}
function regRow(name, value) {
  const row = element(
    "div",
    "regrow" +
      (prevRegs[name] !== undefined && prevRegs[name] !== value
        ? " changed"
        : "") +
      (name === "PC" ? " pc" : ""),
  );
  row.append(element("span", "", name), element("strong", "", format(value)));
  row.title = "Duplo clique para editar " + name;
  row.ondblclick = () =>
    askEdit(name, "0x" + h(value), (v) => {
      lab.setReg(name, v);
      lab.halted = false;
      render();
    });
  return row;
}
function renderRegs() {
  const r = lab.registers();
  $("regs").replaceChildren(
    ...[...Array.from({ length: 13 }, (_, i) => "R" + i), "SP", "LR", "PC"].map(
      (n) => regRow(n, r[n]),
    ),
  );
  $("specialRegs").replaceChildren(
    ...[
      "MSP",
      "PSP",
      "XPSR",
      "CONTROL",
      "PRIMASK",
      "BASEPRI",
      "FAULTMASK",
      "IPSR",
      "FPSCR",
    ].map((n) => regRow(n, r[n])),
  );
  $("flags").replaceChildren(
    ...["N", "Z", "C", "V", "Q"].map((n, i) => {
      const v = (r.XPSR >>> (31 - i)) & 1,
        box = element("div", "flag" + (v ? " on" : ""), n);
      box.append(element("b", "", v));
      return box;
    }),
  );
  if ($("fpuRegs").parentElement.open) {
    $("fpuRegs").replaceChildren();
    for (let i = 0; i < 32; i++) {
      const row = element("div", "regrow");
      row.append(
        element("span", "", "S" + i),
        element(
          "strong",
          "",
          lab.model === 8
            ? "—"
            : Number(lab.e.reg_read_float(lab.u.ARM_REG_S0 + i)).toPrecision(7),
        ),
      );
      $("fpuRegs").append(row);
    }
  }
  prevRegs = r;
  $("pcLabel").textContent = "PC 0x" + h(r.PC);
  highlightAssembly();
}
function renderPins() {
  const p = lab.ports[port],
    profile = lab.device.ports[port];
  const key = lab.device.id + ":" + port;
  if ($("pins").dataset.profile !== key) {
    $("pins").replaceChildren();
    $("pins").dataset.profile = key;
    for (let i = 0; i < profile.width; i++) {
      // Entrada: alterna a partir do nível lido (pode estar em 1 pelo pull-up).
      const b = action("", () => {
        const nivel =
          lab.pinMode(port, i) === 0 ? lab.ports[port].pins : lab.manual[port];
        lab.input(port, i, !((nivel >>> i) & 1));
        render();
      });
      b.oncontextmenu = guard((e) => {
        e.preventDefault();
        lab.release(port, i);
        render();
        status(
          pinName(port, i) +
            " solto: sem nada ligado, a entrada lê o pull do programa (ou 0).",
        );
      });
      b.append(
        element("b", "", pinName(port, i)),
        element("span", "level"),
        element("small"),
      );
      $("pins").append(b);
    }
  }
  const g = lab.generator,
    w = lab.wire;
  for (let i = 0; i < profile.width; i++) {
    const mode = lab.pinMode(port, i),
      high = (p.pins >>> i) & 1;
    const externo =
      (lab.driven[port] >>> i) & 1 ||
      (g.enabled && g.port === port && g.pin === i) ||
      (w.enabled && w.to === port && w.tp === i);
    const pull = mode === 0 && !externo ? lab.pullLevel(port, i) : null;
    const b = $("pins").children[i];
    b.className =
      "pin" +
      (high ? " high" : "") +
      (mode === 1 ? " output" : "") +
      (mode === 4 ? " unavailable" : "");
    b.disabled = mode === 1 || mode === 2 || mode === 4;
    b.children[1].textContent = mode === 4 ? "—" : high;
    b.children[2].textContent =
      (["IN", "OUT", "AF —", "AN —", "N/C"][mode] || "OFF") +
      (pull === 1 ? " ↑" : pull === 0 ? " ↓" : "");
    b.title =
      mode === 4
        ? "Pino não disponível neste encapsulamento"
        : mode === 0
          ? (pull === 1
              ? "Solto: lê 1 pelo pull-up. "
              : pull === 0
                ? "Solto: lê 0 pelo pull-down. "
                : "") +
            "Clique alterna o nível externo; botão direito solta o pino. Gerador/ligação têm prioridade"
          : mode === 3
            ? "Sem função digital (DEN = 0 ou analógico): o clique guarda o nível externo para quando o programa habilitar a entrada"
            : "Configuração definida pelo programa";
  }
  for (const b of $("portSelector").children)
    b.classList.toggle("active", +b.dataset.port === port);
  $("portValues").textContent =
    "GPIO" +
    profile.name +
    " @ " +
    h(profile.base) +
    "   IN " +
    h(p.idr, 4) +
    "   OUT " +
    h(p.odr, 4);
}
function goMem(address) {
  if (!Number.isInteger(address) || address < 0 || address > 0xffffffff)
    throw Error("Endereço inválido.");
  memAddr = (address & ~15) >>> 0;
  $("memAddress").value = "0x" + h(memAddr);
  renderMemory();
}
function renderMemory() {
  if ($("memoryPanel").hidden) return;
  const box = $("hexView");
  box.replaceChildren();
  try {
    const bytes = lab.memory(memAddr, 128);
    for (let r = 0; r < 8; r++) {
      const row = element("div", "hexrow");
      row.append(element("span", "", h(memAddr + r * 16)));
      for (let c = 0; c < 16; c++) {
        const offset = r * 16 + c,
          b = action(h(bytes[offset], 2), () => {});
        b.className = "byte" + (bytes[offset] ? " nonzero" : "");
        b.title = "0x" + h(memAddr + offset) + " · " + bytes[offset];
        b.ondblclick = () =>
          askEdit(
            "Byte em 0x" + h(memAddr + offset),
            "0x" + h(bytes[offset], 2),
            (v) => {
              if (v < 0 || v > 255)
                throw Error("Byte deve estar entre 0 e 255.");
              lab.editMemory(memAddr + offset, v);
              render();
            },
          );
        row.append(b);
      }
      row.append(
        element(
          "span",
          "ascii",
          bytes
            .slice(r * 16, r * 16 + 16)
            .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : "."))
            .join(""),
        ),
      );
      box.append(row);
    }
  } catch {
    box.textContent = "Região não mapeada. Selecione um endereço do mapa.";
  }
  const sp = lab.reg($("stackSelect").value),
    low = lab.device.ramBase,
    high = low + lab.device.ramSize;
  const start = Math.min(high - 32, Math.max(low, sp - 8)) & ~3;
  $("stack").replaceChildren();
  for (let i = 0; i < 8; i++) {
    const a = start + i * 4,
      row = element("div", "stackrow" + (a === sp ? " top" : ""));
    let value = "—";
    try {
      value = h(lab.word(a));
    } catch {}
    row.append(
      element("span", "", (a === sp ? "→ " : "  ") + h(a)),
      element("span", "", value),
    );
    $("stack").append(row);
  }
  if (sp === high)
    $("stack").append(
      element("div", "stackrow top", "→ " + h(sp) + " · pilha vazia"),
    );
  if (sp < low || sp > high)
    $("stack").prepend(
      element("div", "error-note", "SP fora da SRAM principal: " + h(sp)),
    );
}
function renderWatches() {
  $("watchList").replaceChildren();
  for (const w of debug.watchValues()) {
    const row = element("div", "watchrow" + (w.changed ? " changed" : ""));
    row.append(
      element("code", "", w.expression),
      element(
        "span",
        w.error ? "error-note" : "",
        w.error || w.hex + " · " + w.value,
      ),
      action("×", () => {
        debug.removeWatch(w.id);
        renderWatches();
      }),
    );
    $("watchList").append(row);
  }
}
function breakpointRow(entry, type) {
  const row = element("div", "breakrow"),
    enabled = element("input");
  enabled.type = "checkbox";
  enabled.checked = entry.enabled;
  enabled.onchange = () => {
    entry.enabled = enabled.checked;
    highlightAssembly();
  };
  row.append(
    enabled,
    element("code", "", "0x" + h(entry.address)),
    element(
      "span",
      "",
      type === "bp"
        ? (entry.condition || "sempre") +
            " · " +
            entry.hits +
            "/" +
            entry.hitTarget
        : entry.access + " · " + entry.size + " B · " + entry.hits + " hits",
    ),
    action("×", () => {
      if (type === "bp") debug.removeBreakpoint(entry.id);
      else debug.removeWatchpoint(entry.id);
      renderBreakpoints();
      renderSourceLines();
      highlightAssembly();
    }),
  );
  return row;
}
function renderBreakpoints() {
  $("breakList").replaceChildren(
    ...debug.breakpoints.map((b) => breakpointRow(b, "bp")),
  );
  $("dataBreakList").replaceChildren(
    ...debug.watchpoints.map((b) => breakpointRow(b, "data")),
  );
}
function renderPeripherals() {
  if ($("peripheralsPanel").hidden) return;
  const index = Number($("peripheralPort").value),
    p = lab.device.ports[index];
  $("peripheralBase").textContent = "0x" + h(p.base);
  $("pinoutLegend").textContent =
    lab.device.package +
    " · pinos: " +
    p.pins.map((b) => "P" + p.name + b).join(", ") +
    ". " +
    lab.device.clockPolicy +
    " " +
    lab.device.resetPolicy;
  const table = element("table", "peripheral-table");
  const head = element("tr");
  for (const t of ["Registrador", "Endereço", "Valor", "Bits 31…0", "Acesso"])
    head.append(element("th", "", t));
  table.append(head);
  for (const reg of lab.getPeripheralRegisters(index)) {
    const tr = element("tr");
    const value = reg.value >>> 0;
    tr.append(
      element("td", "", reg.name),
      element("td", "mono", h(reg.address)),
    );
    const cell = element("td", "regvalue", h(value));
    const writable = reg.access !== "RO" && reg.access !== "R";
    if (writable)
      cell.ondblclick = () =>
        askEdit(reg.name + " · 0x" + h(reg.address), "0x" + h(value), (v) => {
          lab.writePeripheral(reg.address, v);
          render();
        });
    tr.append(cell);
    const bits = element("td", "bitcells");
    for (let bit = 31; bit >= 0; bit--) {
      const b = action(
        String((value >>> bit) & 1),
        () => {
          pause();
          lab.writePeripheral(reg.address, (value ^ (1 << bit)) >>> 0);
          render();
        },
        "Bit " + bit,
      );
      b.classList.toggle("set", !!((value >>> bit) & 1));
      b.disabled = !writable;
      bits.append(b);
    }
    tr.append(bits, element("td", "", reg.access || "RW"));
    table.append(tr);
  }
  $("peripheralRegisters").replaceChildren(table);
}
function renderTrace() {
  if ($("tracePanel").hidden) return;
  $("callStack").replaceChildren();
  if (!debug.callStack.length)
    $("callStack").textContent = "Sem sub-rotina ativa observada.";
  for (const f of [...debug.callStack].reverse()) {
    $("callStack").append(
      element(
        "div",
        "callframe",
        (f.label || "0x" + h(f.target)) +
          " ← " +
          h(f.from) +
          " · retorno " +
          h(f.returnAddress),
      ),
    );
  }
  const count = debug.coverage.size,
    total = lab.listing?.length || 0;
  $("coverageSummary").textContent =
    count +
    " endereços executados / " +
    total +
    " itens desmontados · não representa cobertura de ramos.";
  $("coverageList").replaceChildren();
  for (const [address, hits] of [...debug.coverage]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 16)) {
    $("coverageList").append(
      element(
        "div",
        "coverrow",
        h(address) + "  " + (debug.symbolFor(address) || "") + "  × " + hits,
      ),
    );
  }
  $("instructionTrace").replaceChildren();
  for (const t of debug.trace.slice(-100).reverse()) {
    const row = element("div", "tracerow");
    row.append(
      element("span", "", t.step),
      element("code", "", h(t.pc)),
      element("span", "", t.instruction),
      element(
        "small",
        "",
        Object.entries(t.changed)
          .map(([n, v]) => n + "=" + h(v.after))
          .join(" "),
      ),
    );
    $("instructionTrace").append(row);
  }
}
function render() {
  if (!lab || !debug) return;
  $("ticks").textContent = lab.t.toLocaleString("pt-BR") + " passos";
  renderRegs();
  renderPins();
  renderMemory();
  drawScope();
  renderPeripherals();
  renderTrace();
  if (activeWorkspace === "board") boardPanel?.render();
  if (activeWorkspace === "interrupts") interruptPanel?.render();
  if (!$("debugPanel").hidden) {
    renderWatches();
    renderBreakpoints();
  }
  $("rxBadge").textContent = lab.rxPendente
    ? "(" + lab.rxPendente + " RX)"
    : "";
  if (!$("terminalPanel").hidden) {
    $("terminalOutput").textContent = new TextDecoder().decode(
      Uint8Array.from(lab.tx, (c) => c.charCodeAt(0)),
    );
    $("terminalOutput").scrollTop = $("terminalOutput").scrollHeight;
  }
  if (!$("eventsPanel").hidden) {
    $("eventLog").replaceChildren();
    if (!lab.events.length)
      $("eventLog").textContent = "Nenhum evento de entrada/transmissão.";
    for (const ev of lab.events) {
      const d = element("div");
      d.append(
        element("b", "", ev.t + " passos"),
        document.createTextNode(ev.text),
      );
      $("eventLog").append(d);
    }
  }
}
function showBottom(name, trocarArea = true) {
  if (trocarArea) showWorkspace("bench", false);
  document
    .querySelectorAll("[data-bottom]")
    .forEach((b) => b.classList.toggle("active", b.dataset.bottom === name));
  for (const n of [
    "memory",
    "terminal",
    "events",
    "debug",
    "peripherals",
    "trace",
    "build",
  ])
    $(n + "Panel").hidden = n !== name;
  if (lab && debug) render();
}
function freeze() {
  frozen = lab.trace.map((s) => ({ t: s.t, v: [...s.v] }));
  viewEnd = frozen.at(-1)?.t || 0;
  $("capture").textContent = "▶ Ao vivo";
  $("captureBadge").textContent = "Congelado";
  $("captureBadge").style.background = "#fff2d9";
}
function captureData() {
  return frozen || lab?.trace || [];
}
function drawScope() {
  if (!lab || channels.length !== 6) return;
  let canvas = $("scope"),
    rect = canvas.getBoundingClientRect();
  if (!rect.width) return;
  let dpr = devicePixelRatio || 1,
    w = rect.width,
    height = rect.height;
  if (
    canvas.width !== Math.round(w * dpr) ||
    canvas.height !== Math.round(height * dpr)
  ) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(height * dpr);
  }
  let ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, height);
  let data = captureData(),
    win = Number($("scopeWindow").value),
    end = viewEnd === null ? data.at(-1)?.t || 0 : viewEnd,
    start = Math.max(0, end - win);
  end = start + win;
  let x = (t) => ((t - start) / win) * (w - 12) + 4;
  let rowH = (height - 29) / 6,
    bordas = 0;
  ctx.strokeStyle = "#3b3536";
  ctx.lineWidth = 0.6;
  ctx.fillStyle = "#8f877b";
  ctx.font = "8px Consolas,monospace";
  for (let i = 0; i <= 8; i++) {
    let xx = 4 + (i * (w - 12)) / 8;
    ctx.beginPath();
    ctx.moveTo(xx, 14);
    ctx.lineTo(xx, height);
    ctx.stroke();
    ctx.fillText(
      Math.round(start + (i * win) / 8),
      Math.min(xx + 3, w - 27),
      9,
    );
  }
  for (let j = 0; j < 6; j++) {
    let y0 = 25 + j * rowH,
      y1 = y0 + 15;
    ctx.strokeStyle = "#332d2e";
    ctx.beginPath();
    ctx.moveTo(0, y1);
    ctx.lineTo(w, y1);
    ctx.stroke();
    ctx.strokeStyle = colors[j];
    ctx.lineWidth = 1.6;
    let ch = channels[j],
      prev = data[0] || { t: 0, v: [0, 0, 0] };
    for (const s of data) {
      if (s.t > start) break;
      prev = s;
    }
    let state = (prev.v[ch.p] >>> ch.b) & 1;
    ctx.beginPath();
    ctx.moveTo(x(start), state ? y0 : y1);
    for (let s of data) {
      if (s.t <= start) continue;
      if (s.t > end) break;
      let val = (s.v[ch.p] >>> ch.b) & 1;
      ctx.lineTo(x(s.t), state ? y0 : y1);
      if (val !== state) {
        ctx.lineTo(x(s.t), val ? y0 : y1);
        state = val;
        bordas++;
      }
    }
    ctx.lineTo(
      x(Math.max(start, Math.min(end, data.at(-1)?.t || 0))),
      state ? y0 : y1,
    );
    ctx.stroke();
    ctx.fillStyle = colors[j];
    ctx.font = "8px Consolas,monospace";
    ctx.fillText(String(state), w - 10, y0 + 7);
  }
  for (let i = 0; i < cursors.length; i++) {
    let xx = x(cursors[i]);
    if (xx < 0 || xx > w) continue;
    ctx.strokeStyle = i ? "#f6c36a" : "#dbe9ff";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(xx, 15);
    ctx.lineTo(xx, height);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fillText(i ? "B" : "A", xx + 3, 20);
  }
  if (triggerAt !== null && triggerAt >= start && triggerAt <= end) {
    ctx.fillStyle = "#f5c663";
    ctx.fillText("▼", x(triggerAt) - 4, 14);
  }
  if (!bordas) avisoNoScope(ctx, data, start, end, w, height);
  $("scopeRange").textContent =
    Math.round(start) + " → " + Math.round(end) + " passos";
  $("cursorReadout").textContent =
    cursors.length === 2
      ? `A ${cursors[0]} · B ${cursors[1]} · Δ ${Math.abs(cursors[1] - cursors[0])} passos`
      : cursors.length
        ? `A ${cursors[0]} · clique para posicionar B`
        : "Clique no gráfico: cursores A / B";
  canvas._range = { start, end, w };
}

// Sem bordas nos 6 canais: diz quais pinos mudaram ou o aviso do exemplo.
function avisoNoScope(ctx, data, start, end, w, height) {
  const mudou = lab.ports.map(() => 0);
  let anterior = null;
  for (const s of data) {
    if (s.t > end) break;
    if (anterior && s.t > start)
      s.v.forEach((v, p) => (mudou[p] |= v ^ anterior.v[p]));
    anterior = s;
  }
  const ativos = [];
  mudou.forEach((m, p) => {
    for (let b = 0; b < 16; b++) if ((m >>> b) & 1) ativos.push(pinName(p, b));
  });
  const texto = ativos.length
    ? "Sem bordas nos 6 canais. Pinos que mudaram: " +
      ativos.slice(0, 8).join(", ") +
      (ativos.length > 8 ? "…" : "") +
      ". Escolha-os nos seletores à esquerda."
    : avisoScope ||
      (data.length > 1 ? "Nenhum pino mudou nesta janela." : "");
  if (!texto) return;
  ctx.font = "11px system-ui, sans-serif";
  const linhas = [];
  let linha = "";
  for (const palavra of texto.split(" ")) {
    const teste = linha ? linha + " " + palavra : palavra;
    if (ctx.measureText(teste).width > w - 60 && linha) {
      linhas.push(linha);
      linha = palavra;
    } else linha = teste;
  }
  linhas.push(linha);
  const top = height / 2 - (linhas.length * 15) / 2 - 6;
  ctx.fillStyle = "rgba(24, 20, 21, 0.88)";
  ctx.fillRect(20, top, w - 40, linhas.length * 15 + 12);
  ctx.fillStyle = "#f4bd61";
  linhas.forEach((l, i) => ctx.fillText(l, 30, top + 18 + i * 15));
}

function updateGenerator() {
  if (!lab) return;
  const n = +$("genPin").value,
    period = +$("genPeriod").value,
    duty = +$("genDuty").value;
  if (
    !Number.isFinite(period) ||
    period < 2 ||
    period > 100000 ||
    !Number.isFinite(duty) ||
    duty < 0 ||
    duty > 100
  )
    throw Error("Período de 2 a 100000 passos; duty de 0 a 100%.");
  lab.generator = {
    enabled: $("genEnabled").checked,
    port: Math.floor(n / 16),
    pin: n % 16,
    period: Math.round(period),
    duty,
  };
  const a = +$("wireFrom").value,
    b = +$("wireTo").value;
  lab.wire = {
    enabled: $("wireEnabled").checked,
    from: Math.floor(a / 16),
    fp: a % 16,
    to: Math.floor(b / 16),
    tp: b % 16,
  };
  lab.sync();
  lab.sample();
  render();
}
function exportCSV() {
  const data = captureData();
  if (!data.length) throw Error("Sem captura.");
  let text = "step," + channels.map((c) => pinName(c.p, c.b)).join(",") + "\n";
  text += data
    .map(
      (s) => s.t + "," + channels.map((c) => (s.v[c.p] >>> c.b) & 1).join(","),
    )
    .join("\n");
  download(nomeBase() + "-scope.csv", text, "text/csv");
}
function exportVCD() {
  const data = captureData();
  if (!data.length) throw Error("Sem captura.");
  let text =
    "$comment One artificial ns per emulator step; NOT physical time. $end\n$timescale 1ns $end\n$scope module gpio $end\n";
  text +=
    channels
      .map(
        (c, i) =>
          `$var wire 1 ${String.fromCharCode(33 + i)} ${pinName(c.p, c.b)} $end`,
      )
      .join("\n") + "\n$upscope $end\n$enddefinitions $end\n";
  const last = [];
  for (const row of data) {
    const changes = [];
    channels.forEach((c, i) => {
      const v = (row.v[c.p] >>> c.b) & 1;
      if (last[i] !== v) {
        changes.push(v + String.fromCharCode(33 + i));
        last[i] = v;
      }
    });
    if (changes.length) text += "#" + row.t + "\n" + changes.join("\n") + "\n";
  }
  download(nomeBase() + "-scope.vcd", text);
}
function showFileDialog(mode) {
  if (!project) return;
  fileMode = mode;
  $("fileDialogTitle").textContent =
    mode === "rename"
      ? "Renomear arquivo"
      : mode === "delete"
        ? "Excluir arquivo do projeto"
        : "Novo arquivo Assembly";
  $("fileNameInput").value = mode === "add" ? "rotinas.s" : project.activeFile;
  $("fileNameInput").readOnly = mode === "delete";
  $("fileDialogHelp").textContent =
    mode === "rename"
      ? "Atualize as diretivas .include que usam o nome anterior."
      : mode === "delete"
        ? "A exclusão remove este arquivo do projeto no navegador. Exporte uma cópia se necessário."
        : 'Inclua arquivos com .include "rotinas.s" no arquivo de entrada.';
  $("fileDialog").showModal();
  $("fileNameInput").focus();
  $("fileNameInput").select();
}
function findNext() {
  const term = $("findText").value;
  if (!term) return;
  const editor = $("source"),
    start = editor.selectionEnd;
  let pos = editor.value.indexOf(term, start);
  if (pos < 0) pos = editor.value.indexOf(term);
  if (pos < 0) {
    status("Texto não encontrado.");
    return;
  }
  editor.focus();
  editor.setSelectionRange(pos, pos + term.length);
  editor.scrollTop = Math.max(
    0,
    (editor.value.slice(0, pos).split("\n").length - 5) * 22,
  );
  $("lines").scrollTop = editor.scrollTop;
}
function command(text) {
  const [cmd, ...args] = text.trim().split(/\s+/),
    argument = args.join(" ");
  let output = "";
  switch ((cmd || "").toLowerCase()) {
    case "help":
      output =
        "regs | print expressão | mem endereço [bytes] | set REG valor | break endereço | step | over | out | run | stop | reset";
      break;
    case "regs":
      output = Object.entries(lab.registers())
        .map(([n, v]) => n + "=0x" + h(v))
        .join("  ");
      break;
    case "p":
    case "print": {
      const v = debug.evaluate(argument);
      output = v + " · 0x" + h(v);
      break;
    }
    case "mem": {
      const address = debug.resolveAddress(args[0]);
      const size = Math.max(1, Math.min(256, Number(args[1] || 16)));
      if (!Number.isInteger(size)) throw Error("Tamanho inválido.");
      output =
        h(address) +
        ": " +
        lab
          .memory(address, size)
          .map((b) => h(b, 2))
          .join(" ");
      break;
    }
    case "set":
      pause();
      lab.setReg(
        args[0].toUpperCase(),
        debug.evaluate(args.slice(1).join(" ")),
      );
      lab.halted = false;
      output = "Registrador atualizado.";
      break;
    case "break":
      debug.addBreakpoint({ address: argument });
      output = "Breakpoint adicionado.";
      break;
    case "step":
      singleStep();
      output = $("status").textContent;
      break;
    case "over":
      startExecution("stepover");
      output = "Step over iniciado.";
      break;
    case "out":
      startExecution("stepout");
      output = "Step out iniciado.";
      break;
    case "run":
      startExecution();
      output = "Execução iniciada.";
      break;
    case "stop":
      pause();
      output = "Execução pausada.";
      break;
    case "reset":
      resetCPU();
      output = "CPU reiniciada.";
      break;
    default:
      throw Error("Comando desconhecido. Digite help.");
  }
  render();
  return output;
}
function configureReference() {
  const table = element("table");
  const tr = element("tr");
  for (const label of ["Micro", "CPU", "Flash", "SRAM", "GPIO"])
    tr.append(element("th", "", label));
  table.append(tr);
  for (const d of Object.values(DEVICES)) {
    const row = element("tr");
    for (const text of [
      d.name,
      d.core,
      kb(d.flashSize),
      kb(d.ramSize) +
        (d.extraRam?.length ? " + " + kb(d.extraRam[0].size) + " CCM" : ""),
      d.ports.reduce((n, p) => n + p.pins.length, 0),
    ])
      row.append(element("td", "", text));
    table.append(row);
  }
  $("deviceGuideTable").append(table);
  const refs = [
    [
      "µVision · Debug windows",
      "https://www.keil.com/support/man/docs/uv4cl/uv4cl_db_dbg_win_dialogs.htm",
    ],
    ...Object.values(DEVICES).map((d) => [
      d.name + " · datasheet",
      d.sources[0],
    ]),
  ];
  for (const [name, url] of refs) {
    const a = element("a", "", name);
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    $("referenceLinks").append(a);
  }
}
// Editor and project controls.
$("source").oninput = () => {
  syncEditor();
  renderSourceLines();
  if (lab) markDirty();
};
$("source").onscroll = () => {
  $("lines").scrollTop = $("source").scrollTop;
};
$("source").onkeydown = (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    e.target.setRangeText(
      "    ",
      e.target.selectionStart,
      e.target.selectionEnd,
      "end",
    );
    e.target.dispatchEvent(new Event("input"));
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
    e.preventDefault();
    $("findText").focus();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    if (lab) guard(buildProject)();
  }
};
$("projectName").onchange = guard(() => {
  const name = $("projectName").value.trim();
  if (!name || name.length > 120)
    throw Error("Nome do projeto: 1 a 120 caracteres.");
  project.name = name;
  save();
});
$("saveProject").onclick = guard(() => {
  save();
  download(
    nomeArquivo() + ".elf74.json",
    JSON.stringify(project.toJSON(), null, 2),
    "application/json",
  );
});
$("newProject").onclick = guard(() => {
  const ex = examples.blink;
  download(
    nomeArquivo() + "-backup.elf74.json",
    JSON.stringify(project.toJSON(), null, 2),
    "application/json",
  );
  loadProject(
    new LabProject({
      name: "Novo projeto",
      deviceId: lab.device.id,
      files: { "main.s": ex.code },
    }),
  );
  status("Novo projeto criado. Uma cópia do projeto anterior foi baixada.");
});
$("addFile").onclick = () => showFileDialog("add");
$("renameFile").onclick = () => showFileDialog("rename");
$("deleteFile").onclick = () => showFileDialog("delete");
$("fileCancel").onclick = () => $("fileDialog").close();
$("fileForm").onsubmit = guard((e) => {
  e.preventDefault();
  syncEditor();
  const name = $("fileNameInput").value.trim();
  if (fileMode === "add") {
    project.addFile(name, "@ Rotinas Assembly\n");
    project.setActive(name);
  }
  if (fileMode === "rename") project.renameFile(project.activeFile, name);
  if (fileMode === "delete") project.removeFile(project.activeFile);
  $("source").value = project.files[project.activeFile];
  $("fileDialog").close();
  renderProjectFiles();
  renderSourceLines();
  markDirty();
});
$("entryFile").onchange = guard(() => {
  project.setEntry($("entryFile").value);
  markDirty();
});
$("findNext").onclick = findNext;
$("findText").onkeydown = (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    findNext();
  }
};
$("replaceOne").onclick = () => {
  const editor = $("source"),
    term = $("findText").value;
  if (!term) return;
  if (editor.value.slice(editor.selectionStart, editor.selectionEnd) !== term)
    findNext();
  if (editor.value.slice(editor.selectionStart, editor.selectionEnd) === term) {
    editor.setRangeText(
      $("replaceText").value,
      editor.selectionStart,
      editor.selectionEnd,
      "end",
    );
    editor.dispatchEvent(new Event("input"));
  }
};
$("toggleSourceBp").onclick = guard(() => toggleBreakpoint(sourceAddress()));
$("assemble").onclick = guard(() => buildProject());
$("buildFiles").onclick = guard(exportBuildFiles);
$("run").onclick = guard(() => startExecution());
$("step").onclick = guard(singleStep);
$("stepOver").onclick = guard(() => startExecution("stepover"));
$("stepOut").onclick = guard(() => startExecution("stepout"));
$("runCursor").onclick = guard(() => startExecution("runto", sourceAddress()));
$("reset").onclick = guard(resetCPU);
$("device").onchange = guard(() => {
  if (!lab) return;
  syncEditor();
  save();
  pause();
  debug?.dispose();
  project.deviceId = $("device").value;
  lab.selectDevice(project.deviceId);
  debug = new LabDebugger(lab);
  debug.onStep = afterStep;
  debug.addWatch("R0");
  debug.addWatch("SP");
  built = null;
  port = 0;
  memAddr = lab.device.ramBase;
  $("disasm").replaceChildren();
  configureDevice();
  restoreLaboratoryDefaults();
  cleanCapture();
  renderSourceLines();
  markDirty(
    "Dispositivo selecionado. Carregue um exemplo para este micro ou adapte os endereços e faça Build.",
  );
  render();
});
$("loadExample").onclick = guard(() => {
  const key = $("examples").value,
    ex = examples[key];
  if (ex.requiresModel > lab.model)
    throw Error(
      (ex.painelFpu
        ? "Este exemplo requer FPU (Cortex-M4F); o "
        : "Este exemplo requer Cortex-M4; o ") +
        lab.device.name +
        " é " +
        lab.device.core +
        ".",
    );
  // Preserve an automatic recovery snapshot before replacing the current project.
  try {
    localStorage.setItem(
      "elf74-projeto-backup",
      JSON.stringify(project.toJSON()),
    );
  } catch {}
  let files = { "main.s": ex.code };
  if (key === "blink" && ex.code.includes("\ndelay:")) {
    const split = ex.code.indexOf("\ndelay:");
    files = {
      "main.s": ex.code.slice(0, split) + '\n.include "delay.s"\n',
      "delay.s": ex.code.slice(split + 1),
    };
  }
  const name = ex.name;
  loadProject(
    new LabProject({
      name,
      deviceId: lab.device.id,
      files,
      activeFile: "main.s",
      entryFile: "main.s",
      labSettings: laboratorySettings(),
    }),
  );
  $("examples").value = key;
  $("exampleDescription").textContent = ex.description;
  aplicarExemplo(ex);
});
// Canais do analisador, estímulo e painéis que o exemplo pede.
function aplicarExemplo(ex) {
  (ex.canais || []).slice(0, 6).forEach((nome, i) => {
    const p = pinoPorNome(nome);
    if (p) channels[i] = { p: p.port, b: p.bit };
  });
  atualizarCanais();
  $("scopeWindow").value = ex.janela || 512;
  avisoScope = ex.aviso || "";
  // Um botão da aba Chip & conexões no pino manda nele; o gerador fica desligado.
  const g =
    ex.gerador &&
    !pinosBancada.includes(ex.gerador.pino) &&
    pinoPorNome(ex.gerador.pino);
  if (g) {
    $("genPin").value = g.port * 16 + g.bit;
    $("genPeriod").value = ex.gerador.periodo || 64;
    $("genDuty").value = 50;
    $("genEnabled").checked = true;
    document.querySelector("details.stimulus").open = true;
    updateGenerator();
  }
  const r = ex.ligacao && pinoPorNome(ex.ligacao.pino);
  ligarRota(
    r
      ? {
          port: r.port,
          bit: r.bit,
          irq: ex.ligacao.irq,
          edge: ex.ligacao.borda,
          enabled: true,
        }
      : null,
  );
  if (ex.porta)
    port = Math.max(
      0,
      lab.device.ports.findIndex((p) => p.name === ex.porta),
    );
  if (ex.watches) {
    debug.watches = [];
    for (const expr of ex.watches) debug.addWatch(expr);
  }
  if (ex.painelFpu && lab.model === 9) $("fpuRegs").parentElement.open = true;
  if (ex.aba) showBottom(ex.aba, false);
  render();
}
// Ligação pino → IRQ do exemplo 07; sai quando outro exemplo é carregado.
function ligarRota(rota) {
  if (!interruptPanel) return;
  const perfil = interruptPanel.profile;
  if (rota) {
    perfil.route = rota;
    rotaAutomatica = JSON.stringify(rota);
  } else if (perfil.route && JSON.stringify(perfil.route) === rotaAutomatica) {
    perfil.route = null;
    lab.nvic.clearRoute();
    if (interruptPanel.routeEnabled) interruptPanel.routeEnabled.checked = false;
  } else return;
  interruptPanel.afterReset();
  save();
}
$("downloadAsm").onclick = () =>
  download(project.activeFile, $("source").value);
$("downloadBin").onclick = guard(baixarBin);
$("reportBin").onclick = guard(baixarBin);
$("exportHex").onclick = guard(baixarHex);
$("importBtn").onclick = () => $("importFile").click();
$("importFile").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    pause();
    if (file.size > 2 * 1024 * 1024) throw Error("Arquivo maior que 2 MiB.");
    if (file.name.toLowerCase().endsWith(".json"))
      loadProject(LabProject.fromJSON(await file.text()));
    else if (file.name.toLowerCase().endsWith(".bin")) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const listing = lab.loadBinary(bytes);
      built = null;
      renderListing(listing);
      debug.reset();
      debug.setSymbols(deviceSymbols());
      restoreLaboratoryDefaults();
      dirty = false;
      cleanCapture();
      $("sourceState").textContent =
        "Binário importado · editor não representa este arquivo";
      $("byteCount").textContent = bytes.length + " B";
      for (const id of ["run", "step", "stepOver", "stepOut", "runCursor"])
        $(id).disabled = false;
      document.querySelector('[data-code="machine"]').click();
      render();
      status("Binário bruto carregado em 0x" + h(lab.device.flashBase));
    } else {
      project.setSource(project.activeFile, await file.text());
      $("source").value = project.files[project.activeFile];
      buildProject();
    }
  } catch (error) {
    status(error.message || String(error), true);
  }
  e.target.value = "";
};
document.querySelectorAll("[data-code]").forEach(
  (b) =>
    (b.onclick = () => {
      document
        .querySelectorAll("[data-code]")
        .forEach((x) => x.classList.toggle("active", x === b));
      $("sourcePane").hidden = b.dataset.code !== "source";
      $("machinePane").hidden = b.dataset.code !== "machine";
      document.querySelector(".editor-search").hidden =
        b.dataset.code !== "source";
      if (lab) {
        followRequested = true;
        renderRegs();
      }
    }),
);
document
  .querySelectorAll("[data-bottom]")
  .forEach((b) => (b.onclick = () => showBottom(b.dataset.bottom)));
$("regFormat").onchange = () => lab && renderRegs();
$("stackSelect").onchange = () => lab && renderMemory();
document
  .querySelectorAll(".special")
  .forEach((d) => (d.ontoggle = () => lab && renderRegs()));
$("memGo").onclick = guard(() =>
  goMem(debug.resolveAddress($("memAddress").value)),
);
$("memAddress").onkeydown = (e) => {
  if (e.key === "Enter") $("memGo").click();
};
$("memPrev").onclick = guard(() => goMem(Math.max(0, memAddr - 128)));
$("memNext").onclick = guard(() => goMem(memAddr + 128));
$("peripheralPort").onchange = () => renderPeripherals();
$("watchForm").onsubmit = guard((e) => {
  e.preventDefault();
  debug.addWatch($("watchExpr").value);
  $("watchExpr").value = "";
  renderWatches();
});
$("bpForm").onsubmit = guard((e) => {
  e.preventDefault();
  debug.addBreakpoint({
    address: $("bpAddress").value,
    condition: $("bpCondition").value,
    hitTarget: +$("bpHits").value,
  });
  renderBreakpoints();
  renderSourceLines();
  highlightAssembly();
});
$("dataBpForm").onsubmit = guard((e) => {
  e.preventDefault();
  debug.addWatchpoint({
    address: $("dataAddress").value,
    size: +$("dataSize").value,
    access: $("dataAccess").value,
  });
  renderBreakpoints();
});
$("exportTrace").onclick = () => {
  const rows = ["step,pc,next_pc,instruction,changed_registers"];
  for (const t of debug.trace)
    rows.push(
      [
        t.step,
        "0x" + h(t.pc),
        "0x" + h(t.nextPC),
        t.instruction,
        Object.entries(t.changed)
          .map(([n, v]) => n + "=0x" + h(v.after))
          .join(" "),
      ]
        .map((v) => '"' + String(v).replaceAll('"', '""') + '"')
        .join(","),
    );
  download(nomeBase() + "-trace.csv", rows.join("\n"), "text/csv");
};
$("commandForm").onsubmit = (e) => {
  e.preventDefault();
  const text = $("commandInput").value;
  let output;
  try {
    output = command(text);
  } catch (error) {
    output = "ERRO: " + (error.message || error);
  }
  $("commandOutput").textContent = (
    $("commandOutput").textContent +
    "\n› " +
    text +
    "\n" +
    output
  ).slice(-16000);
  $("commandInput").value = "";
  $("commandOutput").scrollTop = $("commandOutput").scrollHeight;
};
$("capture").onclick = () => {
  if (!lab) return;
  if (frozen) {
    frozen = null;
    viewEnd = null;
    $("capture").textContent = "❚❚ Congelar";
    $("captureBadge").textContent = "Capturando";
    $("captureBadge").style.background = "";
  } else freeze();
  drawScope();
};
$("clearScope").onclick = () => {
  if (!lab) return;
  lab.trace = [];
  lab.sample();
  cleanCapture();
  drawScope();
};
$("scopeWindow").onchange = drawScope;
$("scope").onclick = (e) => {
  const rect = e.currentTarget.getBoundingClientRect(),
    range = e.currentTarget._range;
  if (!range) return;
  const t = Math.max(
    range.start,
    Math.min(
      range.end,
      Math.round(
        range.start +
          ((e.clientX - rect.left - 4) / (range.w - 12)) *
            (range.end - range.start),
      ),
    ),
  );
  if (cursors.length === 2) cursors = [];
  cursors.push(t);
  drawScope();
};
$("scope").onwheel = (e) => {
  if (!lab) return;
  e.preventDefault();
  if (!frozen) freeze();
  const win = Number($("scopeWindow").value),
    data = captureData();
  viewEnd = Math.max(
    win,
    Math.min(
      Math.max(win, data.at(-1)?.t || 0),
      (viewEnd || 0) + (Math.sign(e.deltaY) * win) / 4,
    ),
  );
  drawScope();
};
$("armTrigger").onclick = () => {
  if (!lab) return;
  if ($("trigger").value === "off") {
    triggerArmed = false;
    triggerAt = null;
    $("triggerStatus").textContent = "Modo livre";
    return;
  }
  if (frozen) $("capture").click();
  triggerAt = null;
  triggerArmed = true;
  const c = channels[0];
  triggerPrevious = (lab.ports[c.p].pins >>> c.b) & 1;
  $("triggerStatus").textContent = "Armado · borda em " + pinName(c.p, c.b);
};
$("trigger").onchange = () => {
  triggerArmed = false;
  triggerAt = null;
  $("triggerStatus").textContent =
    $("trigger").value === "off"
      ? "Tempo lógico · passos do motor"
      : "Clique Armar para aguardar a borda";
};
$("exportCsv").onclick = guard(exportCSV);
$("exportVcd").onclick = guard(exportVCD);
for (const id of [
  "genEnabled",
  "genPin",
  "genPeriod",
  "genDuty",
  "wireEnabled",
  "wireFrom",
  "wireTo",
])
  $(id).onchange = guard(updateGenerator);
$("serialForm").onsubmit = guard((e) => {
  e.preventDefault();
  if (!lab) return;
  const ending = $("lineEnding").value;
  lab.serial(
    $("serialInput").value +
      (ending === "lf" ? "\n" : ending === "crlf" ? "\r\n" : ""),
  );
  $("serialInput").value = "";
  render();
  status("Dados inseridos em RX. Execute o programa para recebê-los.");
});
$("clearTerminal").onclick = () => {
  if (lab) {
    lab.tx = "";
    render();
  }
};
$("editForm").onsubmit = (e) => {
  e.preventDefault();
  try {
    const text = $("editValue").value.trim(),
      value = debug ? debug.evaluate(text) : Number(text);
    if (
      !text ||
      !Number.isInteger(value) ||
      value < -2147483648 ||
      value > 0xffffffff
    )
      throw Error("Informe um inteiro de 32 bits.");
    editAction(value);
    $("editDialog").close();
    status("Valor atualizado.");
  } catch (error) {
    $("editValue").setCustomValidity(error.message || String(error));
    $("editValue").reportValidity();
  }
};
$("editValue").oninput = () => $("editValue").setCustomValidity("");
$("editCancel").onclick = () => $("editDialog").close();
for (const id of ["guideBtn", "coverageBtn"])
  $(id).onclick = () => $("guide").showModal();
$("closeGuide").onclick = () => $("guide").close();
$("benchBtn").onclick = () => {
  showWorkspace("bench");
  window.scrollTo({ top: 0, behavior: "smooth" });
};
$("targetInfoBtn").onclick = () => {
  showBottom("peripherals");
  $("peripheralsPanel").scrollIntoView({ behavior: "smooth", block: "center" });
};
window.addEventListener("resize", drawScope);
document.addEventListener("keydown", (e) => {
  if (!lab || document.querySelector("dialog[open]")) return;
  const bindings = {
    F5: () => startExecution(),
    F7: () => buildProject(),
    F9: () => toggleBreakpoint(sourceAddress()),
    F10: () =>
      e.ctrlKey
        ? startExecution("runto", sourceAddress())
        : startExecution("stepover"),
    F11: () => (e.ctrlKey ? startExecution("stepout") : singleStep()),
  };
  if (bindings[e.key]) {
    e.preventDefault();
    guard(bindings[e.key])();
  }
});
configureReference();
(async () => {
  try {
    const bin = await fetch("vendor/cortex-model.wasm");
    if (!bin.ok) throw Error("Motor WebAssembly indisponível.");
    const [uc, ks, cs] = await Promise.all([
      MUnicorn({ wasmBinary: new Uint8Array(await bin.arrayBuffer()) }),
      MKeystone({ printErr: LAB.printErr }),
      MCapstone(),
    ]);
    lab = new LabSimulador(uc, ks, cs);
    window.labSimulador = lab;
    initializeLaboratory();
    $("engineDot").classList.remove("amber");
    $("engineStatus").textContent = "Unicorn + Keystone + Capstone · WASM";
    $("assemble").disabled = false;
    $("buildFiles").disabled = false;
    let p = null;
    try {
      const saved = localStorage.getItem(STORAGE);
      if (saved) p = LabProject.fromJSON(saved);
    } catch {}
    if (!p) {
      const source = examplesForDevice(DEVICES.stm32f411ce).blink.code;
      p = new LabProject({
        name: "Contador GPIO",
        deviceId: "stm32f411ce",
        files: { "main.s": source },
      });
    }
    if (!DEVICES[p.deviceId])
      throw Error("Perfil de microcontrolador não reconhecido no projeto.");
    try {
      loadProject(p, false);
    } catch (error) {
      // Erro no fonte salvo: o relatório mostra a linha e o editor fica livre.
      status(error.message || String(error), true);
    }
    // Projeto salvo que é um exemplo: volta com os canais e o estímulo dele.
    const salvo = Object.entries(examples).find(([, e]) => e.name === p.name);
    if (salvo && !(salvo[1].requiresModel > lab.model)) {
      $("examples").value = salvo[0];
      $("exampleDescription").textContent = salvo[1].description;
      guard(aplicarExemplo)(salvo[1]);
    }
    document.querySelector("main").inert = false;
    document.querySelector("main").setAttribute("aria-busy", "false");
  } catch (error) {
    $("engineStatus").textContent = "Falha na inicialização";
    status(error.message || String(error), true);
  }
})();
