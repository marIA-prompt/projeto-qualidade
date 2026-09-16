import { PDFDocument, StandardFonts, rgb, type PDFFont, type RGB } from "pdf-lib";
import { textoPdfSeguro } from "./relatorioModelo";
import type { DadosRelatorioAnual } from "./relatorioAnual";
import { DESVIOS_GRAVES, STATUS_ANUAL_LABELS } from "./motorAnual";

const NAVY_DARK = rgb(0x1b / 255, 0x23 / 255, 0x50 / 255);
const BLUE = rgb(0x3d / 255, 0x57 / 255, 0xa0 / 255);
const GREY = rgb(0x44 / 255, 0x44 / 255, 0x44 / 255);
const LABEL = rgb(0x6b / 255, 0x72 / 255, 0x80 / 255);

function win(t: string): string {
  return textoPdfSeguro(t);
}

function wrap(font: PDFFont, text: string, size: number, max: number): string[] {
  const words = win(text).split(/\s+/);
  const lines: string[] = [];
  let atual = "";
  for (const w of words) {
    const tentativa = atual ? `${atual} ${w}` : w;
    if (font.widthOfTextAtSize(tentativa, size) <= max) atual = tentativa;
    else {
      if (atual) lines.push(atual);
      atual = w;
    }
  }
  if (atual) lines.push(atual);
  return lines.length ? lines : [""];
}

export async function relatorioPdfAnual(dados: DadosRelatorioAnual): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageW = 595.28;
  const pageH = 841.89;
  const ml = 48;
  const width = pageW - 96;
  let page = doc.addPage([pageW, pageH]);
  let y = pageH - 48;

  function nova() {
    page.drawText(win("Monitoramento anual  -  Uso interno"), { x: ml, y: 28, size: 8, font, color: LABEL });
    page = doc.addPage([pageW, pageH]);
    y = pageH - 48;
  }
  function precisa(h: number) {
    if (y - h < 48) nova();
  }
  function texto(t: string, opts: { size: number; face?: PDFFont; color?: RGB }) {
    const face = opts.face || font;
    for (const ln of wrap(face, t, opts.size, width)) {
      precisa(opts.size + 4);
      page.drawText(ln, { x: ml, y: y - opts.size, size: opts.size, font: face, color: opts.color || GREY });
      y -= opts.size + 3;
    }
  }

  texto("RELATORIO ANUAL  ·  PLANO DE QUALIDADE", { size: 9, face: bold, color: BLUE });
  y -= 4;
  texto("Monitoramento anual dos correspondentes", { size: 16, face: bold, color: NAVY_DARK });
  texto(`Banco Senff  ·  Ciclo ${dados.ano}  ·  ${dados.correspondente}`, { size: 10, color: BLUE });
  y -= 8;
  texto(
    `Status: ${STATUS_ANUAL_LABELS[dados.status]}  |  Pontuacao: ${dados.pontuacao == null ? "-" : `${dados.pontuacao.toFixed(1)}%`}  |  Desvio grave: ${dados.desvioGrave ? "Sim" : "Nao"}`,
    { size: 10, face: bold, color: NAVY_DARK },
  );
  texto(
    `Reclamacoes: ${dados.kpis.reclamacoes}   Acoes judiciais: ${dados.kpis.acoes}   Procedentes Corban: ${dados.kpis.numerador}`,
    { size: 10 },
  );
  y -= 6;
  texto("A pontuacao geral e a media das componentes disponiveis no ano (operacional e/ou auditoria), sem inventar zero.", { size: 9, color: LABEL });
  y -= 8;
  texto("Correspondentes do ciclo", { size: 12, face: bold, color: NAVY_DARK });
  for (const r of dados.linhas) {
    texto(
      `${r.correspondente}  |  ${r.pontuacao_geral == null ? "-" : `${r.pontuacao_geral.toFixed(1)}%`}  |  ${STATUS_ANUAL_LABELS[r.status]}  |  ${r.medida_sugerida || "-"}`,
      { size: 9 },
    );
  }
  y -= 8;
  texto("Medidas do ciclo anual: 1a Advertencia; 2a consecutiva Suspensao de 10 dias uteis; 3a Suspensao definitiva.", { size: 9 });
  if (dados.medidaSugerida) texto(`Medida sugerida: ${dados.medidaSugerida} (aplicacao manual).`, { size: 10, face: bold });
  y -= 6;
  texto("Desvios de conduta grave", { size: 12, face: bold, color: NAVY_DARK });
  for (const d of DESVIOS_GRAVES) texto(`- ${d}`, { size: 10 });
  page.drawText(win("Plano de Qualidade de Correspondentes  -  Uso interno"), { x: ml, y: 28, size: 8, font, color: LABEL });
  return doc.save();
}
