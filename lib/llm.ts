import OpenAI from "openai";
import { ANALYZE_PROMPT, GENERATE_PROMPT, VERIFY_PROMPT } from "./prompts";
import {
  GeneratedProblemSchema,
  ProblemAnalysisSchema,
  VerificationSchema,
  type GeneratedProblem,
  type ProblemAnalysis,
  type Verification
} from "./schema";

export type UploadedProblemFile = {
  filename: string;
  mimeType: string;
  dataUrl: string;
  extractedText?: string;
  extractionWarning?: string;
};

function client() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function model() {
  return process.env.OPENAI_MODEL || "gpt-4.1-mini";
}

function visionModel() {
  return process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini";
}

function parseJsonSafely(content: string): unknown {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(cleaned);
}

async function callJson<T>({
  system,
  user,
  schema,
  errorMessage
}: {
  system: string;
  user: string;
  schema: { parse: (value: unknown) => T };
  errorMessage: string;
}): Promise<T> {
  const completion = await client().chat.completions.create({
    model: model(),
    messages: [
      { role: "system", content: `${system}\n\n반드시 유효한 JSON 객체만 출력하라. 마크다운 코드블록, 설명문, 주석은 출력하지 마라.` },
      { role: "user", content: user }
    ],
    response_format: { type: "json_object" },
    temperature: 0.3
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error(errorMessage);

  try {
    return schema.parse(parseJsonSafely(content));
  } catch (error) {
    console.error("LLM JSON parse/validation error:", error);
    console.error("Raw LLM content:", content);
    throw new Error(errorMessage);
  }
}

async function cleanExtractedDocumentText(file: UploadedProblemFile): Promise<string> {
  const completion = await client().chat.completions.create({
    model: model(),
    messages: [
      {
        role: "system",
        content: "너는 한국 수학 문제 문서 정리 도우미다. 사용자가 제공한 HWP/HWPX 추출 텍스트에서 1번 문제 또는 가장 먼저 등장하는 수학 문제를 정리한다. 없는 내용을 만들지 말고, 수식·보기·조건·단위·도형 설명을 최대한 보존한다."
      },
      {
        role: "user",
        content: `파일명: ${file.filename}\n${file.extractionWarning ? `주의: ${file.extractionWarning}\n` : ""}\n\n추출 텍스트:\n${file.extractedText ?? ""}`
      }
    ],
    temperature: 0.1
  });

  const output = completion.choices[0]?.message?.content?.trim();
  return output || file.extractedText || "";
}

export async function extractProblemFromFile(file: UploadedProblemFile): Promise<string> {
  if (file.extractedText) {
    const cleaned = await cleanExtractedDocumentText(file);
    return [file.extractionWarning ? `[주의] ${file.extractionWarning}` : "", cleaned].filter(Boolean).join("\n\n");
  }

  const isPdf = file.mimeType === "application/pdf" || file.filename.toLowerCase().endsWith(".pdf");
  const isImage = file.mimeType.startsWith("image/");

  if (!isPdf && !isImage) {
    throw new Error("지원하지 않는 파일 형식입니다. PDF, JPG, PNG, WEBP, HWPX, HWP 파일을 업로드해 주세요.");
  }

  const filePart = isPdf
    ? {
        type: "input_file",
        filename: file.filename || "problem.pdf",
        file_data: file.dataUrl
      }
    : {
        type: "input_image",
        image_url: file.dataUrl,
        detail: "high"
      };

  const openai = client() as any;
  const response = await openai.responses.create({
    model: visionModel(),
    input: [
      {
        role: "user",
        content: [
          filePart,
          {
            type: "input_text",
            text: `첨부된 파일은 수학 문제 캡처, 스캔 이미지 또는 PDF이다.

다음 원칙으로 문제를 정확히 추출하라.
1. 문제 본문, 보기, 조건, 표, 수식, 좌표, 단위, 도형 설명을 빠짐없이 OCR한다.
2. 수식은 가능한 한 LaTeX 또는 일반 텍스트 수식으로 보존한다.
3. 도형이 있으면 점 이름, 선분, 각도, 길이, 좌표, 평행/수직 관계, 색칠 영역을 말로 상세히 설명한다.
4. 여러 문제가 있으면 1번 문제만 우선 추출한다.
5. 추측하지 말고, 흐릿해서 확실하지 않은 부분은 [불확실]이라고 표시한다.
6. 최종 출력은 생성 모델이 바로 분석할 수 있는 한국어 문제 텍스트와 도형 설명만 출력한다.`
          }
        ]
      }
    ],
    temperature: 0.1
  });

  const outputText = String(response.output_text ?? "").trim();
  if (!outputText) {
    throw new Error("파일에서 문제를 추출하지 못했습니다. 더 선명한 이미지나 단일 문제 PDF를 사용해 주세요.");
  }

  return outputText;
}

export async function analyzeProblem({ problemText, imageContext }: { problemText: string; imageContext?: string }): Promise<ProblemAnalysis> {
  return callJson({
    system: ANALYZE_PROMPT,
    user: `입력 문제:\n${problemText}\n\n이미지 설명/OCR:\n${imageContext ?? ""}`,
    schema: ProblemAnalysisSchema,
    errorMessage: "문제 분석 결과 파싱 실패"
  });
}

export async function generateVariant(analysis: ProblemAnalysis): Promise<GeneratedProblem> {
  return callJson({
    system: GENERATE_PROMPT,
    user: `분석 JSON:\n${JSON.stringify(analysis, null, 2)}`,
    schema: GeneratedProblemSchema,
    errorMessage: "문항 생성 결과 파싱 실패"
  });
}

export async function verifyProblem({ analysis, generated }: { analysis: ProblemAnalysis; generated: GeneratedProblem }): Promise<Verification> {
  return callJson({
    system: VERIFY_PROMPT,
    user: `원문 분석 JSON:\n${JSON.stringify(analysis, null, 2)}\n\n생성 문제 JSON:\n${JSON.stringify(generated, null, 2)}`,
    schema: VerificationSchema,
    errorMessage: "검증 결과 파싱 실패"
  });
}
