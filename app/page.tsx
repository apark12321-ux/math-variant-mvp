"use client";

import { useEffect, useState } from "react";

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

type FilePreview = {
  url: string;
  kind: "image" | "pdf" | "document" | "unknown";
};

const sample = `한 변의 길이가 6cm인 정사각형의 넓이를 구하시오.`;

function getFileKind(file: File): FilePreview["kind"] {
  const name = file.name.toLowerCase();
  if (file.type.startsWith("image/") || /\.(png|jpe?g|webp)$/.test(name)) return "image";
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (/\.(hwpx|hwp)$/.test(name)) return "document";
  return "unknown";
}

function formatBytes(size: number) {
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
  return `${(size / 1024 / 1024).toFixed(2)}MB`;
}

export default function Home() {
  const [problemText, setProblemText] = useState(sample);
  const [imageContext, setImageContext] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreview({ url, kind: getFileKind(file) });

    return () => URL.revokeObjectURL(url);
  }, [file]);

  function onFileChange(selected: File | null) {
    setFile(selected);
    setResult(null);
  }

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
        무료 로컬 모드 기본 적용 · 파일 업로드 즉시 미리보기 · JPG/PNG/WEBP/PDF/HWPX/HWP 지원
      </div>

      <h1>수학 유사문항 생성 MVP</h1>
      <p>파일을 업로드하면 먼저 화면에서 원본을 확인한 뒤 문항 생성을 실행합니다. 이미지와 PDF는 미리보기로 확인하고, HWPX/HWP는 파일 정보와 생성 후 추출 텍스트를 확인합니다.</p>

      <div className="grid">
        <section className="card">
          <label>문제 파일 업로드</label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf,.png,.jpg,.jpeg,.webp,.pdf,.hwpx,.hwp"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          />
          <p className="hint">무료 모드 권장: 텍스트 직접 입력, HWPX, HWP. 이미지/PDF 스캔본은 텍스트를 함께 입력하면 처리 정확도가 높아집니다. MVP 기준 10MB 이하.</p>

          {file && preview && (
            <div className="result-section upload-preview">
              <div className="preview-header">
                <div>
                  <h3>업로드 원본 미리보기</h3>
                  <p className="file-meta">{file.name} · {formatBytes(file.size)} · {file.type || "확장자 기반 파일"}</p>
                </div>
                <button className="small-button" type="button" onClick={() => onFileChange(null)}>파일 제거</button>
              </div>

              {preview.kind === "image" && (
                <img src={preview.url} alt="업로드한 문제 이미지 미리보기" className="preview-image" />
              )}

              {preview.kind === "pdf" && (
                <iframe src={preview.url} title="업로드한 PDF 미리보기" className="preview-frame" />
              )}

              {preview.kind === "document" && (
                <div className="document-preview">
                  <strong>문서 파일이 선택되었습니다.</strong>
                  <p>HWPX/HWP는 브라우저에서 원본 화면을 직접 렌더링하기 어렵습니다. 생성 버튼을 누르면 서버가 문서 텍스트를 추출하고, 오른쪽 결과 영역의 “파일 인식 결과”에 먼저 보여줍니다.</p>
                </div>
              )}

              {preview.kind === "unknown" && (
                <div className="document-preview">
                  <strong>미리보기를 지원하지 않는 파일입니다.</strong>
                  <p>지원 형식은 JPG, PNG, WEBP, PDF, HWPX, HWP입니다.</p>
                </div>
              )}
            </div>
          )}

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
          {!result && <p>문제 파일을 업로드하면 왼쪽에서 원본을 먼저 확인할 수 있습니다. 확인 후 문항 생성 버튼을 누르세요.</p>}
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
