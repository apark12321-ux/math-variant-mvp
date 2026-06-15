import type { DiagramSpec } from "./schema";

export function renderDiagramSvg(spec?: DiagramSpec | null): string | null {
  if (!spec || !spec.required || spec.type === "none") return null;

  const width = spec.canvas.width || 800;
  const height = spec.canvas.height || 600;
  const elements = spec.elements.map(renderElement).join("\n");

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="white"/>
  ${elements}
</svg>`.trim();
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderElement(el: DiagramSpec["elements"][number]): string {
  const stroke = "black";
  const strokeWidth = 2;
  const fill = el.fill ?? "none";

  switch (el.kind) {
    case "line":
      return `<line x1="${el.x1}" y1="${el.y1}" x2="${el.x2}" y2="${el.y2}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    case "dashed_line":
      return `<line x1="${el.x1}" y1="${el.y1}" x2="${el.x2}" y2="${el.y2}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-dasharray="${esc(el.strokeDasharray ?? "6 6")}"/>`;
    case "point": {
      const x = el.x ?? 0;
      const y = el.y ?? 0;
      const label = el.label ? `<text x="${x + 8}" y="${y - 8}" font-size="18" font-family="Arial">${esc(el.label)}</text>` : "";
      return `<circle cx="${x}" cy="${y}" r="4" fill="black"/>${label}`;
    }
    case "text":
      return `<text x="${el.x ?? 0}" y="${el.y ?? 0}" font-size="${el.fontSize ?? 18}" font-family="Arial">${esc(el.text)}</text>`;
    case "polygon": {
      const points = el.points.map((p) => `${p.x},${p.y}`).join(" ");
      return `<polygon points="${points}" fill="${esc(fill)}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    }
    case "circle":
      return `<circle cx="${el.cx ?? 0}" cy="${el.cy ?? 0}" r="${el.r ?? 10}" fill="${esc(fill)}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    case "axis": {
      const xMid = el.x ?? 400;
      const yMid = el.y ?? 300;
      return `<line x1="40" y1="${yMid}" x2="760" y2="${yMid}" stroke="black" stroke-width="1.5"/><line x1="${xMid}" y1="560" x2="${xMid}" y2="40" stroke="black" stroke-width="1.5"/><text x="745" y="${yMid - 10}" font-size="16" font-family="Arial">x</text><text x="${xMid + 10}" y="55" font-size="16" font-family="Arial">y</text>`;
    }
    default:
      return "";
  }
}
