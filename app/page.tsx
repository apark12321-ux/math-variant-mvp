"use client";

import { useState } from "react";

type ApiResult = {
  success: boolean;
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
        파일 업로드 입력 지원 버전 · JPG/PNG/WEBP/PDF/HWPX/HWP 인식 가능
      </div>

      <h1>수학 유사문항 생성 MVP</h1>
      <p>문제 텍스트, 이미지 캡처, 스캔 이미지, PDF, HWPX, HWP 파일을 입력하면 OCR·문서 인식 후 새 문항과 해설을 생성합니다.</p>

      <div className="grid">
        <section className="card">
          <label>문제 파일 업로드</label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf,.png,.jpg,.jpeg,.webp,.pdf,.hwpx,.hwp"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <p className="hint">지원: JPG, PNG, WEBP, PDF, HWPX, HWP. HWP는 제한적 추출이므로 가능하면 HWPX/PDF/이미지를 권장합니다. MVP 기준 10MB 이하.</p>
          {file && <p className="ok">선택됨: {file.name} / {(file.size / 1024 / 1024).toFixed(2)}MB</p>}

          <label>입력 문제 텍스트</label>
          <textarea
            value={problemText}
            onChange={(e) => setProblemText(e.target.value)}
            placeholder="파일만 업로드해도 됩니다. 텍스트를 함께 입력하면 보정 정보로 사용됩니다."
          />

          <label>도형/이미지 보충 설명</label>
          <textarea
            value={imageContext}
            onChange={(e) => setImageContext(e.target.value)}
            placeholder="예: 좌표평면 위 점 A(1, 2), B(5, 2), C(5, 6)이 표시되어 있음"
            style={{ minHeight: 120 }}
          />

          <button onClick={submit} disabled={loading}>{loading ? "파일 인식·생성·검증 중..." : "문항 생성"}</button>
        </section>

        <section className="card">
          <h2>생성 결과</h2>
          {!result && <p>문제 텍스트를 입력하거나 파일을 업로드한 뒤 생성 버튼을 누르세요.</p>}
          {result && !result.success && <p className="error">{result.message ?? "생성 실패"}</p>}

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
