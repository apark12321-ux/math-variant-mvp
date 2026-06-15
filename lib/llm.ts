import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
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
  return process.env.OPENAI_MODEL || "gpt-5.5";
}

export async function analyzeProblem({ problemText, imageContext }: { problemText: string; imageContext?: string }): Promise<ProblemAnalysis> {
  const completion = await client().beta.chat.completions.parse({
    model: model(),
    messages: [
      { role: "system", content: ANALYZE_PROMPT },
      { role: "user", content: `입력 문제:\n${problemText}\n\n이미지 설명/OCR:\n${imageContext ?? ""}` }
    ],
    response_format: zodResponseFormat(ProblemAnalysisSchema, "problem_analysis")
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) throw new Error("문제 분석 결과 파싱 실패");
  return parsed;
}

export async function generateVariant(analysis: ProblemAnalysis): Promise<GeneratedProblem> {
  const completion = await client().beta.chat.completions.parse({
    model: model(),
    messages: [
      { role: "system", content: GENERATE_PROMPT },
      { role: "user", content: `분석 JSON:\n${JSON.stringify(analysis, null, 2)}` }
    ],
    response_format: zodResponseFormat(GeneratedProblemSchema, "generated_problem")
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) throw new Error("문항 생성 결과 파싱 실패");
  return parsed;
}

export async function verifyProblem({ analysis, generated }: { analysis: ProblemAnalysis; generated: GeneratedProblem }): Promise<Verification> {
  const completion = await client().beta.chat.completions.parse({
    model: model(),
    messages: [
      { role: "system", content: VERIFY_PROMPT },
      { role: "user", content: `원문 분석 JSON:\n${JSON.stringify(analysis, null, 2)}\n\n생성 문제 JSON:\n${JSON.stringify(generated, null, 2)}` }
    ],
    response_format: zodResponseFormat(VerificationSchema, "verification")
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) throw new Error("검증 결과 파싱 실패");
  return parsed;
}
