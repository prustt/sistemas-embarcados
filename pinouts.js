/* Physical package pinouts — GPL-2.0-or-later.
 * Pin 1..N follow the manufacturers' top-view diagrams, counterclockwise.
 * Only GPIO functions are modeled. Supplies, reset, clock and dedicated pins
 * are visible for orientation, not electrical connection or alternate-function simulation.
 */
(function (root) {
  "use strict";
  function make(packageName, source, reference, names) {
    const pins = names
      .trim()
      .split(/\s+/)
      .map((name, index) => {
        const gpio = /^P([A-Z])(\d+)$/.exec(name);
        let kind = "other";
        if (gpio) kind = "gpio";
        else if (/^(VSS|GND)/.test(name)) kind = "ground";
        else if (/^(VDD|VBAT|VCAP|VREF)/.test(name)) kind = "power";
        else if (/^(N?RST)$/.test(name)) kind = "reset";
        else if (/^(X?OSC)/.test(name)) kind = "clock";
        return Object.freeze({
          number: index + 1,
          name,
          kind,
          ...(gpio ? { port: gpio[1], bit: Number(gpio[2]) } : {}),
        });
      });
    return Object.freeze({
      package: packageName,
      view: "top",
      source,
      reference,
      pins: Object.freeze(pins),
    });
  }
  const LabPinouts = {
    stm32f103c8: make(
      "LQFP48",
      "https://www.st.com/resource/en/datasheet/stm32f103c8.pdf#page=26",
      "DS5319, Figure 8, p.26",
      `
      VBAT PC13 PC14 PC15 PD0 PD1 NRST VSSA VDDA PA0 PA1 PA2 PA3 PA4 PA5 PA6
      PA7 PB0 PB1 PB2 PB10 PB11 VSS VDD PB12 PB13 PB14 PB15 PA8 PA9 PA10 PA11
      PA12 PA13 VSS VDD PA14 PA15 PB3 PB4 PB5 PB6 PB7 BOOT0 PB8 PB9 VSS VDD
    `,
    ),
    stm32f411ce: make(
      "UFQFPN48",
      "https://www.st.com/resource/en/datasheet/stm32f411ce.pdf#page=35",
      "DS10314, Figure 10, p.35",
      `
      VBAT PC13 PC14 PC15 PH0 PH1 NRST VSSA/VREF- VDDA/VREF+ PA0 PA1 PA2 PA3 PA4 PA5 PA6
      PA7 PB0 PB1 PB2 PB10 VCAP_1 VSS VDD PB12 PB13 PB14 PB15 PA8 PA9 PA10 PA11
      PA12 PA13 VSS VDD PA14 PA15 PB3 PB4 PB5 PB6 PB7 BOOT0 PB8 PB9 VSS VDD
    `,
    ),
    stm32f407vg: make(
      "LQFP100",
      "https://www.st.com/resource/en/datasheet/dm00037051.pdf#page=44",
      "DS8626, Figure 13, p.44",
      `
      PE2 PE3 PE4 PE5 PE6 VBAT PC13 PC14 PC15 VSS VDD PH0 PH1 NRST PC0 PC1
      PC2 PC3 VDD VSSA VREF+ VDDA PA0 PA1 PA2 PA3 VSS VDD PA4 PA5 PA6 PA7
      PC4 PC5 PB0 PB1 PB2 PE7 PE8 PE9 PE10 PE11 PE12 PE13 PE14 PE15 PB10 PB11
      VCAP_1 VDD PB12 PB13 PB14 PB15 PD8 PD9 PD10 PD11 PD12 PD13 PD14 PD15 PC6 PC7
      PC8 PC9 PA8 PA9 PA10 PA11 PA12 PA13 VCAP_2 VSS VDD PA14 PA15 PC10 PC11 PC12
      PD0 PD1 PD2 PD3 PD4 PD5 PD6 PD7 PB3 PB4 PB5 PB6 PB7 BOOT0 PB8 PB9
      PE0 PE1 VSS VDD
    `,
    ),
    tm4c123gh6pm: make(
      "LQFP64",
      "https://www.ti.com/lit/ds/symlink/tm4c123gh6pm.pdf#page=1328",
      "SPMS376E, Figure 22-1, Table 23-5, pp.1328/1351-1352",
      `
      PB6 VDDA GNDA PB7 PF4 PE3 PE2 PE1 PE0 PD7 VDD GND PC7 PC6 PC5 PC4
      PA0 PA1 PA2 PA3 PA4 PA5 PA6 PA7 VDDC VDD GND PF0 PF1 PF2 PF3 WAKE
      HIB XOSC0 GNDX XOSC1 VBAT RST GND OSC0 OSC1 VDD PD4 PD5 PB0 PB1 PB2 PB3
      PC3 PC2 PC1 PC0 PD6 VDD GND VDDC PB5 PB4 PE4 PE5 PD0 PD1 PD2 PD3
    `,
    ),
    tm4c1294ncpdt: make(
      "TQFP128",
      "https://www.ti.com/lit/ds/symlink/tm4c1294ncpdt.pdf#page=1771",
      "SPMS433B, Figure 25-1, Table 26-5, pp.1771/1808-1810",
      `
      PD0 PD1 PD2 PD3 PQ0 PQ1 VDD VDDA VREFA+ GNDA PQ2 PE3 PE2 PE1 PE0 VDD
      GND PK0 PK1 PK2 PK3 PC7 PC6 PC5 PC4 VDD PQ3 VDD PH0 PH1 PH2 PH3
      PA0 PA1 PA2 PA3 PA4 PA5 VDD PA6 PA7 PF0 PF1 PF2 PF3 PF4 VDD GND
      PG0 PG1 VDD VDD EN0RXIN EN0RXIP GND EN0TXON EN0TXOP GND RBIAS PK7 PK6 PK5 PK4 WAKE
      HIB XOSC0 XOSC1 VBAT VDD RST PM7 PM6 PM5 PM4 PM3 PM2 PM1 PM0 VDD GND
      PL0 PL1 PL2 PL3 PL4 PL5 VDDC OSC0 OSC1 VDD PB2 PB3 PL7 PL6 PB0 PB1
      PC3 PC2 PC1 PC0 VDD PQ4 PP2 PP3 PP4 PP5 PN0 PN1 PN2 PN3 PN4 PN5
      VDD GND VDDC PJ0 PJ1 PP0 PP1 PB5 PB4 VDD PE4 PE5 PD4 PD5 PD6 PD7
    `,
    ),
  };
  root.LabPinouts = Object.freeze(LabPinouts);
  if (typeof module !== "undefined") module.exports = LabPinouts;
})(typeof globalThis !== "undefined" ? globalThis : this);
