import { NextResponse } from "next/server";
import { extractTextFromOfficeDocument } from "../../../lib/documentText";
import { analyzeProblem, extractProblemFromFile, generateVariant, verifyProblem, type UploadedProblemFile } from "../../../lib/llm";
import { generateLocalVariant } from "../../../lib/localGenerator";
import { renderDiagramSvg } from "../../../lib/renderer";
import { surfaceSimilarityRisk } from "../../../lib/similarity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MIN_CONFIRMED_TEXT_LENGTH = 8;

type RequestAction = "extract" | "generate";

type GenerateRequest = {
  action?: RequestAction;
  problemText?: string;
  imageContext?: string;
  maxAttempts?: number;
};

type ParsedRequest = {
  action: RequestAction;
  problemText: string;
  imageContext: string;
  maxAttempts: number;
  file?: UploadedProblemFile;
};

function clampAttempts(value: unknown) {
  const parsed = typeof value === "string" ? Number(value) : typeof value === "number" ? value : 3;
  return Math.min(Math.max(Number.isFinite(parsed) ? parsed : 3, 1), 5);
}

function parseAction(value: unknown): RequestAction {
  return value === "extract" ? "extract" : "generate";
}

function normalizeText(text: string) {
  return text.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function normalizeMimeType(file: File, lowerName: string) {
  if (lowerName.endsWith(".pdf")) return "application/pdf";
  if (lowerName.endsWith(".hwpx")) return "application/hwpx+zip";
  if (lowerName.endsWith(".hwp")) return "application/x-hwp";
  return file.type || "application/octet-stream";
}

function isImageOrPdf(file?: UploadedProblemFile) {
  if (!file) return false;
  return file.mimeType.startsWith("image/") || file.mimeType === "application/pdf" || file.filename.toLowerCase().endsWith(".pdf");
}

async function fileToUploadedProblemFile(file: File): Promise<UploadedProblemFile> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("업로드 파일은 10MB 이하만 지원합니다.");
  }

  const lowerName = file.name.toLowerCase();
  const mimeType = normalizeMimeType(file, lowerName);
  const isPdf = mimeType === "application/pdf" || lowerName.endsWith(".pdf");
  const isImage = mimeType.startsWith("image/");
  const isHwpx = lowerName.endsWith(".hwpx");
  const isHwp = lowerName.endsWith(".hwp");

  if (!isPdf && !isImage && !isHwpx && !isHwp) {
    throw new Error("지원 파일 형식은 PDF, JPG, PNG, WEBP, HWPX, HWP입니다.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const uploaded: UploadedProblemFile = {
    filename: file.name || "problem-file",
    mimeType,
    dataUrl: `data:${mimeType};base64,${buffer.toString("base64")}`
  };

  if (isHwpx || isHwp) {
    const extracted = await extractTextFromOfficeDocument(file.name, buffer);
    if (!extracted?.text) {
      throw new Error("HWP/HWPX 파일에서 텍스트를 추출하지 못했습니다. HWPX로 다시 저장하거나 텍스트를 직접 입력해 주세요.");
    }
    uploaded.extractedText = normalizeText(extracted.text);
    uploaded.extractionWarning = extracted.warning;
  }

  return uploaded;
}

async function parseRequest(req: Request): Promise<ParsedRequest> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const action = parseAction(form.get("action"));
    const problemText = normalizeText(String(form.get("problemText") ?? ""));
    const imageContext = normalizeText(String(form.get("imageContext") ?? ""));
    const maxAttempts = clampAttempts(form.get("maxAttempts"));
    const fileValue = form.get("file");

    const parsed: ParsedRequest = { action, problemText, imageContext, maxAttempts };
    if (fileValue instanceof File && fileValue.size > 0) {
      parsed.file = await fileToUploadedProblemFile(fileValue);
    }

    return parsed;
  }

  const body = (await req.json()) as GenerateRequest;
  return {
    action: parseAction(body.action),
    problemText: normalizeText(body.problemText ?? ""),
    imageContext: normalizeText(body.imageContext ?? ""),
    maxAttempts: clampAttempts(body.maxAttempts)
  };
}

function buildConfirmedText(parsed: ParsedRequest) {
  const parts = [parsed.problemText, parsed.imageContext, parsed.file?.extractedText].filter(Boolean);
  return normalizeText(parts.join("\n\n"));
}

function textLooksActionable(text: string) {
  const compact = text.replace(/\s/g, "");
  if (compact.length < MIN_CONFIRMED_TEXT_LENGTH) return false;
  return /구하|계산|넓이|둘레|부피|정답|값|풀이|방정식|그래프|함수|분수|소수|확률|평균|각도|길이|비율|비례/.test(compact);
}

