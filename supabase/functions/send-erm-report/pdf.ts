import {
  PDFDocument,
  PDFPage,
  PDFFont,
  StandardFonts,
  rgb,
} from "npm:pdf-lib@1.17.1";
import "../_shared/maturity.js";

type MaturityLevel = {
  score: number;
  key: string;
  label: string;
  scoreRange: string;
  textColor: string;
  backgroundColor: string;
  borderColor: string;
  interpretation: string;
  observedSituation: string;
  recommendedPriority: string;
};

const maturity = (globalThis as typeof globalThis & {
  FinasureMaturity: {
    getMaturityLevel(score: unknown): MaturityLevel;
    MATURITY_INTERPRETATION_GRID: readonly MaturityLevel[];
  };
}).FinasureMaturity;

type Dimension = {
  id: number;
  dimension_id: string;
  dimension_name: string;
  score: number;
  weight: number;
  level: string;
  priority_index: number;
};

type Recommendation = {
  dimension_id: string;
  dimension_name: string;
  diagnostic: string;
  short_term_actions: string;
  medium_term_actions: string;
  is_strength: boolean;
  is_priority: boolean;
};

export type ReportData = {
  company: { name: string };
  respondent: { first_name: string; last_name: string };
  assessment: {
    completed_at: string;
    global_score: number;
    global_level: string;
    percentage: number;
  };
  dimensions: Dimension[];
  recommendations: Recommendation[];
};

const A4: [number, number] = [595.28, 841.89];
const NAVY = rgb(0.027, 0.114, 0.208);
const CYAN = rgb(0.145, 0.663, 0.878);
const GREEN = rgb(0.349, 0.718, 0.278);
const INK = rgb(0.09, 0.157, 0.227);
const MUTED = rgb(0.39, 0.46, 0.54);
const PALE = rgb(0.94, 0.975, 0.99);

function pdfColor(hex: string) {
  const value = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return INK;
  return rgb(
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
  );
}

function validScore(value: unknown) {
  return maturity.getMaturityLevel(value).score ?? Number(value);
}

