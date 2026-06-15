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

type OcrState = {
  running: boolean;
  progress: number;
  status: string;
};

const OCR_PAGE_LIMIT = 3;

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

function normalizeOcrText(text: string) {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[|]/g, "")
    .trim();
}

function isImageOrPdf(file: File | null) {
  if (!file) return false;
  const name = file.name.toLowerCase();
  return file.type.startsWith("image/") || file.type === "application/pdf" || /\.(png|jpe?g|webp|pdf)$/.test(name);
}

function isOfficeFile(file: File | null) {
  if (!file) return false;
  return /\.(hwpx|hwp)$/i.test(file.name);
}

function isActionableText(text: string) {
  const compact = text.replace(/\s/g, "");
  return compact.length >= 8 && /구하|계산|넓이|둘레|부피|정답|값|방정식|그래프|함수|분수|소수|확률|평균|각도|길이|비율|비례|몇/.test(compact);
}

function statusFromTesseract(status: string) {
  const map: Record<string, string> = {
    "loading tesseract core": "OCR 엔진 로딩",
    "initializing tesseract": "OCR 엔진 초기화",
    "loading language traineddata": "한국어/영어 인식 데이터 로딩",
    "initializing api": "OCR API 준비",
    "recognizing text": "문제 텍스트 인식 중"
  };
  return map[status] ?? status;
}

