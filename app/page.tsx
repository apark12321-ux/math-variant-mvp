"use client";

import { useState } from "react";

type ApiResult = {
  success: boolean;
  mode?: "local" | "api";
  message?: string;
  extractedText?: string;
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
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);

  async function submit() {
    setLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("problemText", problemText);
      formData.append("imageContext", imageContext);
      formData.append("maxAttempts", "3");
      if (file) formData.append("file", file);

      const res = await fetch("/api/generate", {
        method: "POST",
        body: formData
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
      <div className="version-banner">
        무료 로컬 모드 기본 적용 · 결제 없이 텍스트/HWPX/HWP 추출 문항 생성 가능
      </div>

      <h1>수학 유사문항 생성 MVP</h1>
      <p>문제 텍스트, HWPX, HWP 파일은 무료 로컬 규칙 기반으로 생성합니다. 이미지 캡처, 스캔 이미지, PDF OCR은 정확한 인식을 위해 별도 API 모드가 필요할 수 있습니다.</p>

      <div className="grid">
        <section className="card">
          <label>문제 파일 업로드</label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf,.png,.jpg,.jpeg,.webp,.pdf,.hwpx,.hwp"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <p className="hint">무료 모드 권장: 텍스트 직접 입력, HWPX, HWP. 이미지/PDF 스캔본은 텍스트를 함께 입력하면 처리 가능합니다. MVP 기준 10MB 이하.</p>
          {file && <p className="ok">선택됨: {file.name} / {(file.size / 1024 / 1024).toFixed(2)}MB</p>}

          <label>입력 문제 텍스트</label>
          <textarea
            value={problemText}
            onChange={(e) => setProblemText(e.target.value)}
            placeholder="무료 모드에서는 이 칸의 텍스트가 가장 중요합니다. 파일 인식이 부족하면 문제를 직접 붙여넣어 주세요."
          />

          <label>도형/이미지 보충 설명</label>
          <textarea
            value={imageContext}
            onChange={(e) => setImageContext(e.target.value)}
            placeholder="예: 좌표평면 위 점 A(1, 2), B(5, 2), C(5, 6)이 표시되어 있음"
            style={{ minHeight: 120 }}
          />

          <button onClick={submit} disabled={loading}>{loading ? "처리 중..." : "문항 생성"}</button>
        </section>

        <section className="card">
          <h2>생성 결과</h2>
          {!result && <p>문제 텍스트를 입력하거나 파일을 업로드한 뒤 생성 버튼을 누르세요.</p>}
          {result?.message && <p className={result.success ? "ok" : "error"}>{result.message}</p>}
          {result?.mode && <p className="badge">실행 모드: {result.mode === "local" ? "무료 로컬 모드" : "API 모드"}</p>}

          {result?.extractedText && (
            <div className="result-section">
              <h3>파일 인식 결과</h3>
              <pre>{result.extractedText}</pre>
            </div>
          )}

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
