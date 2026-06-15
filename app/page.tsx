"use client";

import { useState } from "react";

type ApiResult = {
  success: boolean;
  message?: string;
  analysis?: any;
  generated?: any;
  verification?: any;
  diagramSvg?: string | null;
  attempts?: any[];
};

const sample = `한 변의 길이가 6cm인 정사각형의 넓이를 구하시오.`;

export default function Home() {
  const [problemText, setProblemText] = useState(sample);
  const [imageContext, setImageContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);

  async function submit() {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemText, imageContext, maxAttempts: 3 })
      });
      const json = await res.json();
      setResult(json);
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : "요청 실패" });
    } finally {
      setLoading(false);
    }
  }

  const generated = result?.generated?.new_problem;

  return (
    <main>
      <h1>수학 유사문항 생성 MVP</h1>
      <p>초·중·고 수학 문제를 입력하면 교육과정·개념·풀이 구조를 분석하고 새 문항과 해설을 생성합니다.</p>

      <div className="grid">
        <section className="card">
          <label>입력 문제</label>
          <textarea value={problemText} onChange={(e) => setProblemText(e.target.value)} />

          <label>이미지 설명/OCR 선택 입력</label>
          <textarea
            value={imageContext}
            onChange={(e) => setImageContext(e.target.value)}
            placeholder="예: 좌표평면 위 점 A(1, 2), B(5, 2), C(5, 6)이 표시되어 있음"
            style={{ minHeight: 120 }}
          />

          <button onClick={submit} disabled={loading}>{loading ? "생성·검증 중..." : "문항 생성"}</button>
        </section>

        <section className="card">
          <h2>생성 결과</h2>
          {!result && <p>문제를 입력하고 생성 버튼을 누르세요.</p>}
          {result && !result.success && <p className="error">{result.message ?? "생성 실패"}</p>}

          {generated && (
            <>
              <div className="result-section">
                <span className="badge">{generated.curriculum.school_level}</span>
                <span className="badge">{generated.curriculum.grade}학년 추정</span>
                <span className="badge">{generated.curriculum.domain}</span>
                <span className="badge">난이도 {generated.difficulty}</span>
              </div>

              <div className="result-section"><h3>문제</h3><p>{generated.question}</p></div>
              <div className="result-section"><h3>정답</h3><p className="ok">{generated.answer}</p></div>
              <div className="result-section"><h3>해설</h3><p>{generated.explanation}</p></div>

              {result.diagramSvg && (
                <div className="result-section diagram">
                  <h3>SVG 도형</h3>
                  <div dangerouslySetInnerHTML={{ __html: result.diagramSvg }} />
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {result?.analysis && (
        <section className="card" style={{ marginTop: 20 }}>
          <h2>디버그 JSON</h2>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </section>
      )}
    </main>
  );
}