async function renderPdfPageToCanvas(file: File, pageNumber: number) {
  const pdfjsLib: any = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 2.2 });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("PDF 페이지를 렌더링할 수 없습니다.");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  await page.render({ canvasContext: context, viewport }).promise;
  return { canvas, totalPages: pdf.numPages };
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
  const [ocrState, setOcrState] = useState<OcrState>({ running: false, progress: 0, status: "대기" });

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
    setProblemText("");
    setConfirmedText("");
    setOcrState({ running: false, progress: 0, status: "대기" });
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

  async function recognizeSource(source: File | HTMLCanvasElement, label: string) {
    const tesseract: any = await import("tesseract.js");
    const worker = await tesseract.createWorker("kor+eng", 1, {
      logger: (message: any) => {
        const progress = typeof message.progress === "number" ? message.progress : 0;
        setOcrState({
          running: true,
          progress: Math.round(progress * 100),
          status: `${label}: ${statusFromTesseract(message.status ?? "처리 중")}`
        });
      }
    });

    try {
      const { data } = await worker.recognize(source);
      return normalizeOcrText(data?.text ?? "");
    } finally {
      await worker.terminate();
    }
  }

  async function runFreeOcr() {
    if (!file || !preview || !isImageOrPdf(file)) {
      setResult({ success: false, stage: "extracted", message: "무료 OCR은 JPG/PNG/WEBP/PDF 파일에서만 실행할 수 있습니다." });
      return;
    }

    setResult(null);
    setOcrState({ running: true, progress: 0, status: "무료 OCR 준비 중" });

    try {
      let extracted = "";

      if (preview.kind === "image") {
        extracted = await recognizeSource(file, "이미지 OCR");
      }

      if (preview.kind === "pdf") {
        const first = await renderPdfPageToCanvas(file, 1);
        const pagesToRead = Math.min(first.totalPages, OCR_PAGE_LIMIT);
        const pageTexts: string[] = [];
        pageTexts.push(await recognizeSource(first.canvas, `PDF 1/${pagesToRead}`));

        for (let pageNumber = 2; pageNumber <= pagesToRead; pageNumber++) {
          const rendered = await renderPdfPageToCanvas(file, pageNumber);
          pageTexts.push(await recognizeSource(rendered.canvas, `PDF ${pageNumber}/${pagesToRead}`));
        }

        extracted = normalizeOcrText(pageTexts.filter(Boolean).join("\n\n"));
      }

      setOcrState({ running: false, progress: 100, status: "무료 OCR 완료" });

      if (!extracted) {
        setResult({
          success: false,
          stage: "extracted",
          message: "OCR 결과가 비어 있습니다. 스캔 품질이 낮거나 글자가 너무 작습니다. 보이는 문제를 직접 입력해 주세요.",
          extractedText: ""
        });
        return;
      }

      setProblemText(extracted);
      setConfirmedText(extracted);
      setResult({
        success: isActionableText(extracted),
        mode: "local",
        stage: "extracted",
        message: isActionableText(extracted)
          ? "무료 OCR 결과가 준비되었습니다. 원본과 비교해 수정한 뒤 2단계를 실행하세요."
          : "OCR은 끝났지만 문제 문장으로 부족합니다. 원본을 보며 텍스트를 수정해야 합니다.",
        extractedText: extracted,
        extractionWarning: "무료 OCR은 인식 오류가 있을 수 있습니다. 반드시 원본과 비교해 수정하세요."
      });
    } catch (error) {
      setOcrState({ running: false, progress: 0, status: "무료 OCR 실패" });
      setResult({ success: false, stage: "extracted", message: error instanceof Error ? error.message : "무료 OCR 실행 실패" });
    }
  }

  async function extractAndConfirm() {
    setExtracting(true);
    setResult(null);

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
      setResult({ success: false, stage: "generated", message: "확정된 문제 텍스트가 없습니다." });
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
  const busy = extracting || generating || ocrState.running;
  const canExtract = Boolean(file || problemText.trim());
  const canRunOcr = Boolean(file && preview && isImageOrPdf(file));
  const canGenerate = isActionableText(confirmedText);
  const needManualCheck = Boolean(confirmedText) && !canGenerate;

  const statusLabel = useMemo(() => {
    if (ocrState.running) return `${ocrState.status} (${ocrState.progress}%)`;
    if (!file && !problemText.trim()) return "대기: 파일 업로드 또는 문제 텍스트 입력 필요";
    if (confirmedText && canGenerate) return "준비됨: 확정 텍스트로 생성 가능";
    if (confirmedText && !canGenerate) return "보류: 확정 텍스트가 문제 문장으로 부족함";
    if (file && isImageOrPdf(file)) return "무료 OCR 실행 후 인식 결과를 수정·확정하세요";
    return "1단계 인식 결과 확인 필요";
  }, [file, problemText, confirmedText, canGenerate, ocrState]);

  return (
    <main>
      <div className="version-banner">
        무료 실사용 모드 · 브라우저 OCR + 사용자 확정 + 지원 유형만 로컬 생성
      </div>

      <h1>수학 유사문항 생성 MVP</h1>
      <p>
        OpenAI 결제 없이 쓰는 모드입니다. 이미지/PDF는 브라우저에서 무료 OCR을 실행하고, 사용자가 인식 결과를 수정·확정한 뒤 로컬 규칙 엔진으로 문항을 생성합니다.
      </p>

      <div className="step-panel">
        <span className="badge">1 원본 업로드</span>
        <span className="badge">2 무료 OCR/문서 추출</span>
        <span className="badge">3 문제 텍스트 수정·확정</span>
        <span className="badge">4 지원 유형만 생성</span>
      </div>

      <div className="status-panel">
        <strong>현재 상태</strong>
        <p>{statusLabel}</p>
        {ocrState.running && <progress value={ocrState.progress} max={100} className="ocr-progress" />}
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
            JPG/PNG/WEBP/PDF는 무료 OCR을 실행할 수 있습니다. PDF는 MVP 기준 앞 {OCR_PAGE_LIMIT}쪽까지만 OCR합니다. HWPX/HWP는 서버에서 텍스트 추출을 시도합니다.
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
                  <p>HWPX/HWP는 1단계 버튼으로 텍스트 추출을 실행합니다. 추출이 불완전하면 아래 텍스트를 직접 보정하세요.</p>
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

          {canRunOcr && (
            <button onClick={runFreeOcr} disabled={busy}>
              {ocrState.running ? "무료 OCR 실행 중..." : "무료 OCR 실행해서 문제 텍스트 추출"}
            </button>
          )}

          <label>문제 텍스트 입력/보정</label>
          <textarea
            value={problemText}
            onChange={(e) => {
              setProblemText(e.target.value);
              if (!confirmedText) setConfirmedText(e.target.value);
            }}
            placeholder="예: 한 변의 길이가 6cm인 정사각형의 넓이를 구하시오."
          />

          <label>도형/그래프 보충 설명</label>
          <textarea
            value={imageContext}
            onChange={(e) => setImageContext(e.target.value)}
            placeholder="예: 좌표평면에 아래로 열린 포물선이 있고, 꼭짓점은 원점 O로 보임"
            style={{ minHeight: 120 }}
          />

          <button onClick={extractAndConfirm} disabled={busy || !canExtract}>
            {extracting ? "인식 결과 준비 중..." : isOfficeFile(file) ? "1단계: HWPX/HWP 텍스트 추출" : "1단계: 입력 텍스트 확정"}
          </button>
        </section>

        <section className="card">
          <h2>인식 결과 및 생성 실행</h2>
          {!result && <p>왼쪽에서 원본을 확인하고 OCR 또는 텍스트 입력을 진행하세요.</p>}
          {result?.message && <p className={result.success ? "ok" : "error"}>{result.message}</p>}
          {result?.mode && <p className="badge">실행 모드: {result.mode === "local" ? "무료 로컬 모드" : "API 모드"}</p>}
          {result?.extractionWarning && <p className="hint">주의: {result.extractionWarning}</p>}

          {(result?.stage === "extracted" || confirmedText) && !generated && (
            <div className="result-section">
              <h3>확정할 문제 텍스트</h3>
              <p className="hint">이 칸의 텍스트가 최종 생성 기준입니다. OCR 오타, 수식, 단위, 숫자를 반드시 원본과 대조해 고치세요.</p>
              <textarea
                value={confirmedText}
                onChange={(e) => setConfirmedText(e.target.value)}
                className="confirmed-textarea"
                placeholder="생성할 문제 문장을 여기에 확정하세요."
              />
              {needManualCheck && <p className="error">문제 문장으로 보기 어렵습니다. “구하시오”, “계산하시오”, “넓이”, “방정식” 등 조건과 물음을 명확히 입력하세요.</p>}
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
                <span className="badge">{generated.curriculum.unit}</span>
                <span className="badge">난이도 {generated.difficulty}</span>
              </div>

              <div className="result-section">
                <h3>문제</h3>
                <p>{generated.question}</p>
              </div>

              <div className="result-section">
                <h3>정답</h3>
                <p className="ok">{generated.answer}</p>
              </div>

              <div className="result-section">
                <h3>해설</h3>
                <pre>{generated.explanation}</pre>
              </div>

              {result.diagramSvg && (
                <div className="result-section diagram">
                  <h3>도형/그래프</h3>
                  <div dangerouslySetInnerHTML={{ __html: result.diagramSvg }} />
                </div>
              )}

              <div className="result-section">
                <h3>검수</h3>
                <pre>{JSON.stringify(result.verification, null, 2)}</pre>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
