import { NextResponse } from "next/server";
import { analyzeProblem, extractProblemFromFile, generateVariant, verifyProblem, type UploadedProblemFile } from "../../../lib/llm";
import { renderDiagramSvg } from "../../../lib/renderer";
import { surfaceSimilarityRisk } from "../../../lib/similarity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

type GenerateRequest = {
  problemText?: string;
  imageContext?: string;
  maxAttempts?: number;
};

type ParsedRequest = {
  problemText: string;
  imageContext: string;
  maxAttempts: number;
  file?: UploadedProblemFile;
};

function clampAttempts(value: unknown) {
  const parsed = typeof value === "string" ? Number(value) : typeof value === "number" ? value : 3;
  return Math.min(Math.max(Number.isFinite(parsed) ? parsed : 3, 1), 5);
}

async function fileToUploadedProblemFile(file: File): Promise<UploadedProblemFile> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("업로드 파일은 10MB 이하만 지원합니다. 큰 PDF는 한 문제 단위로 캡처해서 올려 주세요.");
  }

  const mimeType = file.type || "application/octet-stream";
  const isPdf = mimeType === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isImage = mimeType.startsWith("image/");

  if (!isPdf && !isImage) {
    throw new Error("지원 파일 형식은 PDF, JPG, PNG, WEBP입니다.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return {
    filename: file.name || (isPdf ? "problem.pdf" : "problem-image.png"),
    mimeType,
    dataUrl: `data:${mimeType};base64,${buffer.toString("base64")}`
  };
}

async function parseRequest(req: Request): Promise<ParsedRequest> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const problemText = String(form.get("problemText") ?? "").trim();
    const imageContext = String(form.get("imageContext") ?? "").trim();
    const maxAttempts = clampAttempts(form.get("maxAttempts"));
    const fileValue = form.get("file");

    const parsed: ParsedRequest = { problemText, imageContext, maxAttempts };
    if (fileValue instanceof File && fileValue.size > 0) {
      parsed.file = await fileToUploadedProblemFile(fileValue);
    }

    return parsed;
  }

  const body = (await req.json()) as GenerateRequest;
  return {
    problemText: body.problemText?.trim() ?? "",
    imageContext: body.imageContext?.trim() ?? "",
    maxAttempts: clampAttempts(body.maxAttempts)
  };
}

export async function POST(req: Request) {
  try {
    const parsed = await parseRequest(req);
    let problemText = parsed.problemText;
    let imageContext = parsed.imageContext;
    let extractedText = "";

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ success: false, message: "OPENAI_API_KEY가 설정되지 않았습니다." }, { status: 500 });
    }

    if (parsed.file) {
      extractedText = await extractProblemFromFile(parsed.file);
      problemText = problemText
        ? `${problemText}\n\n[업로드 파일 인식 결과]\n${extractedText}`
        : extractedText;
      imageContext = imageContext
        ? `${imageContext}\n\n[업로드 파일 인식 결과]\n${extractedText}`
        : extractedText;
    }

    if (!problemText) {
      return NextResponse.json({ success: false, message: "문제 텍스트를 입력하거나 이미지/PDF 파일을 업로드해 주세요." }, { status: 400 });
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
        return NextResponse.json({
          success: true,
          extractedText,
          analysis,
          generated,
          verification,
          diagramSvg: renderDiagramSvg(generated.diagram_spec),
          attempts
        });
      }
    }

    return NextResponse.json({ success: false, message: "검증을 통과한 문항을 생성하지 못했습니다.", extractedText, analysis, attempts }, { status: 422 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
