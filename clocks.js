/* Clock-tree planner. GPL-2.0-or-later.
 * Frequency arithmetic only: this module does not write RCC/SYSCTL, execute
 * clock-startup sequences, or assign cycle timings to Unicorn instructions.
 * Limits assume normal Run mode, 3.3 V and the appropriate regulator scale.
 */
(function (root) {
  "use strict";
  const MHz = 1000000;
  const AHB = [1, 2, 4, 8, 16, 64, 128, 256, 512];
  const APB = [1, 2, 4, 8, 16];
  const SOURCES = {
    stm32f103c8: [
      "https://www.st.com/resource/en/datasheet/stm32f103c8.pdf",
      "https://www.st.com/resource/en/reference_manual/rm0008-stm32f101xx-stm32f102xx-stm32f103xx-stm32f105xx-and-stm32f107xx-advanced-armbased-32bit-mcus-stmicroelectronics.pdf",
    ],
    stm32f407vg: [
      "https://www.st.com/resource/en/datasheet/dm00037051.pdf",
      "https://www.st.com/resource/en/reference_manual/dm00031020.pdf",
    ],
    stm32f411ce: [
      "https://www.st.com/resource/en/datasheet/stm32f411ce.pdf",
      "https://www.st.com/resource/en/reference_manual/DM00119316.pdf",
    ],
    tm4c123gh6pm: ["https://www.ti.com/lit/ds/symlink/tm4c123gh6pm.pdf"],
    tm4c1294ncpdt: [
      "https://www.ti.com/lit/ds/symlink/tm4c1294ncpdt.pdf",
      "https://www.ti.com/lit/pdf/spmz850",
    ],
  };
  function idOf(device) {
    const id = typeof device === "string" ? device : device?.id;
    if (!Object.hasOwn(SOURCES, id))
      throw Error("Perfil de clock desconhecido.");
    return id;
  }
  function defaultConfig(device) {
    const id = idOf(device);
    if (id === "stm32f103c8")
      return {
        sysSource: "PLL",
        pllSource: "HSE",
        hseMHz: 8,
        prediv: 1,
        mul: 9,
        ahbDiv: 1,
        apb1Div: 2,
        apb2Div: 1,
        adcDiv: 6,
        usbDiv: 1.5,
      };
    if (id.startsWith("stm32"))
      return {
        sysSource: "PLL",
        pllSource: "HSE",
        hseMHz: id === "stm32f411ce" ? 25 : 8,
        m: id === "stm32f411ce" ? 25 : 8,
        n: id === "stm32f411ce" ? 200 : 336,
        p: 2,
        q: id === "stm32f411ce" ? 4 : 7,
        ahbDiv: 1,
        apb1Div: id === "stm32f411ce" ? 2 : 4,
        apb2Div: id === "stm32f411ce" ? 1 : 2,
        adcDiv: 4,
        ...(id === "stm32f411ce" ? { timpre: 0 } : {}),
      };
    return {
      sysSource: "PLL",
      pllSource: "MOSC",
      moscMHz: id === "tm4c123gh6pm" ? 16 : 25,
      sysDiv: id === "tm4c123gh6pm" ? 5 : 4,
      ...(id === "tm4c1294ncpdt" ? { vcoMHz: 480 } : {}),
      pwmDiv: 1,
      uartSource: "SYSCLK",
    };
  }
  const options = (values) =>
    values.map((value) => ({ value, label: String(value) }));
  const select = (key, label, values, group, when) => ({
    key,
    label,
    type: "select",
    options: options(values),
    group,
    when,
  });
  const number = (key, label, min, max, step, group, when) => ({
    key,
    label,
    type: "number",
    min,
    max,
    step,
    group,
    when,
  });
  function fields(device) {
    const id = idOf(device),
      stm = id.startsWith("stm32"),
      f1 = id === "stm32f103c8";
    const usePLL = { sysSource: "PLL" };
    if (stm) {
      const list = [
        select("sysSource", "Fonte de SYSCLK", ["HSI", "HSE", "PLL"], "Fonte"),
        number("hseMHz", "Cristal HSE (MHz)", 4, f1 ? 16 : 26, 0.001, "Fonte"),
        select("pllSource", "Referência da PLL", ["HSI", "HSE"], "PLL", usePLL),
      ];
      if (f1)
        list.push(
          select("prediv", "HSE antes da PLL ÷", [1, 2], "PLL", usePLL),
          number("mul", "PLL ×", 2, 16, 1, "PLL", usePLL),
        );
      else
        list.push(
          number("m", "PLLM ÷", 2, 63, 1, "PLL", usePLL),
          number("n", "PLLN ×", 50, 432, 1, "PLL", usePLL),
          select("p", "PLLP ÷", [2, 4, 6, 8], "PLL", usePLL),
          number("q", "PLLQ ÷", 2, 15, 1, "PLL", usePLL),
        );
      list.push(
        select("ahbDiv", "AHB ÷", AHB, "Barramentos"),
        select("apb1Div", "APB1 ÷", APB, "Barramentos"),
        select("apb2Div", "APB2 ÷", APB, "Barramentos"),
        select("adcDiv", "ADC ÷ PCLK2", [2, 4, 6, 8], "Periféricos"),
      );
      if (id === "stm32f411ce")
        list.push(select("timpre", "TIMPRE", [0, 1], "Periféricos"));
      if (f1)
        list.push(
          select("usbDiv", "USB ÷ PLL", [1, 1.5], "Periféricos", usePLL),
        );
      return list;
    }
    return [
      select("sysSource", "Fonte de SYSCLK", ["PIOSC", "MOSC", "PLL"], "Fonte"),
      number(
        "moscMHz",
        "Cristal MOSC (MHz)",
        id === "tm4c123gh6pm" ? 4 : 5,
        25,
        0.001,
        "Fonte",
      ),
      select(
        "pllSource",
        "Referência da PLL",
        ["PIOSC", "MOSC"],
        "PLL",
        usePLL,
      ),
      ...(id === "tm4c1294ncpdt"
        ? [select("vcoMHz", "PLL VCO (MHz)", [320, 480], "PLL", usePLL)]
        : []),
      number(
        "sysDiv",
        "Divisor efetivo de SYSCLK",
        1,
        id === "tm4c123gh6pm" ? 128 : 1024,
        1,
        "Barramentos",
      ),
      select("pwmDiv", "PWM ÷ SYSCLK", [1, 2, 4, 8, 16, 32, 64], "Periféricos"),
      select("uartSource", "Clock da UART", ["SYSCLK", "PIOSC"], "Periféricos"),
    ];
  }
  function presets(device) {
    const id = idOf(device),
      config = defaultConfig(id),
      result = [];
    const max =
      id === "stm32f103c8"
        ? 72
        : id === "stm32f407vg"
          ? 168
          : id === "stm32f411ce"
            ? 100
            : id === "tm4c123gh6pm"
              ? 80
              : 120;
    result.push({ id: "performance", name: max + " MHz · PLL", config });
    if (id === "stm32f411ce")
      result.push({
        id: "usb96",
        name: "96 MHz · USB 48 MHz",
        config: { ...config, n: 192, q: 4 },
      });
    if (id === "stm32f407vg")
      result.push({
        id: "usb84",
        name: "84 MHz · USB 48 MHz",
        config: { ...config, p: 4, apb1Div: 2, apb2Div: 1 },
      });
    result.push({
      id: "internal",
      name: (id === "stm32f103c8" ? "8" : "16") + " MHz · oscilador interno",
      config: {
        ...config,
        sysSource: id.startsWith("stm32") ? "HSI" : "PIOSC",
        ahbDiv: 1,
        apb1Div: 1,
        apb2Div: 1,
        sysDiv: 1,
      },
    });
    return result;
  }
  function calculate(device, input = {}) {
    const id = idOf(device),
      f1 = id === "stm32f103c8",
      f411 = id === "stm32f411ce",
      stm = id.startsWith("stm32"),
      ti123 = id === "tm4c123gh6pm";
    const defaults = defaultConfig(id),
      config = { ...defaults },
      errors = [],
      warnings = [],
      nodes = [],
      values = {};
    if (!input || typeof input !== "object" || Array.isArray(input)) input = {};
    for (const field of fields(id)) {
      if (Object.hasOwn(input, field.key)) config[field.key] = input[field.key];
      const value = config[field.key];
      if (field.type === "select") {
        const numeric = typeof field.options[0].value === "number";
        if (
          numeric &&
          value !== "" &&
          value !== null &&
          typeof value !== "boolean"
        )
          config[field.key] = Number(value);
        if (!field.options.some((option) => option.value === config[field.key]))
          errors.push(field.label + ": opção inválida.");
      } else {
        config[field.key] =
          value === "" || value === null || typeof value === "boolean"
            ? NaN
            : Number(value);
        if (
          !Number.isFinite(config[field.key]) ||
          (field.step === 1 && !Number.isInteger(config[field.key]))
        )
          errors.push(
            field.label +
              ": informe um número" +
              (field.step === 1 ? " inteiro." : "."),
          );
      }
    }
    // Invalid form values never propagate NaN/Infinity into display geometry.
    if (errors.length)
      return {
        valid: false,
        errors,
        warnings,
        values,
        nodes,
        config,
        sources: SOURCES[id],
        notes: notes(id),
      };
    const node = (key, label, hz, parent, formula, active = true) => {
      const n = {
        id: key,
        label,
        hz: Number.isFinite(hz) ? hz : null,
        parent: parent || null,
        formula: formula || "",
        active,
      };
      nodes.push(n);
      if (active) values[key] = n.hz;
      return hz;
    };
    const range = (name, value, min, max) => {
      if (!Number.isFinite(value) || value < min - 1e-6 || value > max + 1e-6)
        errors.push(name + ": permitido " + min + " a " + max + ".");
    };
    const pll = config.sysSource === "PLL";
    let sys, pllOut;
    if (stm) {
      const hsi = f1 ? 8 * MHz : 16 * MHz,
        hse = config.hseMHz * MHz;
      const hseUsed =
        config.sysSource === "HSE" || (pll && config.pllSource === "HSE");
      if (hseUsed) range("Cristal HSE (MHz)", config.hseMHz, 4, f1 ? 16 : 26);
      node(
        "HSI",
        "HSI",
        hsi,
        null,
        "RC interno",
        config.sysSource === "HSI" || (pll && config.pllSource === "HSI"),
      );
      node("HSE", "HSE", hse, null, "Cristal externo", hseUsed);
      if (f1) {
        if (pll) {
          range("Multiplicador PLL", config.mul, 2, 16);
        }
        const ref = config.pllSource === "HSI" ? hsi / 2 : hse / config.prediv;
        node(
          "PLL_IN",
          "Entrada PLL",
          ref,
          config.pllSource,
          config.pllSource === "HSI" ? "HSI ÷ 2" : "HSE ÷ " + config.prediv,
          pll,
        );
        pllOut = ref * config.mul;
        node("PLL_OUT", "Saída PLL", pllOut, "PLL_IN", "× " + config.mul, pll);
        node(
          "PLL48",
          "Clock USB",
          pllOut / config.usbDiv,
          "PLL_OUT",
          "÷ " + config.usbDiv,
          pll,
        );
        if (pll) {
          range("Entrada PLL (MHz)", ref / MHz, 1, 25);
          range("Saída PLL (MHz)", pllOut / MHz, 16, 72);
        }
      } else {
        if (pll) {
          range("PLLM", config.m, 2, 63);
          range("PLLN", config.n, 50, 432);
          range("PLLQ", config.q, 2, 15);
        }
        const ref = (config.pllSource === "HSI" ? hsi : hse) / config.m,
          vco = ref * config.n;
        node(
          "PLL_IN",
          "Entrada VCO",
          ref,
          config.pllSource,
          "÷ M (" + config.m + ")",
          pll,
        );
        node("VCO", "VCO", vco, "PLL_IN", "× N (" + config.n + ")", pll);
        pllOut = vco / config.p;
        node("PLL_OUT", "PLL P", pllOut, "VCO", "÷ P (" + config.p + ")", pll);
        node(
          "PLL48",
          "PLL Q / USB",
          vco / config.q,
          "VCO",
          "÷ Q (" + config.q + ")",
          pll,
        );
        if (pll) {
          range("Entrada VCO (MHz)", ref / MHz, 1, 2);
          range("VCO (MHz)", vco / MHz, 100, 432);
          range("PLL P (MHz)", pllOut / MHz, f411 ? 0 : 24, f411 ? 100 : 168);
        }
      }
      sys =
        config.sysSource === "PLL"
          ? pllOut
          : config.sysSource === "HSI"
            ? hsi
            : hse;
      node(
        "SYSCLK",
        "SYSCLK",
        sys,
        pll ? "PLL_OUT" : config.sysSource,
        "MUX · " + config.sysSource,
      );
      const hclk = node(
        "HCLK",
        "AHB / CPU",
        sys / config.ahbDiv,
        "SYSCLK",
        "÷ " + config.ahbDiv,
      );
      const pclk1 = node(
        "PCLK1",
        "APB1",
        hclk / config.apb1Div,
        "HCLK",
        "÷ " + config.apb1Div,
      );
      const pclk2 = node(
        "PCLK2",
        "APB2",
        hclk / config.apb2Div,
        "HCLK",
        "÷ " + config.apb2Div,
      );
      const timer = (pclk, div) =>
        f411 && config.timpre === 1
          ? div <= 2
            ? hclk
            : pclk * 4
          : div === 1
            ? pclk
            : pclk * 2;
      node(
        "TIM_APB1",
        "Timers APB1",
        timer(pclk1, config.apb1Div),
        "PCLK1",
        f411 && config.timpre ? "TIMPRE=1" : "APB ÷1: ×1; demais: ×2",
      );
      node(
        "TIM_APB2",
        "Timers APB2",
        timer(pclk2, config.apb2Div),
        "PCLK2",
        f411 && config.timpre ? "TIMPRE=1" : "APB ÷1: ×1; demais: ×2",
      );
      const adc = node(
        "ADC",
        "ADC",
        pclk2 / config.adcDiv,
        "PCLK2",
        "÷ " + config.adcDiv,
      );
      node(
        "SYSTICK_EXT",
        "SysTick externo",
        hclk / 8,
        "HCLK",
        "HCLK ÷ 8 · opção do mux",
      );
      range("SYSCLK (MHz)", sys / MHz, 0, f1 ? 72 : f411 ? 100 : 168);
      range("APB1 (MHz)", pclk1 / MHz, 0, f1 ? 36 : f411 ? 50 : 42);
      range("APB2 (MHz)", pclk2 / MHz, 0, f1 ? 72 : f411 ? 100 : 84);
      range("ADC (MHz)", adc / MHz, 0, f1 ? 14 : 36);
      if (pll && Math.abs(values.PLL48 - 48 * MHz) > 1)
        warnings.push(
          "O ramo USB não está em 48 MHz. USB FS requer 48 MHz; os periféricos desse ramo não são simulados.",
        );
    } else {
      const piosc = 16 * MHz,
        mosc = config.moscMHz * MHz;
      const moscUsed =
        config.sysSource === "MOSC" || (pll && config.pllSource === "MOSC");
      if (moscUsed)
        range("Cristal MOSC (MHz)", config.moscMHz, ti123 && !pll ? 4 : 5, 25);
      node(
        "PIOSC",
        "PIOSC",
        piosc,
        null,
        "RC interno",
        config.sysSource === "PIOSC" ||
          (pll && config.pllSource === "PIOSC") ||
          config.uartSource === "PIOSC",
      );
      node("MOSC", "MOSC", mosc, null, "Cristal externo", moscUsed);
      const vco = (ti123 ? 400 : config.vcoMHz) * MHz;
      node("VCO", "PLL VCO", vco, config.pllSource, "VCO alvo nominal", pll);
      if (pll && moscUsed) {
        if (ti123) {
          const crystals = [
            5, 5.12, 6, 6.144, 7.3728, 8, 8.192, 10, 10.24, 12, 12.288, 13.56,
            14.31818, 16, 16.384, 18, 20, 24, 25,
          ];
          if (!crystals.some((x) => Math.abs(x - config.moscMHz) < 0.000001))
            errors.push(
              "MOSC: frequência sem codificação XTAL suportada pelo PLL do TM4C123.",
            );
        } else
          warnings.push(
            "VCO é o alvo nominal; programe MINT/MFRAC/N/Q conforme o cristal. O cálculo não gera esses registradores.",
          );
      }
      if (ti123 && pll && config.sysDiv === 7)
        errors.push(
          "TM4C123: divisor efetivo 7 é reservado (tabela DIV400=1).",
        );
      range(
        "Divisor SYSCLK",
        config.sysDiv,
        pll ? (ti123 ? 5 : 1) : 1,
        ti123 ? (pll ? 128 : 64) : 1024,
      );
      const parent = pll ? "VCO" : config.sysSource;
      const selected = pll ? vco : config.sysSource === "MOSC" ? mosc : piosc;
      sys = selected / config.sysDiv;
      node("SYSCLK", "SYSCLK", sys, parent, "÷ " + config.sysDiv);
      node("HCLK", "AHB / CPU", sys, "SYSCLK", "× 1");
      node("PCLK1", "APB", sys, "SYSCLK", "× 1");
      node("PWM", "PWM", sys / config.pwmDiv, "SYSCLK", "÷ " + config.pwmDiv);
      node(
        "UART",
        "Clock UART",
        config.uartSource === "PIOSC" ? piosc : sys,
        config.uartSource,
        "MUX · " + config.uartSource,
      );
      range("SYSCLK (MHz)", sys / MHz, 0, ti123 ? 80 : 120);
      if (!ti123 && config.sysSource === "MOSC")
        warnings.push(
          "TM4C1294: MOSC direto em OSCCLK é afetado pelo erratum SYSCTL#23; prefira PIOSC ou PLL e consulte a errata.",
        );
      if (ti123)
        warnings.push(
          "Divisor exibido é o divisor efetivo de 400 MHz com DIV400=1; não é o valor bruto SYSDIV2 nem o nome do parâmetro TivaWare.",
        );
    }
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      values,
      nodes,
      config,
      sources: SOURCES[id],
      notes: notes(id),
    };
  }
  function notes(id) {
    return [
      "Planejador de frequências nominais. Não escreve RCC/SYSCTL nem altera o tempo de execução ou o analisador lógico.",
      "Limites para Run normal a 3,3 V e escala de tensão adequada. Latência Flash, estabilização, jitter e sequência de troca não são modelados.",
      id.startsWith("stm32")
        ? "Ramo principal, barramentos, timers e ADC. PLL de áudio, RTC/LSE/LSI, MCO e modos de baixo consumo não incluídos."
        : "Ramo principal, barramentos, PWM e clock UART. RTC, LFOSC, clocks alternativos de módulos e Deep Sleep não incluídos.",
    ];
  }
  const api = { defaultConfig, fields, presets, calculate, sources: SOURCES };
  root.LabClocks = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
