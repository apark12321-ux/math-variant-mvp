import type { GeneratedProblem, ProblemAnalysis, Verification } from "./schema";

type LocalResult = { analysis: ProblemAnalysis; generated: GeneratedProblem; verification: Verification };

type LocalTemplate = {
  schoolLevel: "초등학교" | "중학교" | "고등학교";
  grade: string;
  domain: string;
  unit: string;
  achievementStandard: string;
  difficulty: number;
  problemType: string;
  coreConcept: string;
  question: string;
  answer: string;
  explanation: string;
  shortSolution: string;
  changedElements: string[];
  valid: boolean;
  errors?: string[];
};

function numberText(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function extractNumbers(text: string): number[] {
  return Array.from(text.matchAll(/\d+(?:\.\d+)?/g)).map((match) => Number(match[0])).filter(Number.isFinite);
}

function chooseVariantNumber(value: number) {
  if (!Number.isFinite(value)) return 2;
  if (value <= 2) return value + 2;
  if (value <= 9) return value + 2;
  if (value <= 30) return value + 5;
  return value + 10;
}

function detectUnit(text: string) {
  if (/mm/.test(text)) return "mm";
  if (/cm|센티미터/.test(text)) return "cm";
  if (/m|미터/.test(text)) return "m";
  return "";
}

function makeResult(problemText: string, template: LocalTemplate): LocalResult {
  const analysis: ProblemAnalysis = {
    source_problem: {
      text: problemText,
      image_exists: /도형|그림|그래프|좌표|표/.test(problemText),
      image_description: "무료 로컬 모드: 사용자가 확정한 텍스트 기준 분석"
    },
    classification: {
      school_level: template.schoolLevel === "초등학교" ? "elementary" : template.schoolLevel === "중학교" ? "middle" : "high",
      grade: Number(template.grade.replace(/[^0-9]/g, "")) || 0,
      curriculum_year: "2022",
      domain: template.domain,
      unit: template.unit,
      achievement_standard: template.achievementStandard,
      difficulty: template.difficulty,
      problem_type: template.problemType
    },
    math_structure: {
      core_concept: template.coreConcept,
      solution_pattern: ["원문 구조 유지", "수치 또는 조건 변형"],
      required_formulas: [],
      givens: [],
      unknowns: ["정답"],
      constraints: ["무료 로컬 규칙 기반 생성", "사용자 확정 텍스트 기준"]
    },
    variant_policy: {
      keep: ["핵심 개념", "풀이 구조", "교육과정 범위"],
      change: template.changedElements,
      avoid: ["원문 숫자 그대로 복사", "지원하지 않는 문제 유형 임의 생성", "교육과정 밖 공식"]
    },
    diagram_spec: { required: false, type: "none", canvas: { width: 600, height: 360 }, elements: [] }
  };

  const generated: GeneratedProblem = {
    new_problem: {
      question: template.question,
      choices: [],
      answer: template.answer,
      explanation: template.explanation,
      short_solution: template.shortSolution,
      difficulty: template.difficulty,
      curriculum: {
        school_level: template.schoolLevel,
        grade: template.grade,
        domain: template.domain,
        unit: template.unit,
        achievement_standard: template.achievementStandard
      }
    },
    diagram_spec: analysis.diagram_spec,
    similarity_check: {
      same_concept: template.valid,
      surface_similarity_risk: template.valid ? "medium" : "high",
      changed_elements: template.changedElements
    }
  };

  const verification: Verification = {
    is_valid: template.valid,
    detected_errors: template.errors ?? [],
    independent_answer: template.answer,
    answer_matches: template.valid,
    fix_required: !template.valid,
    fix_instructions: template.valid
      ? "로컬 규칙으로 계산을 검증했습니다."
      : "무료 로컬 모드에서 아직 지원하지 않는 문항입니다. 인식 텍스트를 더 명확히 수정하거나 API 모드/OCR 모드를 사용해 주세요."
  };

  return { analysis, generated, verification };
}

function trySquareProblem(text: string): LocalTemplate | null {
  if (!/정사각형/.test(text)) return null;

  const numbers = extractNumbers(text);
  const side = numbers[0];
  if (!side) return null;

  const unit = detectUnit(text);
  const newSide = chooseVariantNumber(side);
  const sideLabel = `${numberText(newSide)}${unit}`;

  if (/둘레/.test(text)) {
    const answer = 4 * newSide;
    return {
      schoolLevel: "초등학교",
      grade: "5",
      domain: "도형과 측정",
      unit: "정사각형의 둘레",
      achievementStandard: "다각형의 둘레를 구할 수 있다.",
      difficulty: 1,
      problemType: "measurement",
      coreConcept: "정사각형의 네 변의 길이는 모두 같다.",
      question: `한 변의 길이가 ${sideLabel}인 정사각형의 둘레를 구하시오.`,
      answer: `${numberText(answer)}${unit}`,
      explanation: `정사각형은 네 변의 길이가 모두 같으므로 둘레는 한 변의 길이의 4배입니다.\n${numberText(newSide)}×4=${numberText(answer)}\n따라서 둘레는 ${numberText(answer)}${unit}입니다.`,
      shortSolution: `${numberText(answer)}${unit}`,
      changedElements: [`한 변의 길이 ${numberText(side)}${unit} → ${sideLabel}`],
      valid: true
    };
  }

  const answer = newSide * newSide;
  return {
    schoolLevel: "초등학교",
    grade: "5",
    domain: "도형과 측정",
    unit: "정사각형의 넓이",
    achievementStandard: "사각형의 넓이를 구할 수 있다.",
    difficulty: 1,
    problemType: "measurement",
    coreConcept: "정사각형의 넓이는 한 변의 길이×한 변의 길이로 구한다.",
    question: `한 변의 길이가 ${sideLabel}인 정사각형의 넓이를 구하시오.`,
    answer: `${numberText(answer)}${unit ? `${unit}²` : ""}`,
    explanation: `정사각형의 넓이는 한 변의 길이×한 변의 길이입니다.\n${numberText(newSide)}×${numberText(newSide)}=${numberText(answer)}\n따라서 넓이는 ${numberText(answer)}${unit ? `${unit}²` : ""}입니다.`,
    shortSolution: `${numberText(answer)}${unit ? `${unit}²` : ""}`,
    changedElements: [`한 변의 길이 ${numberText(side)}${unit} → ${sideLabel}`],
    valid: true
  };
}

function tryRectangleProblem(text: string): LocalTemplate | null {
  if (!/직사각형/.test(text)) return null;

  const numbers = extractNumbers(text);
  if (numbers.length < 2) return null;

  const width = chooseVariantNumber(numbers[0]);
  const height = chooseVariantNumber(numbers[1]);
  const unit = detectUnit(text);

  if (/둘레/.test(text)) {
    const answer = 2 * (width + height);
    return {
      schoolLevel: "초등학교",
      grade: "5",
      domain: "도형과 측정",
      unit: "직사각형의 둘레",
      achievementStandard: "다각형의 둘레를 구할 수 있다.",
      difficulty: 1,
      problemType: "measurement",
      coreConcept: "직사각형의 둘레는 (가로+세로)×2로 구한다.",
      question: `가로가 ${numberText(width)}${unit}, 세로가 ${numberText(height)}${unit}인 직사각형의 둘레를 구하시오.`,
      answer: `${numberText(answer)}${unit}`,
      explanation: `직사각형의 둘레는 (가로+세로)×2입니다.\n(${numberText(width)}+${numberText(height)})×2=${numberText(answer)}\n따라서 둘레는 ${numberText(answer)}${unit}입니다.`,
      shortSolution: `${numberText(answer)}${unit}`,
      changedElements: ["가로와 세로의 길이"],
      valid: true
    };
  }

  const answer = width * height;
  return {
    schoolLevel: "초등학교",
    grade: "5",
    domain: "도형과 측정",
    unit: "직사각형의 넓이",
    achievementStandard: "사각형의 넓이를 구할 수 있다.",
    difficulty: 1,
    problemType: "measurement",
    coreConcept: "직사각형의 넓이는 가로×세로로 구한다.",
    question: `가로가 ${numberText(width)}${unit}, 세로가 ${numberText(height)}${unit}인 직사각형의 넓이를 구하시오.`,
    answer: `${numberText(answer)}${unit ? `${unit}²` : ""}`,
    explanation: `직사각형의 넓이는 가로×세로입니다.\n${numberText(width)}×${numberText(height)}=${numberText(answer)}\n따라서 넓이는 ${numberText(answer)}${unit ? `${unit}²` : ""}입니다.`,
    shortSolution: `${numberText(answer)}${unit ? `${unit}²` : ""}`,
    changedElements: ["가로와 세로의 길이"],
    valid: true
  };
}

function tryAdditionProblem(text: string): LocalTemplate | null {
  if (!/(합|더하|덧셈|\+)/.test(text)) return null;
  const numbers = extractNumbers(text);
  if (numbers.length < 2) return null;

  const a = chooseVariantNumber(numbers[0]);
  const b = chooseVariantNumber(numbers[1]);
  const answer = a + b;

  return {
    schoolLevel: "초등학교",
    grade: "3",
    domain: "수와 연산",
    unit: "자연수의 덧셈",
    achievementStandard: "자연수의 덧셈을 계산할 수 있다.",
    difficulty: 1,
    problemType: "calculation",
    coreConcept: "두 수의 합",
    question: `${numberText(a)}와 ${numberText(b)}의 합을 구하시오.`,
    answer: numberText(answer),
    explanation: `${numberText(a)}+${numberText(b)}=${numberText(answer)}입니다.`,
    shortSolution: numberText(answer),
    changedElements: ["덧셈에 사용되는 수"],
    valid: true
  };
}

function unsupportedTemplate(problemText: string): LocalTemplate {
  return {
    schoolLevel: "초등학교",
    grade: "0",
    domain: "분류 필요",
    unit: "지원 대기 문항",
    achievementStandard: "인식 결과 확인 필요",
    difficulty: 1,
    problemType: "unsupported",
    coreConcept: "지원하지 않는 로컬 문항 유형",
    question: "무료 로컬 모드에서 이 문항 유형은 아직 자동 생성할 수 없습니다. 인식 결과를 더 구체적으로 수정하거나 API 모드를 사용해 주세요.",
    answer: "생성 보류",
    explanation: `현재 확정 텍스트:\n${problemText}\n\n로컬 모드는 정사각형/직사각형 넓이·둘레, 기본 덧셈 등 규칙형 문항부터 지원합니다. 스캔 PDF의 복잡한 도형·그래프 문항은 OCR/API 또는 문항별 수동 확정 단계가 필요합니다.`,
    shortSolution: "생성 보류",
    changedElements: [],
    valid: false,
    errors: ["무료 로컬 모드 미지원 문항 유형", "임의 더미 문항 생성 차단"]
  };
}

export function generateLocalVariant(problemText: string): LocalResult {
  const text = problemText.trim();
  const template = trySquareProblem(text) ?? tryRectangleProblem(text) ?? tryAdditionProblem(text) ?? unsupportedTemplate(text);
  return makeResult(text, template);
}
