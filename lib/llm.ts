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

function client() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function model() {
  return process.env.OPENAI_MODEL || "gpt-4.1-mini";
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
    return schema.parse(JSON.parse(content));
  } catch (error) {
    console.error("LLM JSON parse/validation error:", error);
    console.error("Raw LLM content:", content);
    throw new Error(errorMessage);
  }
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