function safe(value: unknown) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/\u202f/g, " ")
    .replace(/[^\x20-\x7EÀ-ÿŒœ€’“”–—•]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const words = safe(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawWrapped(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  width: number,
  font: PDFFont,
  size = 10,
  color = INK,
  lineHeight = size * 1.35,
) {
  const lines = wrap(text, font, size, width);
  lines.forEach((line, index) =>
    page.drawText(line, { x, y: y - index * lineHeight, font, size, color })
  );
  return y - lines.length * lineHeight;
}

function drawRadar(
  page: PDFPage,
  dimensions: Dimension[],
  centerX: number,
  centerY: number,
  radius: number,
  font: PDFFont,
) {
  const count = dimensions.length;
  const point = (index: number, factor: number) => {
    const angle = -Math.PI / 2 + index * 2 * Math.PI / count;
    return {
      x: centerX + Math.cos(angle) * radius * factor,
      y: centerY + Math.sin(angle) * radius * factor,
    };
  };
  for (let ring = 1; ring <= 5; ring++) {
    for (let index = 0; index < count; index++) {
      const a = point(index, ring / 5);
      const b = point((index + 1) % count, ring / 5);
      page.drawLine({ start: a, end: b, thickness: 0.5, color: rgb(.78, .84, .88) });
    }
  }
  dimensions.forEach((dimension, index) => {
    const edge = point(index, 1);
    page.drawLine({
      start: { x: centerX, y: centerY },
      end: edge,
      thickness: 0.4,
      color: rgb(.8, .85, .89),
    });
    const label = point(index, 1.18);
    const name = safe(dimension.dimension_name);
    const short = name.length > 24 ? `${name.slice(0, 22)}…` : name;
    page.drawText(short, {
      x: label.x - font.widthOfTextAtSize(short, 6.5) / 2,
      y: label.y,
      font,
      size: 6.5,
      color: MUTED,
    });
  });
  const scorePoints = dimensions.map((dimension, index) =>
    point(index, Math.max(0, Math.min(5, Number(dimension.score))) / 5)
  );
  scorePoints.forEach((a, index) => {
    const b = scorePoints[(index + 1) % scorePoints.length];
    page.drawLine({ start: a, end: b, thickness: 2, color: CYAN });
    page.drawCircle({ x: a.x, y: a.y, size: 2.8, color: GREEN });
  });
}

export async function generateReportPdf(data: ReportData, logoUrl?: string) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let logo: Awaited<ReturnType<typeof pdf.embedPng>> | null = null;
  if (logoUrl) {
    try {
      const response = await fetch(logoUrl);
      if (response.ok) logo = await pdf.embedPng(await response.arrayBuffer());
    } catch (_) {
      logo = null;
    }
  }

  const addPage = () => pdf.addPage(A4);
  const title = (page: PDFPage, text: string, y = 790) => {
    page.drawText(safe(text), { x: 45, y, font: bold, size: 19, color: NAVY });
    page.drawLine({ start: { x: 45, y: y - 10 }, end: { x: 550, y: y - 10 }, color: CYAN, thickness: 2 });
    return y - 35;
  };

  let page = addPage();
  page.drawRectangle({ x: 0, y: 0, width: A4[0], height: A4[1], color: NAVY });
  page.drawRectangle({ x: 0, y: 0, width: A4[0], height: 180, color: CYAN });
  if (logo) {
    const scaled = logo.scaleToFit(190, 95);
    page.drawImage(logo, { x: 48, y: 690, width: scaled.width, height: scaled.height });
  } else {
    page.drawText("FINASURE", { x: 48, y: 735, font: bold, size: 27, color: rgb(1, 1, 1) });
  }
  page.drawText("Rapport d’évaluation", { x: 48, y: 560, font: bold, size: 30, color: rgb(1, 1, 1) });
  page.drawText("de maturité ERM", { x: 48, y: 520, font: bold, size: 30, color: CYAN });
  page.drawText(safe(data.company.name), { x: 48, y: 420, font: bold, size: 19, color: rgb(1, 1, 1) });
  page.drawText(
    safe(`${data.respondent.first_name} ${data.respondent.last_name}`),
    { x: 48, y: 389, font: regular, size: 12, color: rgb(.82, .9, .95) },
  );
  page.drawText(
    new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(data.assessment.completed_at)),
    { x: 48, y: 358, font: regular, size: 11, color: rgb(.82, .9, .95) },
  );
  page.drawText("FINASURE — ASSURANCE ET RÉASSURANCE", { x: 48, y: 88, font: bold, size: 11, color: NAVY });

  page = addPage();
  let y = title(page, "Synthèse de l’évaluation");
  const globalScore = validScore(data.assessment.global_score);
  const globalLevel = maturity.getMaturityLevel(globalScore);
  const globalText = pdfColor(globalLevel.textColor);
  const globalBackground = pdfColor(globalLevel.backgroundColor);
  const globalBorder = pdfColor(globalLevel.borderColor);
  page.drawRectangle({ x: 45, y: y - 135, width: 505, height: 125, color: PALE, borderColor: CYAN, borderWidth: 1 });
  page.drawText(globalScore.toFixed(2).replace(".", ","), { x: 70, y: y - 75, font: bold, size: 42, color: NAVY });
  page.drawText("/ 5", { x: 158, y: y - 70, font: regular, size: 16, color: MUTED });
  page.drawRectangle({ x: 252, y: y - 67, width: 180, height: 30, color: globalBackground, borderColor: globalBorder, borderWidth: 1 });
  page.drawText(safe(globalLevel.label), { x: 264, y: y - 58, font: bold, size: 14, color: globalText });
  page.drawText(`${data.assessment.percentage} %`, { x: 260, y: y - 87, font: bold, size: 14, color: CYAN });
  y = drawWrapped(page, globalLevel.interpretation, 45, y - 175, 505, regular, 11);
  y = drawWrapped(page, `Prochaine étape : ${globalLevel.nextStep}`, 45, y - 10, 505, bold, 10);
  y = title(page, "Radar des 11 dimensions", y - 35);
  drawRadar(page, data.dimensions, 298, y - 180, 125, regular);

  page = addPage();
  y = title(page, "Détail des dimensions");
  for (const dimension of data.dimensions) {
    const score = validScore(dimension.score);
    const level = maturity.getMaturityLevel(score);
    const levelText = pdfColor(level.textColor);
    const levelBackground = pdfColor(level.backgroundColor);
    const levelBorder = pdfColor(level.borderColor);
    if (y < 105) {
      page = addPage();
      y = title(page, "Détail des dimensions — suite");
    }
    page.drawText(safe(dimension.dimension_name), { x: 45, y, font: bold, size: 11, color: NAVY });
    page.drawText(`${score.toFixed(2).replace(".", ",")} / 5`, { x: 440, y, font: bold, size: 11, color: levelText });
    page.drawRectangle({ x: 45, y: y - 23, width: 112, height: 17, color: levelBackground, borderColor: levelBorder, borderWidth: .7 });
    page.drawText(safe(level.label), { x: 51, y: y - 18, font: bold, size: 8, color: levelText });
    page.drawText(safe(`${Math.round(score / 5 * 100)} % • Poids ${dimension.weight} %`), { x: 168, y: y - 18, font: regular, size: 9, color: MUTED });
    page.drawRectangle({ x: 45, y: y - 34, width: 460, height: 6, color: rgb(.88, .92, .95) });
    page.drawRectangle({ x: 45, y: y - 34, width: 460 * score / 5, height: 6, color: levelText });
    y -= 62;
  }

  const gridColumns = [78, 58, 112, 140, 117];
  const gridHeaders = [
    "Niveau", "Score", "Interprétation",
    "Situation généralement observée", "Priorité recommandée"
  ];
  const drawGridHeader = (current: PDFPage, startY: number) => {
    let x = 45;
    current.drawRectangle({ x, y: startY - 25, width: 505, height: 25, color: NAVY });
    gridHeaders.forEach((header, index) => {
      drawWrapped(current, header, x + 4, startY - 9, gridColumns[index] - 8, bold, 6.5, rgb(1, 1, 1), 7.2);
      x += gridColumns[index];
    });
    return startY - 25;
  };
  page = addPage();
  y = title(page, "Grille d’interprétation des niveaux de maturité");
  y = drawGridHeader(page, y);
  for (const level of maturity.MATURITY_INTERPRETATION_GRID) {
    const values = [
      level.label, level.scoreRange, level.interpretation,
      level.observedSituation, level.recommendedPriority
    ];
    const lines = values.map((value, index) => wrap(value, regular, 6.7, gridColumns[index] - 8));
    const rowHeight = Math.max(38, ...lines.map((items) => items.length * 8 + 12));
    if (y - rowHeight < 48) {
      page = addPage();
      y = title(page, "Grille d’interprétation — suite");
      y = drawGridHeader(page, y);
    }
    const rowBottom = y - rowHeight;
    page.drawRectangle({
      x: 45, y: rowBottom, width: 505, height: rowHeight,
      color: pdfColor(level.backgroundColor),
      borderColor: pdfColor(level.borderColor), borderWidth: .7
    });
    let x = 45;
    lines.forEach((columnLines, index) => {
      if (index > 0) {
        page.drawLine({
          start: { x, y }, end: { x, y: rowBottom },
          color: pdfColor(level.borderColor), thickness: .4
        });
      }
      columnLines.forEach((line, lineIndex) => {
        page.drawText(line, {
          x: x + 4, y: y - 11 - lineIndex * 8,
          font: index === 0 ? bold : regular, size: 6.7,
          color: index === 0 ? pdfColor(level.textColor) : INK
        });
      });
      x += gridColumns[index];
    });
    y = rowBottom;
  }

  page = addPage();
  y = title(page, "Points forts");
  const strengths = data.recommendations.filter((item) => item.is_strength).slice(0, 3);
  strengths.forEach((item, index) => {
    page.drawText(`${index + 1}. ${safe(item.dimension_name)}`, { x: 45, y, font: bold, size: 13, color: GREEN });
    y = drawWrapped(page, item.diagnostic, 62, y - 20, 475, regular, 10) - 18;
  });
  y = title(page, "Priorités", y - 12);
  const priorities = data.recommendations.filter((item) => item.is_priority).slice(0, 3);
  priorities.forEach((item, index) => {
    page.drawText(`${index + 1}. ${safe(item.dimension_name)}`, { x: 45, y, font: bold, size: 13, color: NAVY });
    y = drawWrapped(page, item.short_term_actions, 62, y - 20, 475, regular, 10) - 18;
  });

  for (const item of data.recommendations) {
    page = addPage();
    y = title(page, safe(item.dimension_name));
    const dimension = data.dimensions.find((entry) => entry.dimension_id === item.dimension_id);
    if (dimension) {
      const score = validScore(dimension.score);
      const level = maturity.getMaturityLevel(score);
      const levelText = pdfColor(level.textColor);
      page.drawRectangle({
        x: 45, y: y - 27, width: 505, height: 25,
        color: pdfColor(level.backgroundColor),
        borderColor: pdfColor(level.borderColor), borderWidth: .8
      });
      page.drawText(safe(`${level.label} • ${score.toFixed(2).replace(".", ",")} / 5 • ${Math.round(score / 5 * 100)} %`), {
        x: 55, y: y - 19, font: bold, size: 10, color: levelText
      });
      page.drawRectangle({ x: 45, y: y - 39, width: 505, height: 5, color: rgb(.88, .92, .95) });
      page.drawRectangle({ x: 45, y: y - 39, width: 505 * score / 5, height: 5, color: levelText });
      y -= 58;
    }
    page.drawText("Diagnostic", { x: 45, y, font: bold, size: 13, color: CYAN });
    y = drawWrapped(page, item.diagnostic, 45, y - 22, 505, regular, 10.5) - 24;
    page.drawText("Actions à court terme", { x: 45, y, font: bold, size: 13, color: GREEN });
    y = drawWrapped(page, item.short_term_actions, 45, y - 22, 505, regular, 10.5) - 24;
    page.drawText("Actions à moyen terme", { x: 45, y, font: bold, size: 13, color: NAVY });
    drawWrapped(page, item.medium_term_actions, 45, y - 22, 505, regular, 10.5);
  }

  page = addPage();
  y = title(page, "À propos de ce rapport");
  y = drawWrapped(
    page,
    "Cette évaluation constitue une auto-évaluation indicative et ne se substitue pas à un audit approfondi.",
    45, y, 505, bold, 13, NAVY, 18,
  );
  drawWrapped(
    page,
    "Finasure accompagne les organisations dans la gouvernance des risques, la continuité d’activité, la gestion de crise et la résilience.",
    45, y - 35, 505, regular, 11,
  );
  page.drawText("Contact : " + safe(Deno.env.get("FINASURE_CONTACT_EMAIL") || "contact@finasure.com"), { x: 45, y: 575, font: regular, size: 11, color: CYAN });

  const pages = pdf.getPages();
  pages.forEach((current, index) => {
    if (index === 0) return;
    current.drawLine({ start: { x: 45, y: 35 }, end: { x: 550, y: 35 }, color: rgb(.84, .88, .91), thickness: .5 });
    current.drawText(`Finasure • Rapport ERM • ${index + 1}/${pages.length}`, { x: 45, y: 20, font: regular, size: 7.5, color: MUTED });
  });
  return await pdf.save();
}
