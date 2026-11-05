/* Debugger — GPL-2.0-or-later.
 * Safe expressions, breakpoint control, watches and observed execution history.
 * No eval(), generated JavaScript or host-side code execution.
 */
(function (root) {
  "use strict";

  const MAX_EXPRESSION_LENGTH = 512;
  const MAX_TOKENS = 256;
  const MAX_DEPTH = 32;
  const UINT32_MAX = 0xffffffff;
  const REGISTER_ALIASES = { R13: "SP", R14: "LR", R15: "PC" };
  const REGISTER_NAMES = new Set([
    ...Array.from({ length: 16 }, (_, i) => "R" + i),
    "SP",
    "LR",
    "PC",
    "MSP",
    "PSP",
    "XPSR",
    "APSR",
    "IPSR",
    "EPSR",
    "CONTROL",
    "PRIMASK",
    "BASEPRI",
    "FAULTMASK",
    "FPSCR",
  ]);
  const PRECEDENCE = {
    "||": 1,
    "&&": 2,
    "|": 3,
    "^": 4,
    "&": 5,
    "==": 6,
    "!=": 6,
    "<": 7,
    "<=": 7,
    ">": 7,
    ">=": 7,
    "<<": 8,
    ">>": 8,
    ">>>": 8,
    "+": 9,
    "-": 9,
    "*": 10,
    "/": 10,
    "%": 10,
  };
  const FUNCTIONS = new Set([
    "mem8",
    "mem16",
    "mem32",
    "s32",
    "u32",
    "abs",
    "min",
    "max",
    "bit",
  ]);

  function hex(value, width = 8) {
    return (value >>> 0).toString(16).toUpperCase().padStart(width, "0");
  }

  function normalizeAddress(value) {
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(number) || number < 0 || number > UINT32_MAX) {
      throw new Error("Endereço deve ser um inteiro entre 0 e 0xFFFFFFFF.");
    }
    return number >>> 0;
  }

  function tokenize(source) {
    if (typeof source !== "string" || !source.trim()) {
      throw new Error("Expressão vazia.");
    }
    if (source.length > MAX_EXPRESSION_LENGTH) {
      throw new Error("Expressão excede 512 caracteres.");
    }
    const tokens = [];
    let position = 0;
    while (position < source.length) {
      const rest = source.slice(position);
      const whitespace = /^\s+/.exec(rest);
      if (whitespace) {
        position += whitespace[0].length;
        continue;
      }
      const numeric = /^(?:0[xX][0-9a-fA-F]+|0[bB][01]+|\d+(?:\.\d+)?)/.exec(
        rest,
      );
      if (numeric) {
        const value = Number(numeric[0]);
        if (
          !Number.isFinite(value) ||
          Math.abs(value) > Number.MAX_SAFE_INTEGER
        ) {
          throw new Error("Constante numérica fora do intervalo seguro.");
        }
        tokens.push({ kind: "number", value, position });
        position += numeric[0].length;
      } else {
        const identifier = /^[A-Za-z_.$][A-Za-z0-9_.$]*/.exec(rest);
        if (identifier) {
          tokens.push({ kind: "identifier", value: identifier[0], position });
          position += identifier[0].length;
        } else {
          const operator =
            /^(?:>>>|<<|>>|<=|>=|==|!=|&&|\|\||[+\-*/%&|^~!<>() ,])/.exec(rest);
          if (!operator) {
            throw new Error(
              "Caractere não permitido na posição " + (position + 1) + ".",
            );
          }
          tokens.push({ kind: "operator", value: operator[0], position });
          position += operator[0].length;
        }
      }
      if (tokens.length > MAX_TOKENS) {
        throw new Error("Expressão muito complexa.");
      }
    }
    tokens.push({ kind: "end", value: "", position: source.length });
    return tokens;
  }

  class ExpressionParser {
    constructor(source) {
      this.tokens = tokenize(source);
      this.cursor = 0;
    }

    peek() {
      return this.tokens[this.cursor];
    }

    take(value) {
      if (this.peek().value !== value) {
        throw new Error(
          "Esperado “" +
            value +
            "” na posição " +
            (this.peek().position + 1) +
            ".",
        );
      }
      return this.tokens[this.cursor++];
    }

    parse() {
      const tree = this.expression(1, 0);
      if (this.peek().kind !== "end") {
        throw new Error(
          "Trecho inesperado na posição " + (this.peek().position + 1) + ".",
        );
      }
      return tree;
    }

    expression(minimum, depth) {
      if (depth > MAX_DEPTH)
        throw new Error("Expressão excede o limite de aninhamento.");
      let left = this.primary(depth + 1);
      while (PRECEDENCE[this.peek().value] >= minimum) {
        const operator = this.tokens[this.cursor++].value;
        const right = this.expression(PRECEDENCE[operator] + 1, depth + 1);
        left = { kind: "binary", operator, left, right };
      }
      return left;
    }

    primary(depth) {
      if (depth > MAX_DEPTH)
        throw new Error("Expressão excede o limite de aninhamento.");
      const token = this.peek();
      if (["+", "-", "!", "~"].includes(token.value)) {
        this.cursor++;
        return {
          kind: "unary",
          operator: token.value,
          value: this.primary(depth + 1),
        };
      }
      if (token.kind === "number") {
        this.cursor++;
        return { kind: "number", value: token.value };
      }
      if (token.value === "(") {
        this.cursor++;
        const value = this.expression(1, depth + 1);
        this.take(")");
        return value;
      }
      if (token.kind === "identifier") {
        this.cursor++;
        if (this.peek().value !== "(") {
          return { kind: "identifier", name: token.value };
        }
        const name = token.value.toLowerCase();
        if (!FUNCTIONS.has(name))
          throw new Error("Função não permitida: " + token.value);
        this.take("(");
        const args = [];
        if (this.peek().value !== ")") {
          do {
            args.push(this.expression(1, depth + 1));
            if (this.peek().value !== ",") break;
            this.take(",");
          } while (true);
        }
        this.take(")");
        const expected = ["min", "max", "bit"].includes(name) ? 2 : 1;
        if (args.length !== expected) {
          throw new Error(name + " espera " + expected + " argumento(s).");
        }
        return { kind: "call", name, args };
      }
      throw new Error(
        "Operando esperado na posição " + (token.position + 1) + ".",
      );
    }
  }

  function compileExpression(source) {
    return new ExpressionParser(source).parse();
  }

  function calculate(tree, resolve, readMemory) {
    if (tree.kind === "number") return tree.value;
    if (tree.kind === "identifier") return resolve(tree.name);
    if (tree.kind === "unary") {
      const value = calculate(tree.value, resolve, readMemory);
      switch (tree.operator) {
        case "+":
          return value;
        case "-":
          return -value;
        case "!":
          return value ? 0 : 1;
        case "~":
          return ~value >>> 0;
      }
    }
    if (tree.kind === "call") {
      const args = tree.args.map((argument) =>
        calculate(argument, resolve, readMemory),
      );
      switch (tree.name) {
        case "mem8":
          return readMemory(args[0], 1);
        case "mem16":
          return readMemory(args[0], 2);
        case "mem32":
          return readMemory(args[0], 4);
        case "s32":
          return args[0] | 0;
        case "u32":
          return args[0] >>> 0;
        case "abs":
          return Math.abs(args[0]);
        case "min":
          return Math.min(args[0], args[1]);
        case "max":
          return Math.max(args[0], args[1]);
        case "bit":
          if (!Number.isInteger(args[1]) || args[1] < 0 || args[1] > 31) {
            throw new Error("Índice de bit deve estar entre 0 e 31.");
          }
          return (args[0] >>> args[1]) & 1;
      }
    }
    const left = calculate(tree.left, resolve, readMemory);
    // These operators short-circuit, including when the right side reads memory.
    if (tree.operator === "&&" && !left) return 0;
    if (tree.operator === "||" && left) return 1;
    const right = calculate(tree.right, resolve, readMemory);
    switch (tree.operator) {
      case "+":
        return left + right;
      case "-":
        return left - right;
      case "*":
        return left * right;
      case "/":
        if (right === 0) throw new Error("Divisão por zero na expressão.");
        return Math.trunc(left / right);
      case "%":
        if (right === 0) throw new Error("Divisão por zero na expressão.");
        return left % right;
      case "&":
        return (left & right) >>> 0;
      case "|":
        return (left | right) >>> 0;
      case "^":
        return (left ^ right) >>> 0;
      case "<<":
        return (left << right) >>> 0;
      case ">>":
        return left >> right;
      case ">>>":
        return left >>> right;
      case "==":
        return Number(left === right);
      case "!=":
        return Number(left !== right);
      case "<":
        return Number(left < right);
      case "<=":
        return Number(left <= right);
      case ">":
        return Number(left > right);
      case ">=":
        return Number(left >= right);
      case "&&":
        return Number(Boolean(left && right));
      case "||":
        return Number(Boolean(left || right));
      default:
        throw new Error("Operação não reconhecida.");
    }
  }

  class LabDebugger {
    constructor(lab, options = {}) {
      if (!lab || typeof lab.step !== "function")
        throw new Error("Motor de CPU inválido.");
      this.lab = lab;
      this.breakpoints = [];
      this.watchpoints = [];
      this.watches = [];
      this.symbols = Object.create(null);
      this.traceLimit = options.traceLimit || 2000;
      this.operationBudget = options.operationBudget || 100000;
      this.onStep = null;
      this.nextId = 1;
      this.previousAccessHandler = lab.onAccess;
      this.accessHandler = (event) => {
        if (typeof this.previousAccessHandler === "function") {
          this.previousAccessHandler.call(lab, event);
        }
        this.handleAccess(event);
      };
      lab.onAccess = this.accessHandler;
      this.reset();
    }

    dispose() {
      if (this.lab.onAccess === this.accessHandler)
        this.lab.onAccess = this.previousAccessHandler;
      this.running = false;
    }

    reset(options = {}) {
      const keepBreakpoints = options.keepBreakpoints !== false;
      const keepWatches = options.keepWatches !== false;
      if (!keepBreakpoints) {
        this.breakpoints = [];
        this.watchpoints = [];
        if (this.lab.breakpoints) this.lab.breakpoints.clear();
      }
      if (!keepWatches) this.watches = [];
      for (const entry of [...this.breakpoints, ...this.watchpoints])
        entry.hits = 0;
      for (const entry of this.watches) delete entry.previous;
      this.trace = [];
      this.callStack = [];
      this.exceptionStack = [];
      this.coverage = new Map();
      this.running = false;
      this.operation = null;
      this.skipBreakpointOnce = null;
      this.pendingWatchpoint = null;
      this.currentAccesses = [];
      this.executing = false;
      this.lastStop = {
        kind: "ready",
        reason: "Depurador pronto.",
        address: this.lab.reg("PC"),
      };
    }

    setSymbols(symbols) {
      this.symbols = Object.create(null);
      const entries =
        symbols instanceof Map
          ? symbols.entries()
          : Object.entries(symbols || {});
      for (const [name, value] of entries) {
        const address =
          typeof value === "object" && value !== null ? value.address : value;
        this.symbols[name] = normalizeAddress(address);
      }
    }

    symbolFor(address) {
      const normalized = address >>> 0;
      return (
        Object.keys(this.symbols).find(
          (name) => this.symbols[name] === normalized,
        ) || ""
      );
    }

    readMemory(address, size) {
      const normalized = normalizeAddress(address);
      if (normalized + size > UINT32_MAX + 1)
        throw new Error("Leitura ultrapassa o espaço de endereços.");
      const bytes = this.lab.memory(normalized, size);
      let value = 0;
      for (let i = 0; i < size; i++) value += (bytes[i] & 255) * 2 ** (8 * i);
      return value >>> 0;
    }

    resolve(name, locals = {}) {
      const upper = name.toUpperCase();
      if (Object.prototype.hasOwnProperty.call(locals, upper))
        return locals[upper];
      if (upper === "TRUE") return 1;
      if (upper === "FALSE") return 0;
      if (upper === "STEPS" || upper === "T") return this.lab.t;
      if (["N", "Z", "C", "V", "Q"].includes(upper)) {
        return (
          (this.lab.reg("XPSR") >>>
            (31 - ["N", "Z", "C", "V", "Q"].indexOf(upper))) &
          1
        );
      }
      if (REGISTER_NAMES.has(upper))
        return this.lab.reg(REGISTER_ALIASES[upper] || upper);
      if (/^S(?:[0-9]|[12][0-9]|3[01])$/.test(upper)) {
        if (this.lab.model === 8)
          throw new Error(
            "Cortex-M3 não tem registradores de ponto flutuante.",
          );
        return this.lab.e.reg_read_float(
          this.lab.u.ARM_REG_S0 + Number(upper.slice(1)),
        );
      }
      if (Object.prototype.hasOwnProperty.call(this.symbols, name))
        return this.symbols[name];
      const match = Object.keys(this.symbols).find(
        (symbol) => symbol.toUpperCase() === upper,
      );
      if (match !== undefined) return this.symbols[match];
      throw new Error("Símbolo ou registrador desconhecido: " + name);
    }

    evaluateTree(tree, locals = {}) {
      const value = calculate(
        tree,
        (name) => this.resolve(name, locals),
        (a, s) => this.readMemory(a, s),
      );
      if (
        !Number.isFinite(value) ||
        Math.abs(value) > Number.MAX_SAFE_INTEGER
      ) {
        throw new Error("Resultado fora do intervalo numérico seguro.");
      }
      return value;
    }

    evaluate(expression, locals = {}) {
      return this.evaluateTree(compileExpression(expression), locals);
    }

    resolveAddress(expression) {
      return normalizeAddress(
        typeof expression === "string" ? this.evaluate(expression) : expression,
      );
    }

    addBreakpoint(options) {
      const config =
        typeof options === "number" ? { address: options } : options;
      const condition = (config.condition || "").trim();
      const hitTarget =
        config.hitTarget === undefined ? 1 : Number(config.hitTarget);
      if (
        !Number.isInteger(hitTarget) ||
        hitTarget < 1 ||
        hitTarget > 1000000000
      ) {
        throw new Error("Contagem de passagens deve ser um inteiro positivo.");
      }
      const entry = {
        id: "bp" + this.nextId++,
        address: this.resolveAddress(config.address) & 0xfffffffe,
        condition,
        hitTarget,
        hits: 0,
        enabled: config.enabled !== false,
        tree: condition ? compileExpression(condition) : null,
      };
      entry.address >>>= 0;
      this.breakpoints.push(entry);
      return entry.id;
    }

    removeBreakpoint(id) {
      this.breakpoints = this.breakpoints.filter((entry) => entry.id !== id);
    }

    addWatchpoint(options) {
      const address = this.resolveAddress(options.address);
      const size = options.size === undefined ? 1 : Number(options.size);
      if (
        !Number.isInteger(size) ||
        size < 1 ||
        size > 0x100000 ||
        address + size > UINT32_MAX + 1
      ) {
        throw new Error(
          "Faixa de watchpoint inválida; tamanho de 1 byte a 1 MiB.",
        );
      }
      const access = options.access || "write";
      if (!["read", "write", "access"].includes(access))
        throw new Error("Tipo de acesso inválido.");
      const condition = (options.condition || "").trim();
      const entry = {
        id: "wp" + this.nextId++,
        address,
        size,
        access,
        condition,
        enabled: options.enabled !== false,
        hits: 0,
        tree: condition ? compileExpression(condition) : null,
      };
      this.watchpoints.push(entry);
      return entry.id;
    }

    removeWatchpoint(id) {
      this.watchpoints = this.watchpoints.filter((entry) => entry.id !== id);
    }

    addWatch(expression) {
      const entry = {
        id: "watch" + this.nextId++,
        expression: expression.trim(),
        tree: compileExpression(expression),
      };
      this.watches.push(entry);
      return entry.id;
    }

    removeWatch(id) {
      this.watches = this.watches.filter((entry) => entry.id !== id);
    }

    watchValues() {
      return this.watches.map((entry) => {
        try {
          const value = this.evaluateTree(entry.tree);
          const result = {
            id: entry.id,
            expression: entry.expression,
            value,
            hex: "0x" + hex(value),
            changed: entry.previous !== undefined && entry.previous !== value,
            previous: entry.previous,
            error: null,
          };
          entry.previous = value;
          return result;
        } catch (error) {
          return {
            id: entry.id,
            expression: entry.expression,
            value: null,
            changed: false,
            error: error.message,
          };
        }
      });
    }

    handleAccess(event) {
      if (!this.executing || !event) return;
      const type =
        event.type === 16 ? "read" : event.type === 17 ? "write" : event.type;
      if (type !== "read" && type !== "write") return;
      const access = {
        type,
        address: Number(event.address) >>> 0,
        size: Number(event.size) || 1,
        value: Number(event.value || 0),
        pc:
          event.pc === undefined ? this.lab.reg("PC") : Number(event.pc) >>> 0,
      };
      if (this.currentAccesses.length < 64) this.currentAccesses.push(access);
      for (const entry of this.watchpoints) {
        if (
          !entry.enabled ||
          (entry.access !== "access" && entry.access !== type)
        )
          continue;
        if (
          access.address >= entry.address + entry.size ||
          access.address + access.size <= entry.address
        )
          continue;
        entry.hits++;
        try {
          if (
            entry.tree &&
            !this.evaluateTree(entry.tree, {
              ADDR: access.address,
              VALUE: access.value,
              SIZE: access.size,
              READ: Number(type === "read"),
              WRITE: Number(type === "write"),
            })
          )
            continue;
          if (!this.pendingWatchpoint) {
            this.pendingWatchpoint = {
              kind: "watchpoint",
              reason:
                "Watchpoint: " +
                (type === "write" ? "escrita" : "leitura") +
                " em 0x" +
                hex(access.address) +
                " (" +
                access.size +
                " byte(s)).",
              id: entry.id,
              address: access.address,
              access,
            };
          }
        } catch (error) {
          this.pendingWatchpoint = {
            kind: "expression-error",
            reason: "Condição do watchpoint: " + error.message,
            id: entry.id,
            address: access.address,
          };
        }
      }
    }

    checkBreakpoint(pc) {
      if (this.skipBreakpointOnce === pc) {
        this.skipBreakpointOnce = null;
        return null;
      }
      this.skipBreakpointOnce = null;
      for (const entry of this.breakpoints) {
        if (!entry.enabled || entry.address !== pc) continue;
        entry.hits++;
        try {
          if (entry.hits < entry.hitTarget) continue;
          if (entry.tree && !this.evaluateTree(entry.tree)) continue;
          return {
            kind: "breakpoint",
            reason:
              "Breakpoint em 0x" + hex(pc) + " · passagem " + entry.hits + ".",
            address: pc,
            id: entry.id,
          };
        } catch (error) {
          return {
            kind: "expression-error",
            reason: "Condição do breakpoint: " + error.message,
            address: pc,
            id: entry.id,
          };
        }
      }
      if (this.lab.breakpoints && this.lab.breakpoints.has(pc)) {
        return {
          kind: "breakpoint",
          reason: "Breakpoint em 0x" + hex(pc) + ".",
          address: pc,
        };
      }
      return null;
    }

    instructionAt(pc) {
      if (this.lab.byAddr && this.lab.byAddr.has(pc))
        return this.lab.byAddr.get(pc);
      return { address: pc, size: 2, mnemonic: "?", op: "" };
    }

    updateCallStack(before, after) {
      const instruction = before.instruction;
      const mnemonic = (instruction.mnemonic || "")
        .toLowerCase()
        .replace(/\.(?:w|n)$/, "");
      // Observed returns work for BX LR, POP {...,PC}, LDR PC and tail returns.
      const exceptionFrame =
        this.exceptionStack[this.exceptionStack.length - 1];
      const firstFrame = exceptionFrame ? exceptionFrame.callDepth : 0;
      for (let i = this.callStack.length - 1; i >= firstFrame; i--) {
        if (
          this.callStack[i].returnAddress === after.pc &&
          !/^blx?$/.test(mnemonic)
        ) {
          this.callStack.splice(i);
          break;
        }
      }
      if (
        /^blx?$/.test(mnemonic) &&
        after.pc !== (before.pc + instruction.size) >>> 0
      ) {
        const returnAddress = after.registers.LR & 0xfffffffe;
        this.callStack.push({
          from: before.pc,
          target: after.pc,
          returnAddress: returnAddress >>> 0,
          sp: after.registers.SP,
          step: this.lab.t,
          label: this.symbolFor(after.pc),
        });
        if (this.callStack.length > 256) {
          this.callStack.shift();
          for (const frame of this.exceptionStack) {
            frame.callDepth = Math.max(0, frame.callDepth - 1);
          }
        }
      }
    }

    updateExceptionStack(event, before, after) {
      if (event.type === "exception-entry") {
        this.exceptionStack.push({
          exception: event.exception,
          irq: event.irq,
          returnAddress:
            Number(event.returnAddress ?? event.returnPC ?? before.pc) >>> 0,
          target: after.pc,
          callDepth: this.callStack.length,
          step: this.lab.t,
        });
      } else if (event.type === "exception-return") {
        const frame = this.exceptionStack.pop();
        if (frame) this.callStack.splice(frame.callDepth);
      }
    }

    eventInstruction(event) {
      let label =
        Number.isInteger(event.irq) && event.irq >= 0
          ? "IRQ " + event.irq
          : "exceção " + event.exception;
      if (event.name && event.name !== label) label += " · " + event.name;
      return event.type === "exception-entry"
        ? "Entrada de " + label
        : "Retorno de " + label;
    }

    executeStep() {
      const pc = this.lab.reg("PC");
      const before = {
        pc,
        registers: this.lab.registers(),
        instruction: this.instructionAt(pc),
      };
      this.pendingWatchpoint = null;
      this.currentAccesses = [];
      this.executing = true;
      const previousStep = this.lab.t;
      let error = null;
      let alive = true;
      try {
        alive = this.lab.step();
      } catch (caught) {
        error = caught;
        alive = false;
      } finally {
        this.executing = false;
      }
      const after = { pc: this.lab.reg("PC"), registers: this.lab.registers() };
      const changed = {};
      for (const name of Object.keys(after.registers)) {
        if (before.registers[name] !== after.registers[name]) {
          changed[name] = {
            before: before.registers[name],
            after: after.registers[name],
          };
        }
      }
      const progressed = this.lab.t !== previousStep;
      const event =
        progressed && this.lab.lastStepEvent
          ? { ...this.lab.lastStepEvent }
          : null;
      const exceptionTransition =
        event &&
        (event.type === "exception-entry" || event.type === "exception-return");
      const trace = {
        step: this.lab.t,
        pc,
        nextPC: after.pc,
        instruction: exceptionTransition
          ? this.eventInstruction(event)
          : (
              (before.instruction.mnemonic || "?") +
              " " +
              (before.instruction.op || "")
            ).trim(),
        changed,
        accesses: this.currentAccesses.slice(),
        event,
        error: error ? error.message || String(error) : null,
      };
      if (progressed || error) {
        this.trace.push(trace);
        if (this.trace.length > this.traceLimit)
          this.trace.splice(0, this.trace.length - this.traceLimit);
        if (progressed && exceptionTransition) {
          this.updateExceptionStack(event, before, after);
        } else if (progressed) {
          this.coverage.set(pc, (this.coverage.get(pc) || 0) + 1);
          this.updateCallStack(before, after);
        }
      }
      if (typeof this.onStep === "function")
        this.onStep({ before, after, trace, progressed, event });
      if (error)
        return {
          kind: "fault",
          reason: error.message || String(error),
          address: pc,
        };
      if (this.pendingWatchpoint) return this.pendingWatchpoint;
      if (event && event.type === "breakpoint") {
        return {
          kind: "breakpoint",
          reason: this.lab.stopReason || "BKPT — execução pausada.",
          address: pc,
          event,
        };
      }
      if (!alive || this.lab.halted) {
        return {
          kind: "halt",
          reason: this.lab.stopReason || "CPU interrompida.",
          address: after.pc,
        };
      }
      return null;
    }

    stop(info, steps = 0) {
      this.running = false;
      this.operation = null;
      this.lastStop = info;
      return {
        stopped: true,
        reason: info.reason,
        kind: info.kind,
        steps,
        address: info.address,
        id: info.id,
      };
    }

    pause(reason = "Execução pausada.") {
      return this.stop({ kind: "pause", reason, address: this.lab.reg("PC") });
    }

    start(mode = "run", target = null) {
      if (this.lab.halted && !this.lab.breakpointPause)
        throw new Error(
          this.lab.stopReason + " — reinicie a CPU antes de continuar.",
        );
      if (!this.lab.code) throw new Error("Monte um programa primeiro.");
      const aliases = {
        over: "stepover",
        out: "stepout",
        cursor: "runto",
        continue: "run",
      };
      mode = aliases[mode] || mode;
      if (!["run", "stepover", "stepout", "runto", "step"].includes(mode))
        throw new Error("Modo de execução inválido.");
      const pc = this.lab.reg("PC");
      const operation = {
        mode,
        steps: 0,
        budget: mode === "run" ? Infinity : this.operationBudget,
        target: null,
      };
      const instruction = this.instructionAt(pc);
      if (mode === "stepover") {
        if (/^blx?(?:\.[wn])?$/i.test(instruction.mnemonic || "")) {
          operation.target = (pc + instruction.size) >>> 0;
          operation.mode = "runto";
        } else operation.mode = "step";
      } else if (mode === "stepout") {
        const exceptionFrame =
          this.exceptionStack[this.exceptionStack.length - 1];
        const frame =
          exceptionFrame && this.callStack.length <= exceptionFrame.callDepth
            ? exceptionFrame
            : this.callStack[this.callStack.length - 1];
        const address = frame
          ? frame.returnAddress
          : (this.lab.reg("LR") & 0xfffffffe) >>> 0;
        if (!this.lab.byAddr || !this.lab.byAddr.has(address)) {
          throw new Error(
            "Sem endereço de retorno conhecido no programa. Execute uma chamada BL/BLX primeiro.",
          );
        }
        operation.target = address;
        operation.mode = "runto";
      } else if (mode === "runto") {
        operation.target = (this.resolveAddress(target) & 0xfffffffe) >>> 0;
        if (!this.lab.byAddr || !this.lab.byAddr.has(operation.target)) {
          throw new Error(
            "O destino não coincide com uma instrução do programa.",
          );
        }
      }
      this.skipBreakpointOnce =
        mode !== "run" ||
        ((this.lastStop.kind === "breakpoint" ||
          this.lastStop.kind === "expression-error") &&
          this.lastStop.address === pc)
          ? pc
          : null;
      this.pendingWatchpoint = null;
      this.operation = operation;
      if (this.lab.breakpointPause) {
        this.lab.halted = false;
        this.lab.breakpointPause = false;
      }
      this.running = true;
      return {
        stopped: false,
        reason: "Executando.",
        kind: "running",
        steps: 0,
      };
    }

    step() {
      if (this.lab.halted && !this.lab.breakpointPause)
        return this.stop({
          kind: "halt",
          reason: this.lab.stopReason,
          address: this.lab.reg("PC"),
        });
      this.running = false;
      this.operation = null;
      const reason = this.executeStep();
      if (reason) return this.stop(reason, 1);
      return this.stop(
        {
          kind: "step",
          reason: "Passo " + this.lab.t + " concluído.",
          address: this.lab.reg("PC"),
        },
        1,
      );
    }

    runSlice(maxSteps = 100) {
      if (!this.running || !this.operation) {
        return {
          stopped: true,
          reason: this.lastStop.reason,
          kind: this.lastStop.kind,
          steps: 0,
        };
      }
      maxSteps = Math.max(1, Math.min(10000, Math.trunc(maxSteps) || 1));
      let steps = 0;
      while (steps < maxSteps) {
        const operation = this.operation;
        const pc = this.lab.reg("PC");
        if (operation.target !== null && pc === operation.target) {
          return this.stop(
            {
              kind: "target",
              reason: "Destino alcançado em 0x" + hex(pc) + ".",
              address: pc,
            },
            steps,
          );
        }
        const breakpoint = this.checkBreakpoint(pc);
        if (breakpoint) return this.stop(breakpoint, steps);
        const result = this.executeStep();
        steps++;
        operation.steps++;
        if (result) return this.stop(result, steps);
        if (!this.running) {
          return {
            stopped: true,
            reason: this.lastStop.reason,
            kind: this.lastStop.kind,
            steps,
          };
        }
        if (
          operation.target !== null &&
          this.lab.reg("PC") === operation.target
        ) {
          return this.stop(
            {
              kind: "target",
              reason: "Destino alcançado em 0x" + hex(operation.target) + ".",
              address: operation.target,
            },
            steps,
          );
        }
        if (operation.mode === "step") {
          return this.stop(
            {
              kind: "step",
              reason: "Passo " + this.lab.t + " concluído.",
              address: this.lab.reg("PC"),
            },
            steps,
          );
        }
        if (operation.steps >= operation.budget) {
          return this.stop(
            {
              kind: "budget",
              reason:
                "Limite de " +
                operation.budget.toLocaleString("pt-BR") +
                " passos atingido antes do destino. CPU pausada.",
              address: this.lab.reg("PC"),
            },
            steps,
          );
        }
      }
      return { stopped: false, reason: "Executando.", kind: "running", steps };
    }

    serializeConfig() {
      return {
        breakpoints: this.breakpoints.map(
          ({ address, condition, hitTarget, enabled }) => ({
            address,
            condition,
            hitTarget,
            enabled,
          }),
        ),
        watchpoints: this.watchpoints.map(
          ({ address, size, access, condition, enabled }) => ({
            address,
            size,
            access,
            condition,
            enabled,
          }),
        ),
        watches: this.watches.map((entry) => entry.expression),
      };
    }

    restoreConfig(config = {}) {
      // Validate in temporary arrays before replacing the current configuration.
      const previous = {
        breakpoints: this.breakpoints,
        watchpoints: this.watchpoints,
        watches: this.watches,
        nextId: this.nextId,
      };
      this.breakpoints = [];
      this.watchpoints = [];
      this.watches = [];
      try {
        if (
          (config.breakpoints || []).length > 256 ||
          (config.watchpoints || []).length > 256 ||
          (config.watches || []).length > 256
        ) {
          throw new Error(
            "Projeto excede o limite de 256 itens por lista de depuração.",
          );
        }
        for (const entry of config.breakpoints || []) this.addBreakpoint(entry);
        for (const entry of config.watchpoints || []) this.addWatchpoint(entry);
        for (const expression of config.watches || [])
          this.addWatch(expression);
      } catch (error) {
        Object.assign(this, previous);
        throw error;
      }
    }

    state() {
      return {
        running: this.running,
        lastStop: { ...this.lastStop },
        operation: this.operation ? { ...this.operation } : null,
        breakpoints: this.breakpoints.map(({ tree, ...entry }) => ({
          ...entry,
        })),
        watchpoints: this.watchpoints.map(({ tree, ...entry }) => ({
          ...entry,
        })),
        watches: this.watchValues(),
        callStack: this.callStack.map((frame) => ({ ...frame })),
        exceptionStack: this.exceptionStack.map((frame) => ({ ...frame })),
        trace: this.trace.slice(),
        coverage: Array.from(this.coverage, ([address, hits]) => ({
          address,
          hits,
        })),
      };
    }
  }

  LabDebugger.normalizeAddress = normalizeAddress;
  LabDebugger.compileExpression = compileExpression;
  root.LabDebugger = LabDebugger;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { LabDebugger, compileExpression, normalizeAddress };
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
