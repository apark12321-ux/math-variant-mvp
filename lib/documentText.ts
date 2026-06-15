import JSZip from "jszip";

export type ExtractedOfficeDocument = {
  text: string;
  warning?: string;
};

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function normalizeText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripXmlToText(xml: string) {
  const textNodeMatches = Array.from(xml.matchAll(/<[^>]*:?t[^>]*>([\s\S]*?)<\/[^>]*:?t>/g));

  if (textNodeMatches.length > 0) {
    return normalizeText(
      textNodeMatches
        .map((match) => decodeXmlEntities(match[1].replace(/<[^>]+>/g, "")))
        .join(" ")
    );
  }

  return normalizeText(
    decodeXmlEntities(
      xml
        .replace(/<[^>]*lineBreak[^>]*\/?>/gi, "\n")
        .replace(/<[^>]*br[^>]*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
    )
  );
}

export async function extractTextFromHwpx(buffer: Buffer): Promise<ExtractedOfficeDocument> {
  const zip = await JSZip.loadAsync(buffer);
  const xmlFileNames = Object.keys(zip.files)
    .filter((name) => {
      const lower = name.toLowerCase();
      return (
        lower.endsWith(".xml") &&
        !zip.files[name].dir &&
        (lower.startsWith("contents/") || lower.includes("section") || lower.includes("content"))
      );
    })
    .sort((a, b) => a.localeCompare(b));

  const chunks: string[] = [];

  for (const name of xmlFileNames) {
    const file = zip.files[name];
    if (!file) continue;
    const xml = await file.async("string");
    const text = stripXmlToText(xml);
    if (text) chunks.push(text);
  }

  const text = normalizeText(chunks.join("\n\n"));

  if (!text || text.length < 5) {
    throw new Error("HWPX 파일에서 텍스트를 추출하지 못했습니다. 파일이 암호화되어 있거나 본문이 이미지로만 구성된 경우 PDF 또는 이미지로 변환해 업로드해 주세요.");
  }

  return { text };
}

function collectReadableRuns(value: string) {
  const matches = value.match(/[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9\s.,!?+\-×÷=(){}\[\]<>/%:;^_㎡㎠㎤°'"·~\\|]{4,}/g) ?? [];
  return normalizeText(
    matches
      .map((part) => part.replace(/[\u0000-\u001f\u007f]/g, " ").trim())
      .filter((part) => /[가-힣A-Za-z0-9]/.test(part))
      .join("\n")
  );
}

export function extractTextFromHwpFallback(buffer: Buffer): ExtractedOfficeDocument {
  const utf16Text = collectReadableRuns(buffer.toString("utf16le"));
  const utf8Text = collectReadableRuns(buffer.toString("utf8"));
  const text = utf16Text.length >= utf8Text.length ? utf16Text : utf8Text;

  if (!text || text.length < 20) {
    throw new Error("HWP 바이너리 파일에서 텍스트를 직접 추출하지 못했습니다. HWPX로 저장하거나 PDF/이미지로 변환해 업로드해 주세요.");
  }

  return {
    text,
    warning: "HWP 바이너리 파일은 MVP에서 제한적 텍스트 추출만 지원합니다. 수식·도형·표가 누락될 수 있으므로 가능하면 HWPX, PDF 또는 선명한 이미지 업로드를 권장합니다."
  };
}

export async function extractTextFromOfficeDocument(filename: string, buffer: Buffer): Promise<ExtractedOfficeDocument | null> {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".hwpx")) {
    return extractTextFromHwpx(buffer);
  }

  if (lower.endsWith(".hwp")) {
    return extractTextFromHwpFallback(buffer);
  }

  return null;
}
