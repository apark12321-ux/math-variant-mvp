# 수학 유사문항 생성 MVP

대한민국 초등학교·중학교·고등학교 수학 문제를 입력받아 다음을 수행하는 스타터 프로젝트입니다.

1. 입력 문제 분석
2. 교육과정/개념/난이도 추정
3. 원문과 표면 유사도가 낮은 변형문항 생성
4. 정답과 학생용 해설 생성
5. 독립 검증
6. 필요 시 SVG 도형 렌더링

## 실행 방법

```bash
cp .env.example .env.local
# .env.local에 OPENAI_API_KEY 입력
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속.

## 환경 변수

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.5
```

## 현재 MVP 범위

- 텍스트 문제 입력
- 이미지 파일 업로드는 아직 미구현
- 이미지가 필요한 경우 사용자가 이미지 설명/OCR을 입력하면 diagram_spec과 SVG 렌더링 시도
- 분석/생성/검증은 OpenAI Structured Outputs 기반

## 다음 개발 과제

1. 이미지 업로드 + 비전 분석 추가
2. 교육과정 DB 확장
3. 좌표평면/그래프 전용 SVG 렌더러 고도화
4. Sympy 또는 mathjs 기반 수식 검산 추가
5. 문제지 PDF/PNG 출력
6. 관리자 검수 화면 추가

## Deterministic engine

`engines/quad_gen.py`는 이차함수 유사문항 생성용 결정론 엔진입니다.

핵심 원칙은 다음과 같습니다.

1. 파라미터를 제약 안에서 샘플링합니다.
2. 정답은 SymPy로 계산합니다.
3. 문제 텍스트, 정답, 해설, SVG가 같은 파라미터에서 파생됩니다.
4. LLM은 문항 포장과 표현 개선에만 사용하고, 수학적 사실은 계산 엔진이 담당합니다.

```bash
pip install -r requirements.txt
python engines/quad_gen.py
```
