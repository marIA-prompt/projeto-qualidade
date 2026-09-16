import { PDFDocument, StandardFonts, rgb, type PDFFont, type RGB } from "pdf-lib";
import {
  RELACIONAMENTO_PADRAO,
  STATUS_LABELS,
  textoPdfSeguro,
  type DadosRelatorio,
} from "./relatorioModelo";

const NAVY = rgb(0x27 / 255, 0x30 / 255, 0x6b / 255);
const NAVY_DARK = rgb(0x1b / 255, 0x23 / 255, 0x50 / 255);
const BLUE = rgb(0x3d / 255, 0x57 / 255, 0xa0 / 255);
const GREY = rgb(0x44 / 255, 0x44 / 255, 0x44 / 255);
const LABEL = rgb(0x6b / 255, 0x72 / 255, 0x80 / 255);
const GREEN = rgb(0x1e / 255, 0x84 / 255, 0x49 / 255);
const RED = rgb(0xc0 / 255, 0x39 / 255, 0x2b / 255);
const AMBER = rgb(0x8a / 255, 0x64 / 255, 0x10 / 255);
const AMBER_BG = rgb(0xfb / 255, 0xf3 / 255, 0xdf / 255);
const CARD = rgb(0xee / 255, 0xf1 / 255, 0xf8 / 255);

function win(texto: string): string {
  return textoPdfSeguro(texto);
}

function caber(font: PDFFont, texto: string, size: number, max: number): string {
  let t = win(texto);
  while (t.length > 1 && font.widthOfTextAtSize(t, size) > max) t = t.slice(0, -1);
  return t;
}

function wrap(font: PDFFont, text: string, size: number, max: number): string[] {
  const words = win(text).split(/\s+/);
  const lines: string[] = [];
  let atual = "";
  for (const w of words) {
    const tentativa = atual ? `${atual} ${w}` : w;
    if (font.widthOfTextAtSize(tentativa, size) <= max) {
      atual = tentativa;
    } else {
      if (atual) lines.push(atual);
      atual = w;
    }
  }
  if (atual) lines.push(atual);
  return lines.length ? lines : [""];
}

