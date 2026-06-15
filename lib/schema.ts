import { z } from "zod";

export const SvgPointSchema = z.object({ x: z.number(), y: z.number() });

export const DiagramElementSchema = z.object({
  kind: z.enum(["line", "dashed_line", "point", "text", "polygon", "circle", "axis", "curve", "angle"]),
  x1: z.number().nullable(),
  y1: z.number().nullable(),
  x2: z.number().nullable(),
  y2: z.number().nullable(),
  x: z.number().nullable(),
  y: z.number().nullable(),
  cx: z.number().nullable(),
  cy: z.number().nullable(),
  r: z.number().nullable(),
  text: z.string().nullable(),
  label: z.string().nullable(),
  fontSize: z.number().nullable(),
  points: z.array(SvgPointSchema),
  fill: z.string().nullable(),
  strokeDasharray: z.string().nullable()
});

export const DiagramSpecSchema = z.object({
  required: z.boolean(),
  type: z.enum(["none", "coordinate_plane", "geometry", "graph", "table", "solid", "number_line"]),
  canvas: z.object({ width: z.number(), height: z.number() }),
  elements: z.array(DiagramElementSchema)
});

export const ProblemAnalysisSchema = z.object({
  source_problem: z.object({ text: z.string(), image_exists: z.boolean(), image_description: z.string() }),
  classification: z.object({
    school_level: z.enum(["elementary", "middle", "high", "unknown"]),
    grade: z.number(),
    curriculum_year: z.enum(["2015", "2022", "unknown"]),
    domain: z.string(),
    unit: z.string(),
    achievement_standard: z.string(),
    difficulty: z.number(),
    problem_type: z.enum(["calculation", "word_problem", "multiple_choice", "geometry", "graph", "proof", "unknown"])
  }),
  math_structure: z.object({
    core_concept: z.string(),
    solution_pattern: z.array(z.string()),
    required_formulas: z.array(z.string()),
    givens: z.array(z.string()),
    unknowns: z.array(z.string()),
    constraints: z.array(z.string())
  }),
  variant_policy: z.object({ keep: z.array(z.string()), change: z.array(z.string()), avoid: z.array(z.string()) }),
  diagram_spec: DiagramSpecSchema
});

export const GeneratedProblemSchema = z.object({
  new_problem: z.object({
    question: z.string(),
    choices: z.array(z.string()),
    answer: z.string(),
    explanation: z.string(),
    short_solution: z.string(),
    difficulty: z.number(),
    curriculum: z.object({ school_level: z.string(), grade: z.string(), domain: z.string(), unit: z.string(), achievement_standard: z.string() })
  }),
  diagram_spec: DiagramSpecSchema,
  similarity_check: z.object({
    same_concept: z.boolean(),
    surface_similarity_risk: z.enum(["low", "medium", "high"]),
    changed_elements: z.array(z.string())
  })
});

export const VerificationSchema = z.object({
  is_valid: z.boolean(),
  detected_errors: z.array(z.string()),
  independent_answer: z.string(),
  answer_matches: z.boolean(),
  fix_required: z.boolean(),
  fix_instructions: z.string()
});

export type DiagramSpec = z.infer<typeof DiagramSpecSchema>;
export type ProblemAnalysis = z.infer<typeof ProblemAnalysisSchema>;
export type GeneratedProblem = z.infer<typeof GeneratedProblemSchema>;
export type Verification = z.infer<typeof VerificationSchema>;
