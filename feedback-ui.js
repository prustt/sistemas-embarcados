/* Aba Bugs e melhorias: lista as issues do repositório e abre os formulários do GitHub. GPL-2.0-or-later. */
(function (root) {
  "use strict";
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const REPO = "prustt/sistemas-embarcados";
  const API = "https://api.github.com/repos/" + REPO + "/issues?state=all&per_page=100";
  const NOVA = "https://github.com/" + REPO + "/issues/new";

  function navegador() {
    const ua = navigator.userAgent;
    const nome = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Navegador";
    const versao = (ua.match(/(?:Edg|Chrome|Firefox|Version)\/(\d+)/) || [])[1] || "";
    const so = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /CrOS/.test(ua) ? "ChromeOS" : /Linux/.test(ua) ? "Linux" : "";
    return (nome + " " + versao).trim() + (so ? " · " + so : "");
  }
  const data = (iso) => new Date(iso).toLocaleDateString("pt-BR");

  class LabFeedbackPanel {
    constructor(host, callbacks = {}) {
      this.host = host;
      this.callbacks = callbacks;
      this.filtro = "todos";
      this.itens = [];
      this.build();
      this.carregar();
    }
    build() {
      const head = el("div", "workbench-heading");
      const text = el("div");
      text.append(
        el("div", "eyebrow", "BUGS E MELHORIAS"),
        el("h2", "", "Registros do professor"),
        el(
          "p",
          "",
          "Problemas encontrados no site e ideias de melhoria. Para registrar é preciso entrar com a conta do GitHub; os formulários já vêm com o micro, o navegador e o sistema em uso.",
        ),
      );
      head.append(text);

      const acoes = el("div", "fb-acoes");
      const bug = el("button", "primary", "Relatar bug");
      bug.type = "button";
      bug.onclick = () => this.abrir("bug.yml");
      const melhoria = el("button", "", "Sugerir melhoria");
      melhoria.type = "button";
      melhoria.onclick = () => this.abrir("melhoria.yml");
      const todos = el("a", "fb-link", "Ver tudo no GitHub ↗");
      todos.href = "https://github.com/" + REPO + "/issues";
      todos.target = "_blank";
      todos.rel = "noopener";
      acoes.append(bug, melhoria, todos);

      const barra = el("div", "fb-barra");
      this.filtros = el("div", "segmented");
      for (const [id, nome] of [["todos", "Todos"], ["abertos", "Abertos"], ["resolvidos", "Resolvidos"]]) {
        const b = el("button", "", nome);
        b.type = "button";
        b.dataset.filtro = id;
        b.onclick = () => {
          this.filtro = id;
          this.render();
        };
        this.filtros.append(b);
      }
      const atualizar = el("button", "", "Atualizar");
      atualizar.type = "button";
      atualizar.onclick = () => this.carregar();
      this.estado = el("span", "fb-estado");
      barra.append(this.filtros, atualizar, this.estado);

      this.lista = el("div", "fb-lista");
      this.host.append(head, acoes, barra, this.lista);
    }

    abrir(modelo) {
      const p = new URLSearchParams({ template: modelo });
      const micro = this.callbacks.micro?.();
      if (micro) p.set("micro", micro);
      p.set("navegador", navegador());
      window.open(NOVA + "?" + p.toString(), "_blank", "noopener");
    }

    async carregar() {
      this.estado.textContent = "Carregando…";
      try {
        const r = await fetch(API, { headers: { Accept: "application/vnd.github+json" } });
        if (!r.ok) throw new Error(r.status === 403 ? "limite de consultas do GitHub atingido; tente em alguns minutos" : "GitHub respondeu " + r.status);
        this.itens = (await r.json()).filter((i) => !i.pull_request);
        this.estado.textContent = "Atualizado às " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      } catch (error) {
        this.estado.textContent = "Não foi possível carregar a lista (" + error.message + ").";
      }
      this.render();
    }

    render() {
      for (const b of this.filtros.children) b.classList.toggle("active", b.dataset.filtro === this.filtro);
      const itens = this.itens.filter((i) =>
        this.filtro === "abertos" ? i.state === "open" : this.filtro === "resolvidos" ? i.state === "closed" : true,
      );
      this.lista.replaceChildren();
      if (!itens.length) {
        this.lista.append(
          el("p", "fb-vazio", this.itens.length ? "Nada neste filtro." : "Nenhum registro ainda. Use os botões acima para relatar um bug ou sugerir uma melhoria."),
        );
        return;
      }
      for (const i of itens) {
        const card = el("a", "fb-item " + (i.state === "open" ? "aberto" : "resolvido"));
        card.href = i.html_url;
        card.target = "_blank";
        card.rel = "noopener";
        const topo = el("div", "fb-topo");
        topo.append(el("span", "fb-num", "#" + i.number), el("strong", "", i.title));
        const meta = el("div", "fb-meta");
        for (const l of i.labels) meta.append(el("span", "fb-tag " + (l.name === "bug" ? "bug" : "melhoria"), l.name));
        meta.append(
          el("span", "fb-situacao", i.state === "open" ? "Aberto" : "Resolvido"),
          el("span", "", "por " + i.user.login + " em " + data(i.created_at)),
        );
        if (i.comments) meta.append(el("span", "", i.comments + (i.comments > 1 ? " comentários" : " comentário")));
        card.append(topo, meta);
        this.lista.append(card);
      }
    }
    serialize() {
      return null;
    }
    afterReset() {}
  }
  root.LabFeedbackPanel = LabFeedbackPanel;
})(typeof globalThis !== "undefined" ? globalThis : window);
