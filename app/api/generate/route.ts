import { NextResponse } from "next/server";
import { analyzeProblem, generateVariant, verifyProblem } from "@/lib/llm";
import { renderDiagramSvg } from "@/lib/renderer";
import { surfaceSimilarityRisk } from "@/lib/similarity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GenerateRequest = {
  problemText?: string;
  imageContext?: string;
  maxAttempts?: number;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GenerateRequest;
    const problemText = body.problemText?.trim() ?? "";
    const imageContext = body.imageContext?.trim() ?? "";
    const maxAttempts = Math.min(Math.max(body.maxAttempts ?? 3, 1), 5);

    if (!problemText) {
      return NextResponse.json({ success: false, message: "문제 텍스트를 입력해 주세요." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ success: false, message: "OPENAI_API_KEY가 설정되지 않았습니다." }, { status: 500 });
    }

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
        return NextResponse.json({ success: true, analysis, generated, verification, diagramSvg: renderDiagramSvg(generated.diagram_spec), attempts });
      }
    }

    return NextResponse.json({ success: false, message: "검증을 통과한 문항을 생성하지 못했습니다.", analysis, attempts }, { status: 422 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
