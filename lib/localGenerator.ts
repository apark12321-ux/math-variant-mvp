import type { GeneratedProblem, ProblemAnalysis, Verification } from "./schema";

export function generateLocalVariant(problemText: string): { analysis: ProblemAnalysis; generated: GeneratedProblem; verification: Verification } {
  const analysis: ProblemAnalysis = {
    source_problem: { text: problemText, image_exists: false, image_description: "로컬 모드" },
    classification: {
      school_level: "elementary",
      grade: 5,
      curriculum_year: "2022",
      domain: "수와 연산",
      unit: "기초 연산",
      achievement_standard: "로컬 자동 생성",
      difficulty: 1,
      problem_type: "calculation"
    },
    math_structure: {
      core_concept: "기초 연산",
      solution_pattern: ["수치 변경"],
      required_formulas: [],
      givens: [],
      unknowns: ["정답"],
      constraints: ["로컬 모드"]
    },
    variant_policy: {
      keep: ["핵심 개념"],
      change: ["수치"],
      avoid: ["교육과정 밖 공식"]
    },
    diagram_spec: { required: false, type: "none", canvas: { width: 600, height: 360 }, elements: [] }
  };

  const generated: GeneratedProblem = {
    new_problem: {
      question: "15와 9의 합을 구하시오.",
      choices: [],
      answer: "24",
      explanation: "15+9=24입니다.",
      short_solution: "24",
      difficulty: 1,
      curriculum: {
        school_level: "초등학교",
        grade: "5",
        domain: "수와 연산",
        unit: "기초 연산",
        achievement_standard: "로컬 자동 생성"
      }
    },
    diagram_spec: analysis.diagram_spec,
    similarity_check: { same_concept: true, surface_similarity_risk: "medium", changed_elements: ["수치"] }
  };

  const verification: Verification = {
    is_valid: true,
    detected_errors: [],
    independent_answer: "24",
    answer_matches: true,
    fix_required: false,
    fix_instructions: "로컬 계산 결과입니다."
  };

  return { analysis, generated, verification };
}
