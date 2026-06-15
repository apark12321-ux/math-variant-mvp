"use client";

import { useEffect, useMemo, useState } from "react";

type ApiResult = {
  success: boolean;
  mode?: "local" | "api";
  stage?: "extracted" | "generated";
  message?: string;
  extractedText?: string;
  extractionWarning?: string;
  analysis?: any;
  generated?: any | null;
  verification?: any;
  diagramSvg?: string | null;
  attempts?: any[];
};

type FilePreview = {
  url: string;
  kind: "image" | "pdf" | "document" | "unknown";
};

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

function isScannedLikeFile(file: File | null) {
  if (!file) return false;
  const name = file.name.toLowerCase();
  return file.type.startsWith("image/") || file.type === "application/pdf" || /\.(png|jpe?g|webp|pdf)$/.test(name);
}

function isActionableText(text: string) {
  const compact = text.replace(/\s/g, "");
  return compact.length >= 8 && /구하|계산|넓이|둘레|부피|정답|값|방정식|그래프|함수|분수|소수|확률|평균|각도|길이|비율|비례/.test(compact);
}

export default function Home() {
  const [problemText, setProblemText] = useState("");
  const [imageContext, setImageContext] = useState("");
  const [confirmedText, setConfirmedText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [generating, setGenerating] = useState(false);
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
    setConfirmedText("");
  }

  function buildFormData(action: "extract" | "generate", text: string) {
    const formData = new FormData();
    formData.append("action", action);
    formData.append("problemText", text);
    formData.append("imageContext", imageContext);
    formData.append("maxAttempts", "3");
    if (action === "extract" && file) formData.append("file", file);
    return formData;
  }

  async function requestApi(formData: FormData) {
    const res = await fetch("/api/generate", {
      method: "POST",
      body: formData
    });
    const json = (await res.json()) as ApiResult;
    if (!res.ok && !json.message) json.message = "요청 처리에 실패했습니다.";
    return json;
  }

  async function extractAndConfirm() {
    setExtracting(true);
    setResult(null);
    setConfirmedText("");

    try {
      const json = await requestApi(buildFormData("extract", problemText));
      setResult(json);
      setConfirmedText(json.extractedText || problemText || "");
    } catch (err) {
      setResult({ success: false, stage: "extracted", message: err instanceof Error ? err.message : "파일 인식 요청 실패" });
    } finally {
      setExtracting(false);
    }
  }

  async function generateFromConfirmed() {
    const sourceText = confirmedText.trim();
    if (!sourceText) {
      setResult({ success: false, stage: "generated", message: "확정된 문제 텍스트가 없습니다. 원본을 보고 문제 문장을 입력한 뒤 실행하세요." });
      return;
    }

    setGenerating(true);

    try {
      const json = await requestApi(buildFormData("generate", sourceText));
      setResult(json);
    } catch (err) {
      setResult({ success: false, stage: "generated", message: err instanceof Error ? err.message : "문항 생성 요청 실패" });
    } finally {
      setGenerating(false);
    }
  }

  const generated = result?.generated?.new_problem;
  const busy = extracting || generating;
  const scannedNeedsManualText = isScannedLikeFile(file) && !problemText.trim();
  const canExtract = Boolean(file || problemText.trim());
  const canGenerate = isActionableText(confirmedText);
  const statusLabel = useMemo(() => {
    if (!file && !problemText.trim()) return "대기: 파일 업로드 또는 문제 텍스트 입력 필요";
    if (scannedNeedsManualText) return "주의: 무료 모드에서는 스캔/PDF OCR 불가. 문제 텍스트 직접 입력 필요";
    if (confirmedText && canGenerate) return "준비됨: 확정 텍스트로 생성 가능";
    if (confirmedText && !canGenerate) return "보류: 확정 텍스트가 문제 문장으로 부족함";
    return "1단계 인식 결과 확인 필요";
  }, [file, problemText, scannedNeedsManualText, confirmedText, canGenerate]);

  return (
    <main>
      <div className="version-banner">
        실사용 보정 버전 · 무료 모드는 OCR 없이 사용자가 확정한 텍스트만 생성 · 미지원 유형은 생성 차단
      </div>

      <h1>수학 유사문항 생성 MVP</h1>
      <p>파일 원본을 먼저 확인하고, 실제 문제 문장을 사용자가 확정한 뒤에만 유사문항을 생성합니다.</p>

      <div className="step-panel">
        <span className="badge">1 원본 업로드</span>
        <span className="badge">2 원본 확인</span>
        <span className="badge">3 문제 텍스트 확정</span>
        <span className="badge">4 지원 유형만 생성</span>
      </div>

      <div className="status-panel">
        <strong>현재 상태</strong>
        <p>{statusLabel}</p>
      </div>

      <div className="grid">
        <section className="card">
          <label>문제 파일 업로드</label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf,.png,.jpg,.jpeg,.webp,.pdf,.hwpx,.hwp"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          />
          <p className="hint">
            JPG/PNG/WEBP/PDF는 원본 미리보기용입니다. 결제 없는 무료 모드에서는 스캔 OCR을 하지 않으므로, 보이는 문제를 아래 텍스트 칸에 직접 입력해야 합니다. HWPX/HWP는 텍스트 추출을 시도합니다.
          </p>

          {file && preview && (
            <div className="result-section upload-preview">
              <div className="preview-header">
                <div>
                  <h3>업로드 원본 미리보기</h3>
                  <p className="file-meta">{file.name} · {formatBytes(file.size)} · {file.type || "확장자 기반 파일"}</p>
                </div>
                <button className="small-button" type="button" onClick={() => onFileChange(null)}>파일 제거</button>
              </div>

              {preview.kind === "image" && <img src={preview.url} alt="업로드한 문제 이미지 미리보기" className="preview-image" />}
              {preview.kind === "pdf" && <iframe src={preview.url} title="업로드한 PDF 미리보기" className="preview-frame" />}
              {preview.kind === "document" && (
                <div className="document-preview">
                  <strong>문서 파일이 선택되었습니다.</strong>
                  <p>HWPX/HWP는 텍스트 추출 결과를 확인합니다. 추출이 불완전하면 아래 텍스트를 직접 보정하세요.</p>
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

          <label>원본을 보고 문제 텍스트 입력</label>
          <textarea
            value={problemText}
            onChange={(e) => setProblemText(e.target.value)}
            placeholder="예: 한 변의 길이가 6cm인 정사각형의 넓이를 구하시오."
          />

          <label>도형/그래프 보충 설명</label>
          <textarea
            value={imageContext}
            onChange={(e) => setImageContext(e.target.value)}
            placeholder="예: 좌표평면에 아래로 열린 포물선이 있고, 꼭짓점은 원점 O로 보임"
            style={{ minHeight: 120 }}
          />

          {scannedNeedsManualText && (
            <p className="error">무료 모드에서는 이 PDF/이미지를 자동 OCR하지 않습니다. 미리보기를 보고 문제 문장을 직접 입력해야 합니다.</p>
          )}

          <button onClick={extractAndConfirm} disabled={busy || !canExtract}>
            {extracting ? "인식 결과 준비 중..." : "1단계: 인식 결과 확인"}
          </button>
        </section>

        <section className="card">
          <h2>인식 결과 및 생성 실행</h2>
          {!result && <p>왼쪽에서 파일을 확인하고 문제 텍스트를 입력한 뒤 1단계 버튼을 누르세요.</p>}
          {result?.message && <p className={result.success ? "ok" : "error"}>{result.message}</p>}
          {result?.mode && <p className="badge">실행 모드: {result.mode === "local" ? "무료 로컬 모드" : "API 모드"}</p>}
          {result?.extractionWarning && <p className="hint">주의: {result.extractionWarning}</p>}

          {(result?.stage === "extracted" || confirmedText) && !generated && (
            <div className="result-section">
              <h3>확정할 문제 텍스트</h3>
              <p className="hint">이 칸의 텍스트가 최종 생성 기준입니다. 원본 미리보기와 비교해서 반드시 수정하세요.</p>
              <textarea
                value={confirmedText}
                onChange={(e) => setConfirmedText(e.target.value)}
                className="confirmed-textarea"
                placeholder="생성할 문제 문장을 여기에 확정하세요."
              />
              {!canGenerate && confirmedText && <p className="error">문제 문장으로 보기 어렵습니다. “구하시오”, “계산하시오”, “넓이”, “방정식” 등 핵심 조건이 드러나게 수정하세요.</p>}
              <button onClick={generateFromConfirmed} disabled={busy || !canGenerate}>
                {generating ? "문항 생성 중..." : "2단계: 이 텍스트로 유사문항 생성"}
              </button>
            </div>
          )}

          {result?.extractedText && result.stage !== "extracted" && (
            <div className="result-section">
              <h3>사용한 인식/확정 텍스트</h3>
              <pre>{result.extractedText}</pre>
            </div>
          )}

          {result?.verification?.fix_required && !generated && (
            <div className="result-section blocked">
              <h3>생성 보류</h3>
              <p>{result.verification.fix_instructions}</p>
              {result.verification.detected_errors?.length > 0 && (
                <ul>
                  {result.verification.detected_errors.map((item: string) => <li key={item}>{item}</li>)}
                </ul>
              )}
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
              <div className="result-section"><h3>생성 문제</h3><p>{generated.question}</p></div>
              <div className="result-section"><h3>정답</h3><p className="ok">{generated.answer}</p></div>
              <div className="result-section"><h3>해설</h3><p style={{ whiteSpace: "pre-line" }}>{generated.explanation}</p></div>
              {result?.verification && (
                <div className="result-section">
                  <h3>검수 결과</h3>
                  <p>{result.verification.fix_instructions}</p>
                </div>
              )}
              {result?.diagramSvg && (
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