export async function relatorioPdf(dados: DadosRelatorio): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const pageW = 595.28;
  const pageH = 841.89;
  const ml = 48;
  const mr = 48;
  const width = pageW - ml - mr;
  let page = doc.addPage([pageW, pageH]);
  let y = pageH - 36;

  function novaPagina() {
    page.drawText(win("Plano de Qualidade de Correspondentes  -  Uso interno"), {
      x: ml,
      y: 28,
      size: 8,
      font,
      color: LABEL,
    });
    page = doc.addPage([pageW, pageH]);
    y = pageH - 48;
  }

  function precisa(h: number) {
    if (y - h < 48) novaPagina();
  }

  function texto(
    t: string,
    opts: { x?: number; size: number; face?: PDFFont; color?: RGB; max?: number },
  ) {
    const face = opts.face || font;
    const lines = wrap(face, t, opts.size, opts.max ?? width);
    for (const ln of lines) {
      precisa(opts.size + 4);
      page.drawText(ln, {
        x: opts.x ?? ml,
        y: y - opts.size,
        size: opts.size,
        font: face,
        color: opts.color || GREY,
      });
      y -= opts.size + 3;
    }
  }

  page.drawRectangle({ x: 0, y: pageH - 14, width: pageW, height: 14, color: NAVY });
  y = pageH - 36;
  texto("RELATORIO MENSAL  ·  PLANO DE QUALIDADE", {
    size: 9,
    face: bold,
    color: BLUE,
  });
  y -= 4;
  texto("Acompanhamento da Qualidade dos Correspondentes", {
    size: 16,
    face: bold,
    color: NAVY_DARK,
  });
  texto("Banco Senff  ·  Autorregulacao do Credito Consignado", {
    size: 10,
    face: italic,
    color: BLUE,
  });
  y -= 10;

  const col = width / 4;
  const metas: [string, string, string?][] = [
    ["CORRESPONDENTE BANCARIO", dados.correspondente, dados.cnpj ? `CNPJ ${dados.cnpj}` : undefined],
    ["MES DE REFERENCIA", dados.mesReferencia],
    ["STATUS", STATUS_LABELS[dados.status]],
    ["GERADO EM", dados.geradoEm],
  ];
  const statusColor =
    dados.status === "conforme" ? GREEN : dados.status === "nao_conforme" ? RED : LABEL;
  metas.forEach((m, i) => {
    const x = ml + i * col;
    page.drawText(win(m[0]), { x, y, size: 7, font: bold, color: LABEL });
    page.drawText(caber(bold, m[1], 10, col - 8), {
      x,
      y: y - 14,
      size: 10,
      font: bold,
      color: i === 2 ? statusColor : NAVY_DARK,
    });
    if (m[2]) {
      page.drawText(caber(font, m[2], 8, col - 8), { x, y: y - 26, size: 8, font, color: LABEL });
    }
  });
  y -= 44;

  function heading(t: string, accent: RGB = BLUE) {
    precisa(28);
    y -= 8;
    page.drawText(win(t), { x: ml, y, size: 12, font: bold, color: NAVY_DARK });
    y -= 6;
    page.drawRectangle({ x: ml, y, width: width, height: 2, color: accent });
    y -= 14;
  }

  heading("Visao geral dos indicadores");
  function kpiBox(x: number, top: number, w: number, k: { v: number; l: string; n?: string; c?: RGB }) {
    page.drawRectangle({
      x,
      y: top - 62,
      width: w,
      height: 62,
      color: CARD,
      borderColor: rgb(0.84, 0.86, 0.92),
      borderWidth: 0.8,
    });
    const cx = x + w / 2;
    const max = w - 10;
    const num = String(k.v);
    page.drawText(num, { x: cx - bold.widthOfTextAtSize(num, 16) / 2, y: top - 24, size: 16, font: bold, color: k.c || NAVY });
    const lab = win(k.l);
    page.drawText(lab, { x: Math.max(x + 4, cx - bold.widthOfTextAtSize(lab, 8) / 2), y: top - 38, size: 8, font: bold, color: LABEL });
    if (k.n) {
      let nota = win(k.n);
      while (nota.length > 3 && font.widthOfTextAtSize(nota, 7) > max) nota = nota.slice(0, -1);
      page.drawText(nota, { x: Math.max(x + 4, cx - font.widthOfTextAtSize(nota, 7) / 2), y: top - 50, size: 7, font: italic, color: LABEL });
    }
  }
  const cellW = (width - 16) / 3;
  precisa(62);
  kpiBox(ml, y, cellW, { v: dados.kpis.reclamacoes.valor, l: "Reclamacoes", n: dados.kpis.reclamacoes.nota });
  kpiBox(ml + cellW + 8, y, cellW, { v: dados.kpis.acoesJudiciais.valor, l: "Acoes judiciais", n: dados.kpis.acoesJudiciais.nota });
  kpiBox(ml + 2 * (cellW + 8), y, cellW, { v: dados.kpis.emAnalise.valor, l: "Em analise", n: dados.kpis.emAnalise.nota });
  y -= 70;
  const half = (width - 8) / 2;
  precisa(62);
  kpiBox(ml, y, half, {
    v: dados.kpis.naoConformes.valor,
    l: "Nao conformes",
    c: dados.kpis.naoConformes.valor > 0 ? RED : GREEN,
  });
  kpiBox(ml + half + 8, y, half, {
    v: dados.kpis.naoAplicaveis.valor,
    l: "Nao aplicaveis",
    n: dados.kpis.naoAplicaveis.nota,
  });
  y -= 74;

  heading("Evolucao ao longo dos meses");
  precisa(70);
  page.drawRectangle({
    x: ml,
    y: y - 64,
    width,
    height: 70,
    color: rgb(0.97, 0.97, 0.99),
    borderColor: rgb(0.84, 0.86, 0.92),
    borderWidth: 0.8,
  });
  if (dados.evolucao.disponivel && dados.evolucao.pontos.length) {
    let yy = y - 16;
    page.drawText(win("Mes          Reclamacoes     Acoes     Numerador"), {
      x: ml + 12,
      y: yy,
      size: 9,
      font: bold,
      color: NAVY_DARK,
    });
    yy -= 14;
    for (const p of dados.evolucao.pontos.slice(-8)) {
      page.drawText(
        win(`${p.mes}          ${p.reclamacoes}              ${p.acoesJudiciais}         ${p.numerador}`),
        { x: ml + 12, y: yy, size: 9, font, color: GREY },
      );
      yy -= 12;
    }
    y -= 70;
  } else {
    page.drawText(win("Grafico de evolucao mensal"), {
      x: ml + 12,
      y: y - 24,
      size: 11,
      font: bold,
      color: NAVY_DARK,
    });
    page.drawText(caber(italic, "Disponivel a partir do 2o mes consecutivo de acompanhamento do correspondente.", 9, width - 24), {
      x: ml + 12,
      y: y - 40,
      size: 9,
      font: italic,
      color: LABEL,
    });
    y -= 70;
  }

  heading("Alerta de penalidades - historico", rgb(0.91, 0.78, 0.47));
  const penalLines = dados.alertaPenalidades.registros.length
    ? dados.alertaPenalidades.registros.map((p) => `${p.data}  ·  ${p.tipo}:  ${p.descricao}`)
    : [
        'Nenhum registro no periodo. Historico consolidado a partir da tela "Medidas administrativas".',
      ];
  const penalText = penalLines.join(" ");
  const wrapped = wrap(font, penalText, 10, width - 24);
  const boxH = Math.max(36, wrapped.length * 13 + 20);
  precisa(boxH + 8);
  page.drawRectangle({
    x: ml,
    y: y - boxH,
    width,
    height: boxH,
    color: AMBER_BG,
    borderColor: rgb(0.91, 0.78, 0.47),
    borderWidth: 0.8,
  });
  let py = y - 16;
  for (const ln of wrapped) {
    page.drawText(ln, { x: ml + 12, y: py, size: 10, font, color: AMBER });
    py -= 12;
  }
  y -= boxH + 8;

  heading("Relacionamento");
  for (const a of dados.relacionamento.alertasEspecificos) {
    const lines = wrap(font, `Atencao - ${a.titulo}:  ${a.texto}`, 10, width - 24);
    const h = lines.length * 12 + 16;
    precisa(h);
    page.drawRectangle({
      x: ml,
      y: y - h,
      width,
      height: h,
      color: AMBER_BG,
      borderColor: rgb(0.91, 0.78, 0.47),
      borderWidth: 0.8,
    });
    let ay = y - 14;
    for (const ln of lines) {
      page.drawText(ln, { x: ml + 12, y: ay, size: 10, font, color: AMBER });
      ay -= 12;
    }
    y -= h + 8;
  }
  if (dados.relacionamento.usarPadrao) {
    texto(
      "Os resultados reforcam a importancia de observar, no dia a dia da operacao, as regras aplicaveis a atuacao do correspondente. Entre os principais pontos, destacamos:",
      { size: 10, face: italic, color: NAVY_DARK },
    );
    y -= 6;
    for (const [label, t] of RELACIONAMENTO_PADRAO) {
      precisa(28);
      page.drawRectangle({ x: ml, y: y - 28, width: 3, height: 26, color: BLUE });
      texto(`${label}:  ${t}`, { x: ml + 12, size: 10, max: width - 16 });
      y -= 4;
    }
  }

  page.drawText(win("Plano de Qualidade de Correspondentes  -  Uso interno"), {
    x: ml,
    y: 28,
    size: 8,
    font,
    color: LABEL,
  });

  return doc.save();
}
