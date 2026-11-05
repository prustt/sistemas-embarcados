/* Aba Instalação: o que cada sistema precisa para gravar e monitorar a placa pelo navegador. GPL-2.0-or-later. */
(function (root) {
  "use strict";
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const SITE = "https://prustt.github.io/sistemas-embarcados/";
  const TI_ZIP =
    "https://dr-download.ti.com/software-development/driver-or-library/MD-0mJeTxq532/01.00.00.0A/spmc016a.zip";
  const TI_PAGINA = "https://www.ti.com/tool/download/SW-ICDI-DRIVERS";

  // Por enquanto só as placas Tiva com depurador ICDI (EK-TM4C1294XL e EK-TM4C123GXL).
  const SISTEMAS = [
    {
      id: "windows",
      nome: "Windows",
      passos: [
        { titulo: "Use o Chrome ou o Edge", texto: "O Firefox não tem WebUSB nem Web Serial." },
        {
          titulo: "Baixe o driver da placa (Stellaris ICDI Drivers, da TI)",
          texto:
            "Se o Keil ou o LM Flash Programmer já usaram a placa neste computador, o driver já está instalado e você pode pular para o último passo.",
          links: [
            ["Baixar o driver (zip, site da TI)", TI_ZIP],
            ["Página oficial do driver", TI_PAGINA],
          ],
        },
        {
          titulo: "Instale o driver pelo Gerenciador de Dispositivos",
          texto:
            "Extraia o zip e ligue a placa pela USB DEBUG. No Gerenciador de Dispositivos, em cada \"In-Circuit Debug Interface\" com ⚠: Atualizar driver → Procurar no computador → pasta stellaris_icdi_drivers. No fim aparecem \"Stellaris ICDI JTAG/SWD Interface\" e \"Stellaris Virtual Serial Port (COMx)\".",
        },
        {
          titulo: "Se o Chrome não mostrar a placa ao conectar",
          texto:
            "É raro, porque o driver da TI usa o WinUSB, que é o que o Chrome precisa. Se acontecer, no Zadig: Options → List All Devices → \"In-Circuit Debug Interface (Interface 2)\" → WinUSB → Replace Driver.",
          links: [["Zadig", "https://zadig.akeo.ie/"]],
        },
      ],
    },
    {
      id: "mac",
      nome: "macOS",
      passos: [
        {
          titulo: "Nada para instalar",
          texto:
            "O macOS já reconhece a placa: a gravação usa a USB direto e a serial aparece sozinha como /dev/cu.usbmodem…",
        },
        { titulo: "Use o Chrome ou o Edge", texto: "O Safari não tem WebUSB nem Web Serial." },
      ],
    },
    {
      id: "linux",
      nome: "Linux",
      passos: [
        {
          titulo: "Use o Google Chrome, o Chromium ou o Edge",
          texto: "Prefira o pacote .deb ou .rpm: o Chromium em Snap do Ubuntu bloqueia o acesso à USB e à serial.",
        },
        {
          titulo: "Libere a placa para o seu usuário (regra do udev)",
          texto:
            "Sem isso o Chrome mostra a placa, mas diz \"Access denied\" ao conectar. A regra também impede o ModemManager de mexer na serial da placa.",
          links: [["Ver a regra (70-tiva-icdi.rules)", "instalacao/linux/70-tiva-icdi.rules"]],
          comandos: [
            "sudo curl -fsSL -o /etc/udev/rules.d/70-tiva-icdi.rules " + SITE + "instalacao/linux/70-tiva-icdi.rules",
            "sudo udevadm control --reload-rules && sudo udevadm trigger",
          ],
        },
        {
          titulo: "Desligue e ligue a placa de novo",
          texto: "Não precisa de driver nem de reiniciar: o kernel já reconhece a serial da placa (/dev/ttyACM0).",
        },
      ],
    },
    {
      id: "android",
      nome: "Android",
      passos: [
        { titulo: "Use o Chrome", texto: "Testado num celular Motorola: gravação e monitor ao vivo funcionando." },
        {
          titulo: "Ligue a placa com um cabo ou adaptador OTG",
          texto: "Da USB-C (ou micro-USB) do celular para a micro-USB DEBUG da placa. O próprio celular alimenta a placa.",
        },
        {
          titulo: "Aceite o pedido de acesso USB",
          texto:
            "Na primeira conexão o Android pergunta se o Chrome pode usar o dispositivo. Não há driver para instalar; a serial vai direto pela USB.",
        },
      ],
    },
    {
      id: "chromeos",
      nome: "ChromeOS",
      passos: [{ titulo: "Nada para instalar", texto: "O Chrome do Chromebook já tem WebUSB e Web Serial." }],
    },
    {
      id: "ios",
      nome: "iPhone / iPad",
      passos: [
        {
          titulo: "Não funciona",
          texto:
            "No iPhone e no iPad todos os navegadores usam o motor do Safari, que não tem WebUSB nem Web Serial. Use um computador ou um celular Android.",
        },
      ],
    },
  ];

  function detectar() {
    const ua = navigator.userAgent || "";
    const plat = navigator.userAgentData?.platform || navigator.platform || "";
    if (/Android/i.test(ua)) return "android";
    if (/iPhone|iPad|iPod/i.test(ua) || (/Mac/i.test(plat) && navigator.maxTouchPoints > 1)) return "ios";
    if (/CrOS|Chrome OS/i.test(ua + plat)) return "chromeos";
    if (/Win/i.test(plat + ua)) return "windows";
    if (/Mac/i.test(plat + ua)) return "mac";
    if (/Linux|X11/i.test(plat + ua)) return "linux";
    return "windows";
  }

  class LabInstalacaoPanel {
    constructor(host) {
      this.host = host;
      this.detectado = detectar();
      this.sistema = this.detectado;
      this.build();
      this.mostrar(this.sistema);
      this.checar();
      if (root.navigator?.usb) {
        navigator.usb.addEventListener("connect", () => this.checar());
        navigator.usb.addEventListener("disconnect", () => this.checar());
      }
    }
    build() {
      const head = el("div", "workbench-heading");
      const text = el("div");
      const nomeDetectado = SISTEMAS.find((s) => s.id === this.detectado).nome;
      text.append(
        el("div", "eyebrow", "INSTALAÇÃO / PRIMEIRA VEZ COM A PLACA"),
        el("h2", "", "Preparar o computador ou o celular"),
        el(
          "p",
          "",
          "O que cada sistema precisa para gravar e monitorar a EK-TM4C1294XL (ou a EK-TM4C123GXL) pela aba Placa real. Sistema detectado: " +
            nomeDetectado +
            ".",
        ),
      );
      head.append(text);

      this.seletor = el("div", "segmented inst-sistemas");
      for (const s of SISTEMAS) {
        const b = el("button", "", s.nome);
        b.type = "button";
        b.dataset.sistema = s.id;
        b.onclick = () => this.mostrar(s.id);
        this.seletor.append(b);
      }

      const grid = el("div", "inst-grid");
      this.passos = el("ol", "inst-passos");
      const checks = el("section", "inst-checks");
      checks.append(el("h3", "", "Este navegador"));
      this.checkList = el("div");
      checks.append(this.checkList);
      grid.append(this.passos, checks);
      this.host.append(head, this.seletor, grid);
    }

    mostrar(id) {
      this.sistema = id;
      for (const b of this.seletor.children) {
        b.classList.toggle("active", b.dataset.sistema === id);
        b.textContent = SISTEMAS.find((s) => s.id === b.dataset.sistema).nome + (b.dataset.sistema === this.detectado ? " (este)" : "");
      }
      this.passos.replaceChildren();
      for (const passo of SISTEMAS.find((s) => s.id === id).passos) {
        const li = el("li", "inst-passo");
        li.append(el("h3", "", passo.titulo), el("p", "", passo.texto));
        if (passo.links) {
          const links = el("div", "inst-links");
          for (const [rotulo, url] of passo.links) {
            const a = el("a", "", rotulo + " ↗");
            a.href = url;
            a.target = "_blank";
            a.rel = "noopener";
            links.append(a);
          }
          li.append(links);
        }
        for (const cmd of passo.comandos || []) li.append(this._comando(cmd));
        this.passos.append(li);
      }
    }
    _comando(cmd) {
      const box = el("div", "inst-cmd");
      const pre = el("pre", "", cmd);
      const b = el("button", "", "Copiar");
      b.type = "button";
      b.onclick = () => {
        const feito = () => {
          b.textContent = "Copiado";
          setTimeout(() => (b.textContent = "Copiar"), 1500);
        };
        const selecionar = () => {
          const r = document.createRange();
          r.selectNodeContents(pre);
          getSelection().removeAllRanges();
          getSelection().addRange(r);
          b.textContent = "Selecionado";
        };
        if (!navigator.clipboard?.writeText) return selecionar();
        navigator.clipboard.writeText(cmd).then(feito, selecionar);
      };
      box.append(pre, b);
      return box;
    }

    async checar() {
      const policy = root.document?.featurePolicy;
      const usb = !!root.navigator?.usb;
      const usbLiberada = usb && (!policy || policy.allowsFeature("usb"));
      let autorizada = null;
      if (usbLiberada) {
        try {
          autorizada = (await navigator.usb.getDevices()).some((d) => d.vendorId === 0x1cbe && d.productId === 0x00fd);
        } catch {}
      }
      const itens = [
        usbLiberada
          ? ["ok", "WebUSB", "Este navegador consegue gravar e monitorar a placa."]
          : usb
            ? ["falta", "WebUSB bloqueado", "A página está dentro de outro site. Abra " + SITE + " direto."]
            : ["falta", "Sem WebUSB", "Use o Chrome ou o Edge (no computador ou no Android)."],
        root.navigator?.serial
          ? ["ok", "Web Serial", "O terminal serial usa a porta do sistema."]
          : usbLiberada
            ? ["ok", "Serial pela USB", "Sem Web Serial: o terminal fala direto com a placa pela USB."]
            : ["falta", "Sem serial", "O terminal serial não funciona neste navegador."],
        autorizada
          ? ["ok", "Placa autorizada", "Este navegador já pode usar a placa sem perguntar de novo."]
          : ["neutro", "Placa ainda não autorizada", "Normal na primeira vez: o navegador pergunta ao clicar em Conectar placa."],
      ];
      this.checkList.replaceChildren();
      for (const [estado, titulo, texto] of itens) {
        const row = el("div", "inst-check " + estado);
        row.append(el("span", "icone", estado === "ok" ? "✓" : estado === "falta" ? "✗" : "–"), el("strong", "", titulo), el("small", "", texto));
        this.checkList.append(row);
      }
    }
    serialize() {
      return null;
    }
    render() {}
    afterReset() {}
  }
  root.LabInstalacaoPanel = LabInstalacaoPanel;
})(typeof globalThis !== "undefined" ? globalThis : window);
