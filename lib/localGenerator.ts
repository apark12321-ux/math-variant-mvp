import type { DiagramSpec, GeneratedProblem, ProblemAnalysis, Verification } from "./schema";

type LocalResult = { analysis: ProblemAnalysis; generated: GeneratedProblem; verification: Verification };

type LocalTemplate = {
  schoolLevel: "초등학교" | "중학교" | "고등학교";
  grade: string;
  domain: string;
  unit: string;
  achievementStandard: string;
  difficulty: number;
  problemType: "calculation" | "word_problem" | "geometry" | "graph" | "unknown";
  coreConcept: string;
  formulas: string[];
  givens: string[];
  unknowns: string[];
  question: string;
  answer: string;
  explanation: string;
  shortSolution: string;
  changedElements: string[];
  valid: boolean;
  diagramSpec?: DiagramSpec;
  errors?: string[];
};

const EMPTY_DIAGRAM: DiagramSpec = { required: false, type: "none", canvas: { width: 600, height: 360 }, elements: [] };

function numberText(value: number) {
  if (!Number.isFinite(value)) return "";
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function extractNumbers(text: string): number[] {
  return Array.from(text.matchAll(/\d+(?:\.\d+)?/g)).map((match) => Number(match[0])).filter(Number.isFinite);
}

function chooseVariantNumber(value: number, options: { min?: number; max?: number; delta?: number } = {}) {
  const min = options.min ?? 1;
  const max = options.max ?? 99;
  const delta = options.delta ?? (value <= 9 ? 2 : value <= 30 ? 5 : 10);
  let next = value + delta;
  if (next > max) next = Math.max(min, value - delta);
  if (next === value) next = Math.min(max, value + 1);
  return next;
}

function chooseDifferentPair(a: number, b: number) {
  return [chooseVariantNumber(a, { min: 2, max: 80 }), chooseVariantNumber(b, { min: 2, max: 80, delta: b <= 9 ? 3 : 6 })];
}

function detectUnit(text: string) {
  if (/mm|밀리미터/.test(text)) return "mm";
  if (/cm|센티미터|센티/.test(text)) return "cm";
  if (/km|킬로미터/.test(text)) return "km";
  if (/m|미터/.test(text)) return "m";
  return "";
}

function squareUnit(unit: string) {
  return unit ? `${unit}²` : "";
}

function normalize(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function makeResult(problemText: string, template: LocalTemplate): LocalResult {
  const diagramSpec = template.diagramSpec ?? EMPTY_DIAGRAM;
  const analysis: ProblemAnalysis = {
    source_problem: {
      text: problemText,
      image_exists: /도형|그림|그래프|좌표|표|정사각형|직사각형|삼각형|원/.test(problemText),
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
      solution_pattern: ["원문 핵심 개념 유지", "수치 또는 조건 변형", "독립 계산으로 정답 검증"],
      required_formulas: template.formulas,
      givens: template.givens,
      unknowns: template.unknowns,
      constraints: ["무료 로컬 규칙 기반 생성", "사용자 확정 텍스트 기준", "지원하지 않는 유형은 생성 차단"]
    },
    variant_policy: {
      keep: ["핵심 개념", "풀이 구조", "교육과정 범위"],
      change: template.changedElements,
      avoid: ["원문 숫자 그대로 복사", "지원하지 않는 문제 유형 임의 생성", "교육과정 밖 공식"]
    },
    diagram_spec: diagramSpec
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
    diagram_spec: diagramSpec,
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
      ? "로컬 규칙으로 정답을 독립 계산했습니다."
      : "무료 로컬 모드에서 아직 지원하지 않는 문항입니다. 문제 텍스트를 더 명확히 입력하거나 API/OCR 모드를 사용해야 합니다."
  };

  return { analysis, generated, verification };
}

function trySquareProblem(text: string): LocalTemplate | null {
  if (!/정사각형/.test(text)) return null;
  const numbers = extractNumbers(text);
  const side = numbers[0];
  if (!side) return null;
  const unit = detectUnit(text);
  const newSide = chooseVariantNumber(side, { min: 2, max: 50 });

  if (/둘레|주위/.test(text)) {
    const answer = 4 * newSide;
    return {
      schoolLevel: "초등학교",
      grade: "5",
      domain: "도형과 측정",
      unit: "정사각형의 둘레",
      achievementStandard: "다각형의 둘레를 구할 수 있다.",
      difficulty: 1,
      problemType: "geometry",
      coreConcept: "정사각형은 네 변의 길이가 모두 같다.",
      formulas: ["정사각형의 둘레 = 한 변의 길이 × 4"],
      givens: [`한 변의 길이 ${numberText(newSide)}${unit}`],
      unknowns: ["정사각형의 둘레"],
      question: `한 변의 길이가 ${numberText(newSide)}${unit}인 정사각형의 둘레를 구하시오.`,
      answer: `${numberText(answer)}${unit}`,
      explanation: `정사각형은 네 변의 길이가 모두 같으므로 둘레는 한 변의 길이의 4배입니다.\n${numberText(newSide)}×4=${numberText(answer)}\n따라서 둘레는 ${numberText(answer)}${unit}입니다.`,
      shortSolution: `${numberText(answer)}${unit}`,
      changedElements: [`한 변의 길이 ${numberText(side)}${unit} → ${numberText(newSide)}${unit}`],
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
    problemType: "geometry",
    coreConcept: "정사각형의 넓이는 한 변의 길이×한 변의 길이로 구한다.",
    formulas: ["정사각형의 넓이 = 한 변의 길이 × 한 변의 길이"],
    givens: [`한 변의 길이 ${numberText(newSide)}${unit}`],
    unknowns: ["정사각형의 넓이"],
    question: `한 변의 길이가 ${numberText(newSide)}${unit}인 정사각형의 넓이를 구하시오.`,
    answer: `${numberText(answer)}${squareUnit(unit)}`,
    explanation: `정사각형의 넓이는 한 변의 길이×한 변의 길이입니다.\n${numberText(newSide)}×${numberText(newSide)}=${numberText(answer)}\n따라서 넓이는 ${numberText(answer)}${squareUnit(unit)}입니다.`,
    shortSolution: `${numberText(answer)}${squareUnit(unit)}`,
    changedElements: [`한 변의 길이 ${numberText(side)}${unit} → ${numberText(newSide)}${unit}`],
    valid: true
  };
}

function tryRectangleProblem(text: string): LocalTemplate | null {
  if (!/직사각형/.test(text)) return null;
  const numbers = extractNumbers(text);
  if (numbers.length < 2) return null;
  const [width, height] = chooseDifferentPair(numbers[0], numbers[1]);
  const unit = detectUnit(text);

  if (/둘레|주위/.test(text)) {
    const answer = 2 * (width + height);
    return {
      schoolLevel: "초등학교",
      grade: "5",
      domain: "도형과 측정",
      unit: "직사각형의 둘레",
      achievementStandard: "다각형의 둘레를 구할 수 있다.",
      difficulty: 1,
      problemType: "geometry",
      coreConcept: "직사각형의 둘레는 (가로+세로)×2로 구한다.",
      formulas: ["직사각형의 둘레 = (가로 + 세로) × 2"],
      givens: [`가로 ${numberText(width)}${unit}`, `세로 ${numberText(height)}${unit}`],
      unknowns: ["직사각형의 둘레"],
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
    problemType: "geometry",
    coreConcept: "직사각형의 넓이는 가로×세로로 구한다.",
    formulas: ["직사각형의 넓이 = 가로 × 세로"],
    givens: [`가로 ${numberText(width)}${unit}`, `세로 ${numberText(height)}${unit}`],
    unknowns: ["직사각형의 넓이"],
    question: `가로가 ${numberText(width)}${unit}, 세로가 ${numberText(height)}${unit}인 직사각형의 넓이를 구하시오.`,
    answer: `${numberText(answer)}${squareUnit(unit)}`,
    explanation: `직사각형의 넓이는 가로×세로입니다.\n${numberText(width)}×${numberText(height)}=${numberText(answer)}\n따라서 넓이는 ${numberText(answer)}${squareUnit(unit)}입니다.`,
    shortSolution: `${numberText(answer)}${squareUnit(unit)}`,
    changedElements: ["가로와 세로의 길이"],
    valid: true
  };
}

function tryTriangleAreaProblem(text: string): LocalTemplate | null {
  if (!/삼각형/.test(text) || !/넓이/.test(text)) return null;
  const numbers = extractNumbers(text);
  if (numbers.length < 2) return null;
  const [base, height] = chooseDifferentPair(numbers[0], numbers[1]);
  const unit = detectUnit(text);
  const answer = (base * height) / 2;
  return {
    schoolLevel: "초등학교",
    grade: "5",
    domain: "도형과 측정",
    unit: "삼각형의 넓이",
    achievementStandard: "삼각형의 넓이를 구할 수 있다.",
    difficulty: 1,
    problemType: "geometry",
    coreConcept: "삼각형의 넓이는 밑변×높이÷2로 구한다.",
    formulas: ["삼각형의 넓이 = 밑변 × 높이 ÷ 2"],
    givens: [`밑변 ${numberText(base)}${unit}`, `높이 ${numberText(height)}${unit}`],
    unknowns: ["삼각형의 넓이"],
    question: `밑변이 ${numberText(base)}${unit}, 높이가 ${numberText(height)}${unit}인 삼각형의 넓이를 구하시오.`,
    answer: `${numberText(answer)}${squareUnit(unit)}`,
    explanation: `삼각형의 넓이는 밑변×높이÷2입니다.\n${numberText(base)}×${numberText(height)}÷2=${numberText(answer)}\n따라서 넓이는 ${numberText(answer)}${squareUnit(unit)}입니다.`,
    shortSolution: `${numberText(answer)}${squareUnit(unit)}`,
    changedElements: ["밑변과 높이"],
    valid: true
  };
}

function tryCircleProblem(text: string): LocalTemplate | null {
  if (!/원/.test(text) || !/(반지름|지름)/.test(text)) return null;
  const numbers = extractNumbers(text);
  const raw = numbers[0];
  if (!raw) return null;
  const unit = detectUnit(text);
  const givenIsDiameter = /지름/.test(text) && !/반지름/.test(text);
  const radius = givenIsDiameter ? chooseVariantNumber(raw, { min: 4, max: 60 }) / 2 : chooseVariantNumber(raw, { min: 2, max: 30 });
  const givenLabel = givenIsDiameter ? `지름이 ${numberText(radius * 2)}${unit}` : `반지름이 ${numberText(radius)}${unit}`;

  if (/넓이/.test(text)) {
    const answer = 3.14 * radius * radius;
    return {
      schoolLevel: "초등학교",
      grade: "6",
      domain: "도형과 측정",
      unit: "원의 넓이",
      achievementStandard: "원주율을 이용하여 원의 넓이를 구할 수 있다.",
      difficulty: 2,
      problemType: "geometry",
      coreConcept: "원의 넓이는 원주율×반지름×반지름으로 구한다.",
      formulas: ["원의 넓이 = 3.14 × 반지름 × 반지름"],
      givens: [givenLabel],
      unknowns: ["원의 넓이"],
      question: `${givenLabel}인 원의 넓이를 구하시오. 단, 원주율은 3.14로 계산하시오.`,
      answer: `${numberText(answer)}${squareUnit(unit)}`,
      explanation: `원의 넓이는 3.14×반지름×반지름입니다.\n3.14×${numberText(radius)}×${numberText(radius)}=${numberText(answer)}\n따라서 넓이는 ${numberText(answer)}${squareUnit(unit)}입니다.`,
      shortSolution: `${numberText(answer)}${squareUnit(unit)}`,
      changedElements: ["반지름 또는 지름"],
      valid: true
    };
  }

  if (/둘레|원주/.test(text)) {
    const answer = 2 * 3.14 * radius;
    return {
      schoolLevel: "초등학교",
      grade: "6",
      domain: "도형과 측정",
      unit: "원의 둘레",
      achievementStandard: "원주율을 이용하여 원주를 구할 수 있다.",
      difficulty: 2,
      problemType: "geometry",
      coreConcept: "원의 둘레는 2×원주율×반지름으로 구한다.",
      formulas: ["원의 둘레 = 2 × 3.14 × 반지름"],
      givens: [givenLabel],
      unknowns: ["원의 둘레"],
      question: `${givenLabel}인 원의 둘레를 구하시오. 단, 원주율은 3.14로 계산하시오.`,
      answer: `${numberText(answer)}${unit}`,
      explanation: `원의 둘레는 2×3.14×반지름입니다.\n2×3.14×${numberText(radius)}=${numberText(answer)}\n따라서 둘레는 ${numberText(answer)}${unit}입니다.`,
      shortSolution: `${numberText(answer)}${unit}`,
      changedElements: ["반지름 또는 지름"],
      valid: true
    };
  }

  return null;
}

function tryArithmeticProblem(text: string): LocalTemplate | null {
  const numbers = extractNumbers(text);
  if (numbers.length < 2) return null;
  const [a, b] = chooseDifferentPair(numbers[0], numbers[1]);

  const op = /차|빼|뺄셈|-/.test(text)
    ? "sub"
    : /곱|곱셈|×|x/.test(text)
      ? "mul"
      : /나누|몫|÷/.test(text)
        ? "div"
        : /(합|더하|덧셈|\+)/.test(text)
          ? "add"
          : null;
  if (!op) return null;

  const dividend = a * b;
  const question =
    op === "sub" ? `${numberText(a + b)}에서 ${numberText(b)}를 빼시오.` :
    op === "mul" ? `${numberText(a)}와 ${numberText(b)}의 곱을 구하시오.` :
    op === "div" ? `${numberText(dividend)}를 ${numberText(b)}로 나누었을 때의 몫을 구하시오.` :
    `${numberText(a)}와 ${numberText(b)}의 합을 구하시오.`;
  const answer =
    op === "sub" ? a :
    op === "mul" ? a * b :
    op === "div" ? a :
    a + b;
  const explanation =
    op === "sub" ? `${numberText(a + b)}-${numberText(b)}=${numberText(answer)}입니다.` :
    op === "mul" ? `${numberText(a)}×${numberText(b)}=${numberText(answer)}입니다.` :
    op === "div" ? `${numberText(dividend)}÷${numberText(b)}=${numberText(answer)}입니다.` :
    `${numberText(a)}+${numberText(b)}=${numberText(answer)}입니다.`;

  return {
    schoolLevel: "초등학교",
    grade: "3",
    domain: "수와 연산",
    unit: op === "add" ? "자연수의 덧셈" : op === "sub" ? "자연수의 뺄셈" : op === "mul" ? "자연수의 곱셈" : "자연수의 나눗셈",
    achievementStandard: "자연수의 사칙계산을 할 수 있다.",
    difficulty: 1,
    problemType: "calculation",
    coreConcept: "자연수의 사칙계산",
    formulas: [],
    givens: [numberText(a), numberText(b)],
    unknowns: ["계산 결과"],
    question,
    answer: numberText(answer),
    explanation,
    shortSolution: numberText(answer),
    changedElements: ["계산에 사용되는 수"],
    valid: true
  };
}

function tryLinearEquationProblem(text: string): LocalTemplate | null {
  const normalized = normalize(text);
  if (!/(방정식|x|𝑥|해)/.test(normalized)) return null;
  const match = normalized.match(/([+-]?\d*)\s*x\s*([+-])\s*(\d+)\s*=\s*([+-]?\d+)/i);
  if (!match) return null;

  const rawA = match[1];
  const a0 = rawA === "" || rawA === "+" ? 1 : rawA === "-" ? -1 : Number(rawA);
  const sign = match[2];
  const b0 = Number(match[3]) * (sign === "-" ? -1 : 1);
  const answerX0 = (Number(match[4]) - b0) / a0;
  if (!Number.isFinite(answerX0)) return null;

  const x = Number.isInteger(answerX0) ? answerX0 + 2 : Math.round(answerX0) + 2;
  const a = a0 === 0 ? 2 : Math.abs(a0) + 1;
  const b = Math.abs(b0) + 3;
  const c = a * x + b;

  return {
    schoolLevel: "중학교",
    grade: "1",
    domain: "변화와 관계",
    unit: "일차방정식",
    achievementStandard: "일차방정식을 풀 수 있다.",
    difficulty: 2,
    problemType: "calculation",
    coreConcept: "등식의 성질을 이용한 일차방정식 풀이",
    formulas: ["ax+b=c이면 ax=c-b, x=(c-b)/a"],
    givens: [`${a}x+${b}=${c}`],
    unknowns: ["x의 값"],
    question: `방정식 ${a}x+${b}=${c}의 해를 구하시오.`,
    answer: `x=${numberText(x)}`,
    explanation: `${a}x+${b}=${c}\n${a}x=${c}-${b}=${a * x}\nx=${numberText(x)}\n따라서 해는 x=${numberText(x)}입니다.`,
    shortSolution: `x=${numberText(x)}`,
    changedElements: ["계수와 상수"],
    valid: true
  };
}

function tryQuadraticVertexProblem(text: string): LocalTemplate | null {
  const normalized = text.replace(/²/g, "^2").replace(/−/g, "-");
  if (!/(이차함수|꼭짓점|축)/.test(normalized)) return null;
  const match = normalized.match(/y\s*=\s*x\^?2\s*([+-])\s*(\d+)x\s*([+-])\s*(\d+)/i);
  if (!match) return null;

  const signB = match[1] === "-" ? -1 : 1;
  const b0 = signB * Number(match[2]);
  const signC = match[3] === "-" ? -1 : 1;
  const c0 = signC * Number(match[4]);
  const p0 = -b0 / 2;
  if (!Number.isFinite(p0)) return null;

  const p = Number.isInteger(p0) ? p0 + 1 : Math.round(p0) + 1;
  const q = c0 >= 0 ? c0 - 2 : c0 + 2;
  const b = -2 * p;
  const c = p * p + q;
  const expression = `y=x^2${b < 0 ? "-" : "+"}${Math.abs(b)}x${c < 0 ? "-" : "+"}${Math.abs(c)}`;

  return {
    schoolLevel: "중학교",
    grade: "3",
    domain: "변화와 관계",
    unit: "이차함수와 그래프",
    achievementStandard: "이차함수의 그래프의 성질을 이해한다.",
    difficulty: 3,
    problemType: "graph",
    coreConcept: "이차함수 y=x²+bx+c의 꼭짓점과 축",
    formulas: ["y=x²+bx+c의 축은 x=-b/2", "꼭짓점은 (p, q) 형태로 완전제곱하여 구한다."],
    givens: [expression],
    unknowns: ["꼭짓점", "축의 방정식"],
    question: `이차함수 ${expression}의 그래프의 꼭짓점과 축의 방정식을 구하시오.`,
    answer: `꼭짓점: (${numberText(p)}, ${numberText(q)}), 축의 방정식: x=${numberText(p)}`,
    explanation: `${expression}\n=x^2${b < 0 ? "-" : "+"}${Math.abs(b)}x${c < 0 ? "-" : "+"}${Math.abs(c)}\n=(x${p < 0 ? "+" : "-"}${Math.abs(p)})^2${q < 0 ? "-" : "+"}${Math.abs(q)}\n따라서 꼭짓점은 (${numberText(p)}, ${numberText(q)}), 축의 방정식은 x=${numberText(p)}입니다.`,
    shortSolution: `(${numberText(p)}, ${numberText(q)}), x=${numberText(p)}`,
    changedElements: ["이차함수의 계수와 상수항"],
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
    problemType: "unknown",
    coreConcept: "지원하지 않는 로컬 문항 유형",
    formulas: [],
    givens: [],
    unknowns: [],
    question: "",
    answer: "생성 보류",
    explanation: `현재 확정 텍스트:\n${problemText}\n\n무료 로컬 모드에서는 현재 정사각형·직사각형·삼각형·원 넓이/둘레, 자연수 사칙계산, 일부 일차방정식, 일부 이차함수 꼭짓점 문제만 안정적으로 생성합니다. 이 범위를 벗어난 스캔 PDF/복잡한 도형/그래프 문항은 임의 생성하지 않습니다.`,
    shortSolution: "생성 보류",
    changedElements: [],
    valid: false,
    errors: ["무료 로컬 모드 미지원 문항 유형", "임의 문항 생성 차단"]
  };
}

export function generateLocalVariant(problemText: string): LocalResult {
  const text = problemText.trim();
  const template =
    trySquareProblem(text) ??
    tryRectangleProblem(text) ??
    tryTriangleAreaProblem(text) ??
    tryCircleProblem(text) ??
    tryLinearEquationProblem(text) ??
    tryQuadraticVertexProblem(text) ??
    tryArithmeticProblem(text) ??
    unsupportedTemplate(text);
  return makeResult(text, template);
}
