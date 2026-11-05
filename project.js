/* Project manager — GPL-2.0-or-later. */
(function (root) {
  "use strict";

  const FORMAT = "elf74-projeto";
  const VERSION = 1;
  const MAX_FILES = 32;
  const MAX_CHARS = 1024 * 1024;
  const MAX_LINES = 20000;
  const MAX_SETTINGS_BYTES = 128 * 1024;
  const MAX_SETTINGS_DEPTH = 20;
  const BAD_KEYS = new Set(["__proto__", "prototype", "constructor"]);

  // Settings are optional, untrusted JSON data. Keep their schema independent
  // from the board/clock/interrupt modules, which validate their own semantics.
  function settings(value) {
    if (value === undefined) return undefined;
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("labSettings deve ser um objeto JSON.");
    const ancestors = new Set();
    let nodes = 0;
    const clone = (item, depth) => {
      if (depth > MAX_SETTINGS_DEPTH)
        throw new Error("labSettings excede a profundidade máxima de 20.");
      if (++nodes > MAX_SETTINGS_BYTES)
        throw new Error("labSettings excede o limite de 128 KiB.");
      if (item === null || typeof item === "boolean") return item;
      if (typeof item === "string") {
        if (item.length > MAX_SETTINGS_BYTES)
          throw new Error("labSettings excede o limite de 128 KiB.");
        return item;
      }
      if (typeof item === "number" && Number.isFinite(item)) return item;
      if (!item || typeof item !== "object")
        throw new Error("labSettings aceita apenas valores JSON finitos.");
      const array = Array.isArray(item);
      const proto = Object.getPrototypeOf(item);
      if (
        (!array && proto !== Object.prototype && proto !== null) ||
        (array && proto !== Array.prototype)
      )
        throw new Error("Objeto não JSON em labSettings.");
      if (ancestors.has(item))
        throw new Error("Ciclo inválido em labSettings.");
      ancestors.add(item);
      const result = array ? [] : {};
      const keys = Reflect.ownKeys(item);
      if (
        keys.length > MAX_SETTINGS_BYTES ||
        (array && item.length > MAX_SETTINGS_BYTES)
      )
        throw new Error("labSettings excede o limite de 128 KiB.");
      for (const key of keys) {
        if (array && key === "length") continue;
        if (typeof key !== "string" || BAD_KEYS.has(key))
          throw new Error("Chave proibida em labSettings.");
        if (
          array &&
          (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= item.length)
        )
          throw new Error("Array inválido em labSettings.");
        const descriptor = Object.getOwnPropertyDescriptor(item, key);
        if (!descriptor.enumerable || !Object.hasOwn(descriptor, "value"))
          throw new Error(
            "labSettings aceita apenas propriedades JSON de dados.",
          );
        result[key] = clone(descriptor.value, depth + 1);
      }
      if (array && result.length !== item.length)
        throw new Error("Array esparso inválido em labSettings.");
      if (array && keys.length !== item.length + 1)
        throw new Error("Array esparso inválido em labSettings.");
      ancestors.delete(item);
      return result;
    };
    const result = clone(value, 0);
    if (
      new TextEncoder().encode(JSON.stringify(result)).length >
      MAX_SETTINGS_BYTES
    )
      throw new Error("labSettings excede o limite de 128 KiB.");
    return result;
  }

  function filename(value) {
    if (typeof value !== "string" || !value || value.length > 120) {
      throw new Error("Nome de arquivo inválido (máximo de 120 caracteres).");
    }
    if (!/^[A-Za-z0-9_.\-/]+$/.test(value) || value.startsWith("/")) {
      throw new Error(
        "Use um nome relativo, com letras, números, ponto, hífen ou sublinhado.",
      );
    }
    const parts = value.split("/");
    if (
      parts.some(
        (part) => !part || part === "." || part === ".." || BAD_KEYS.has(part),
      )
    ) {
      throw new Error("Caminho de arquivo inválido.");
    }
    return value;
  }

  function title(value) {
    if (typeof value !== "string" || !value.trim() || value.length > 120) {
      throw new Error("O nome do projeto deve ter de 1 a 120 caracteres.");
    }
    return value.trim();
  }

  function text(value) {
    if (
      typeof value !== "string" ||
      value.length > MAX_CHARS ||
      value.includes("\0")
    ) {
      throw new Error(
        "Conteúdo inválido: use texto com até 1 MiB, sem bytes nulos.",
      );
    }
    return value.replace(/\r\n?/g, "\n");
  }

  function stripComments(line) {
    // This matches the source normalization used by the CPU's assembler entry point.
    return line.replace(/@.*$/, "").replace(/\/\/.*$/, "");
  }

  function includePath(current, requested) {
    if (!requested || requested.startsWith("/") || requested.includes("\\")) {
      throw new Error(
        "Include deve apontar para um arquivo relativo do projeto.",
      );
    }
    const parts = current.split("/").slice(0, -1);
    for (const part of requested.split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") {
        if (!parts.length)
          throw new Error("Include não pode sair da pasta do projeto.");
        parts.pop();
      } else {
        parts.push(part);
      }
    }
    return filename(parts.join("/"));
  }

  function byteEqual(a, b, length) {
    if (b.length < length) return false;
    for (let i = 0; i < length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  function symbolNames(lines) {
    const result = new Set();
    for (const item of lines) {
      let line = stripComments(item.text).trim();
      let match;
      while ((match = /^([A-Za-z_.$][\w.$]*|\d+)\s*:\s*/.exec(line))) {
        if (!/^\d+$/.test(match[1])) result.add(match[1]);
        line = line.slice(match[0].length).trim();
      }
      const definition =
        /^\.(?:equ|equiv|set)\s+([A-Za-z_.$][\w.$]*)\s*,/i.exec(line) ||
        /^([A-Za-z_.$][\w.$]*)\s*=/.exec(line);
      if (definition) result.add(definition[1]);
    }
    return [...result].filter((name) => !BAD_KEYS.has(name));
  }

  function instructionCount(line) {
    let clean = stripComments(line).trim();
    clean = clean.replace(/^(?:(?:[A-Za-z_.$][\w.$]*|\d+)\s*:\s*)+/, "");
    if (
      !clean ||
      clean.startsWith(".") ||
      /^[A-Za-z_.$][\w.$]*\s*=/.test(clean)
    )
      return 0;
    return clean.split(";").filter((part) => part.trim()).length;
  }

  class LabProject {
    constructor(options = {}) {
      this.name = title(options.name || "Projeto ELF74");
      this.deviceId =
        typeof options.deviceId === "string" ? options.deviceId : "stm32f411ce";
      this.files = Object.create(null);
      const initial = options.files || {
        "main.s": ".syntax unified\n.thumb\n    nop\n",
      };
      if (!initial || typeof initial !== "object" || Array.isArray(initial)) {
        throw new Error("A lista de arquivos do projeto é inválida.");
      }
      const entries = Object.entries(initial);
      if (!entries.length || entries.length > MAX_FILES) {
        throw new Error("O projeto deve conter de 1 a 32 arquivos.");
      }
      for (const [name, source] of entries)
        this.files[filename(name)] = text(source);
      this._checkSize();
      this.entryFile = options.entryFile || entries[0][0];
      this.activeFile = options.activeFile || this.entryFile;
      this._requireFile(this.entryFile);
      this._requireFile(this.activeFile);
      this.labSettings = settings(options.labSettings);
      this.lastBuild = null;
    }

    _requireFile(name) {
      filename(name);
      if (!Object.hasOwn(this.files, name))
        throw new Error("Arquivo não encontrado: " + name);
      return this.files[name];
    }

    _checkSize(nextName, nextText) {
      let length = 0;
      for (const [name, source] of Object.entries(this.files)) {
        length += name === nextName ? nextText.length : source.length;
      }
      if (nextName && !Object.hasOwn(this.files, nextName))
        length += nextText.length;
      if (length > MAX_CHARS)
        throw new Error("O projeto excede o limite de 1 MiB de texto.");
    }

    addFile(name, source = "") {
      name = filename(name);
      if (Object.hasOwn(this.files, name))
        throw new Error("Esse arquivo já existe: " + name);
      if (Object.keys(this.files).length >= MAX_FILES)
        throw new Error("Limite de 32 arquivos atingido.");
      source = text(source);
      this._checkSize(name, source);
      this.files[name] = source;
      this.activeFile = name;
      this.lastBuild = null;
      return name;
    }

    removeFile(name) {
      this._requireFile(name);
      if (Object.keys(this.files).length === 1)
        throw new Error("Mantenha pelo menos um arquivo no projeto.");
      delete this.files[name];
      const fallback = Object.keys(this.files)[0];
      if (this.entryFile === name) this.entryFile = fallback;
      if (this.activeFile === name) this.activeFile = this.entryFile;
      this.lastBuild = null;
    }

    renameFile(oldName, newName) {
      const source = this._requireFile(oldName);
      newName = filename(newName);
      if (oldName === newName) return newName;
      if (Object.hasOwn(this.files, newName))
        throw new Error("Esse arquivo já existe: " + newName);
      const files = Object.create(null);
      for (const [name, content] of Object.entries(this.files)) {
        files[name === oldName ? newName : name] = content;
      }
      this.files = files;
      if (this.entryFile === oldName) this.entryFile = newName;
      if (this.activeFile === oldName) this.activeFile = newName;
      this.lastBuild = null;
      // Includes are deliberately not rewritten: relative paths may change meaning.
      return newName;
    }

    setSource(name, source) {
      this._requireFile(name);
      source = text(source);
      this._checkSize(name, source);
      this.files[name] = source;
      this.lastBuild = null;
    }

    setActive(name) {
      this._requireFile(name);
      this.activeFile = name;
    }

    setEntry(name) {
      this._requireFile(name);
      this.entryFile = name;
      this.lastBuild = null;
    }

    sourceForBuild() {
      const lines = [];
      let length = 0;
      const append = (item) => {
        length += item.text.length + 1;
        if (length > MAX_CHARS || lines.length >= MAX_LINES) {
          throw new Error(
            "Os includes expandidos excedem 1 MiB ou 20.000 linhas.",
          );
        }
        lines.push(item);
      };
      const visit = (name, stack) => {
        if (stack.includes(name))
          throw new Error("Include circular: " + [...stack, name].join(" → "));
        const source = this._requireFile(name);
        source.split("\n").forEach((line, index) => {
          const clean = stripComments(line).trim();
          if (/^\.include\b/i.test(clean)) {
            const match = /^\.include\s+["']([^"']+)["']\s*$/i.exec(clean);
            if (!match)
              throw new Error(
                name + ":" + (index + 1) + ': use .include "arquivo.s".',
              );
            let included;
            try {
              included = includePath(name, match[1]);
              this._requireFile(included);
            } catch (error) {
              throw new Error(name + ":" + (index + 1) + ": " + error.message);
            }
            visit(included, [...stack, name]);
          } else {
            append({ file: name, line: index + 1, text: line });
          }
        });
      };
      visit(this.entryFile, []);
      return { source: lines.map((item) => item.text).join("\n"), lines };
    }

    build(lab) {
      const flattened = this.sourceForBuild();
      const listing = lab.assemble(flattened.source);
      const result = {
        listing,
        source: flattened.source,
        sourceMap: new Map(),
        symbols: Object.create(null),
        lineAddresses: [],
        diagnostics: [],
        exactMapping: false,
      };
      try {
        this._mapSource(lab, flattened.lines, result);
      } catch (error) {
        result.diagnostics.push({
          level: "warning",
          message:
            "Programa montado; mapa de fonte indisponível: " +
            error.message +
            " Use o código de máquina para breakpoints e execução até endereço.",
        });
      }
      this.lastBuild = result;
      return result;
    }

    _mapSource(lab, lines, result) {
      const base = lab.device ? lab.device.flashBase : 0x08000000;
      let prefix = "__cortex_lab_source_";
      while (result.source.includes(prefix)) prefix += "x";
      const records = [];
      const probe = [];
      const complex =
        /^\.(?:macro|endm|rept|endr|irp|irpc|if|ifdef|ifndef|else|elseif|endif)\b/i;
      for (let i = 0; i < lines.length; i++) {
        const item = lines[i];
        const clean = stripComments(item.text).trim();
        if (complex.test(clean))
          throw new Error(
            "Macros ou montagem condicional não possuem mapeamento nesta versão.",
          );
        if (clean) {
          const label = prefix + i;
          const record = { ...item, label, count: instructionCount(clean) };
          records.push(record);
          probe.push(label + ":");
        }
        probe.push(stripComments(item.text));
      }
      const names = symbolNames(lines);
      const values = [...records.map((record) => record.label), ...names];
      if (!values.length)
        throw new Error("Não há linhas ou símbolos para mapear.");
      const header = [0x43584c42, 0x31534d50, values.length, 0xe0f0c0d0];
      probe.push(
        ".ltorg",
        ".balign 4",
        ...header.map((value) => ".word " + value),
      );
      probe.push(
        ...values.map((value) => ".word " + value),
        ".word 0xC0DEF00D",
      );
      const assembled = lab.assembler.asm(probe.join("\n"), base);
      if (assembled.failed || !assembled.mc)
        throw new Error("O montador não gerou os metadados de endereço.");
      const bytes = assembled.mc;
      if (!byteEqual(lab.code, bytes, lab.code.length)) {
        throw new Error(
          "A montagem de metadados alterou bytes do programa; endereços não foram inferidos.",
        );
      }
      const footerLength = 20 + values.length * 4;
      const start = bytes.length - footerLength;
      if (start < lab.code.length)
        throw new Error("Bloco de metadados inválido.");
      const view = new DataView(
        bytes.buffer,
        bytes.byteOffset,
        bytes.byteLength,
      );
      if (
        !header.every(
          (value, i) => view.getUint32(start + i * 4, true) === value,
        ) ||
        view.getUint32(bytes.length - 4, true) !== 0xc0def00d
      ) {
        throw new Error("O montador não preservou o bloco final de metadados.");
      }
      const readValue = (index) => view.getUint32(start + 16 + index * 4, true);
      const addresses = records.map((record, index) => ({
        ...record,
        address: readValue(index),
      }));
      const instructionIndexes = new Map(
        result.listing.map((item, index) => [item.address, index]),
      );
      for (let i = 0; i < addresses.length; i++) {
        const record = addresses[i];
        if (record.address < base || record.address > base + lab.code.length)
          continue;
        result.lineAddresses.push({
          file: record.file,
          line: record.line,
          address: record.address,
        });
        if (!record.count || !instructionIndexes.has(record.address)) continue;
        let next = base + lab.code.length;
        for (let j = i + 1; j < addresses.length; j++) {
          if (addresses[j].address > record.address) {
            next = addresses[j].address;
            break;
          }
        }
        let remaining = record.count;
        for (
          let k = instructionIndexes.get(record.address);
          k < result.listing.length;
          k++
        ) {
          const instruction = result.listing[k];
          if (instruction.address >= next || remaining <= 0) break;
          result.sourceMap.set(instruction.address, {
            file: record.file,
            line: record.line,
          });
          remaining--;
        }
      }
      names.forEach((name, index) => {
        result.symbols[name] = readValue(records.length + index);
      });
      result.exactMapping = true;
      result.diagnostics.push({
        level: "info",
        message:
          result.sourceMap.size +
          " endereços de instrução associados à fonte; " +
          names.length +
          " símbolos. Mapa verificado contra os bytes do programa.",
      });
    }

    addressForLine(file, line) {
      if (!this.lastBuild || !this.lastBuild.exactMapping) return null;
      const candidates = this.lastBuild.lineAddresses.filter(
        (item) => item.file === file && item.line >= line,
      );
      const valid = new Set(this.lastBuild.sourceMap.keys());
      const item = candidates.find((candidate) => valid.has(candidate.address));
      return item ? item.address : null;
    }

    toJSON() {
      return {
        format: FORMAT,
        version: VERSION,
        name: this.name,
        deviceId: this.deviceId,
        entryFile: this.entryFile,
        activeFile: this.activeFile,
        files: { ...this.files },
        ...(this.labSettings === undefined
          ? {}
          : { labSettings: settings(this.labSettings) }),
      };
    }

    static fromJSON(value) {
      let parsed = value;
      if (typeof value === "string") {
        if (value.length > MAX_CHARS * 2)
          throw new Error("Arquivo de projeto grande demais.");
        try {
          parsed = JSON.parse(value);
        } catch {
          throw new Error("O arquivo não contém JSON válido.");
        }
      }
      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed) ||
        parsed.format !== FORMAT ||
        parsed.version !== VERSION
      ) {
        throw new Error("Use um projeto exportado por este site (formato versão 1).");
      }
      if (
        !parsed.files ||
        typeof parsed.files !== "object" ||
        Array.isArray(parsed.files)
      ) {
        throw new Error("O projeto deve incluir um objeto de arquivos.");
      }
      if (typeof parsed.deviceId !== "string" || parsed.deviceId.length > 80) {
        throw new Error("Perfil de microcontrolador inválido no projeto.");
      }
      return new LabProject(parsed);
    }

    static toIntelHex(bytes, base = 0x08000000) {
      if (
        !bytes ||
        typeof bytes.length !== "number" ||
        !Number.isInteger(base) ||
        base < 0 ||
        base + bytes.length > 0x100000000
      ) {
        throw new Error("Intervalo inválido para exportar Intel HEX.");
      }
      const hex = (value) => value.toString(16).toUpperCase().padStart(2, "0");
      const record = (type, address, data) => {
        const fields = [
          data.length,
          (address >>> 8) & 255,
          address & 255,
          type,
          ...data,
        ];
        const checksum = -fields.reduce((sum, value) => sum + value, 0) & 255;
        return ":" + fields.concat(checksum).map(hex).join("");
      };
      const lines = [];
      let previousUpper = -1;
      for (let offset = 0; offset < bytes.length; ) {
        const address = base + offset;
        const upper = address >>> 16;
        if (upper !== previousUpper) {
          lines.push(record(4, 0, [upper >>> 8, upper & 255]));
          previousUpper = upper;
        }
        const low = address & 65535;
        const size = Math.min(16, bytes.length - offset, 65536 - low);
        lines.push(
          record(0, low, Array.from(bytes.slice(offset, offset + size))),
        );
        offset += size;
      }
      lines.push(record(1, 0, []));
      return lines.join("\n") + "\n";
    }
  }

  root.LabProject = LabProject;
  if (typeof module !== "undefined" && module.exports)
    module.exports = { LabProject };
})(typeof globalThis !== "undefined" ? globalThis : this);