function localResponse(problemText: string, extractedText = "") {
  const local = generateLocalVariant(problemText);
  const valid = local.verification.is_valid && local.verification.answer_matches;

  return NextResponse.json(
    {
      success: valid,
      mode: "local",
      stage: "generated",
      message: valid
        ? "로컬 규칙 기반 무료 모드로 생성했습니다."
        : "무료 로컬 모드에서 이 문항 유형은 아직 생성할 수 없습니다. 임의의 가짜 문항은 생성하지 않았습니다.",
      extractedText,
      analysis: local.analysis,
      generated: valid ? local.generated : null,
      verification: local.verification,
      diagramSvg: valid ? renderDiagramSvg(local.generated.diagram_spec) : null,
      attempts: [
        {
          index: 1,
          valid,
          localSimilarityRisk: valid ? "medium" : "blocked",
          modelSimilarityRisk: valid ? "medium" : "blocked",
          verification: local.verification
        }
      ]
    },
    { status: valid ? 200 : 422 }
  );
}

async function extractionResponse(parsed: ParsedRequest, apiEnabled: boolean) {
  let extractedText = parsed.file?.extractedText ?? "";
  let extractionWarning = parsed.file?.extractionWarning ?? "";

  if (parsed.file && !extractedText) {
    if (!apiEnabled) {
      if (isImageOrPdf(parsed.file)) {
        extractionWarning = "무료 모드에서는 스캔 이미지/PDF OCR을 수행하지 않습니다. 왼쪽 미리보기를 보고 문제 텍스트를 직접 입력·수정해야 합니다.";
      }
      extractedText = buildConfirmedText(parsed);
    } else {
      extractedText = normalizeText(await extractProblemFromFile(parsed.file));
    }
  }

  if (!extractedText) {
    extractedText = buildConfirmedText(parsed);
  }

  if (!extractedText) {
    return NextResponse.json(
      {
        success: false,
        mode: apiEnabled ? "api" : "local",
        stage: "extracted",
        message: "인식된 텍스트가 없습니다. 무료 모드에서는 PDF/이미지 원본을 보고 문제 텍스트를 직접 입력해야 합니다.",
        extractedText: "",
        extractionWarning: extractionWarning || "텍스트 없음"
      },
      { status: 400 }
    );
  }

  const actionable = textLooksActionable(extractedText);
  return NextResponse.json({
    success: actionable,
    mode: apiEnabled ? "api" : "local",
    stage: "extracted",
    message: actionable
      ? "인식 결과가 준비되었습니다. 실제 원본과 비교해 수정한 뒤 2단계 생성을 실행하세요."
      : "인식 결과가 너무 짧거나 문제 문장으로 보기 어렵습니다. 원본을 보며 텍스트를 수정해야 합니다.",
    extractedText,
    extractionWarning
  }, { status: actionable ? 200 : 422 });
}

export async function POST(req: Request) {
  try {
    const parsed = await parseRequest(req);
    const apiEnabled = process.env.USE_OPENAI === "true" && !!process.env.OPENAI_API_KEY;

    if (parsed.action === "extract") {
      return extractionResponse(parsed, apiEnabled);
    }

    if (!apiEnabled) {
      const localText = buildConfirmedText(parsed);
      if (!localText || !textLooksActionable(localText)) {
        return NextResponse.json(
          {
            success: false,
            mode: "local",
            stage: "generated",
            message: "생성할 수 있는 확정 문제 텍스트가 아닙니다. PDF/이미지를 보고 문제 문장을 정확히 입력한 뒤 다시 실행하세요.",
            extractedText: localText
          },
          { status: 422 }
        );
      }
      return localResponse(localText, parsed.file?.extractedText ?? parsed.problemText);
    }

    let problemText = parsed.problemText;
    let imageContext = parsed.imageContext;
    let extractedText = "";

    if (parsed.file) {
      extractedText = normalizeText(await extractProblemFromFile(parsed.file));
      problemText = problemText ? `${problemText}\n\n[업로드 파일 인식 결과]\n${extractedText}` : extractedText;
      imageContext = imageContext ? `${imageContext}\n\n[업로드 파일 인식 결과]\n${extractedText}` : extractedText;
    }

    problemText = normalizeText(problemText);
    if (!problemText || !textLooksActionable(problemText)) {
      return NextResponse.json({ success: false, mode: "api", stage: "generated", message: "문제 텍스트를 충분히 인식하지 못했습니다. 인식 결과를 수정한 뒤 다시 실행하세요.", extractedText }, { status: 422 });
    }

    const maxAttempts = parsed.maxAttempts;
    const analysis = await analyzeProblem({ problemText, imageContext });
    const attempts = [];

    for (let i = 0; i < maxAttempts; i++) {
      const generated = await generateVariant(analysis);
      const verification = await verifyProblem({ analysis, generated });
      const localSimilarityRisk = surfaceSimilarityRisk(problemText, generated.new_problem.question);
      const similarityOk = generated.similarity_check.surface_similarity_risk !== "high" && localSimilarityRisk !== "high";
      const valid = verification.is_valid && verification.answer_matches && similarityOk;

      attempts.push({ index: i + 1, valid, localSimilarityRisk, modelSimilarityRisk: generated.similarity_check.surface_similarity_risk, verification });

      if (valid) {
        return NextResponse.json({ success: true, mode: "api", stage: "generated", extractedText, analysis, generated, verification, diagramSvg: renderDiagramSvg(generated.diagram_spec), attempts });
      }
    }

    return NextResponse.json({ success: false, mode: "api", stage: "generated", message: "검증을 통과한 문항을 생성하지 못했습니다.", extractedText, analysis, attempts }, { status: 422 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
