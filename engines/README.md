# Deterministic Math Engines

이 폴더는 LLM이 수학적 사실을 직접 만들지 않도록 하는 결정론 엔진을 담습니다.

## quad_gen.py

이차함수의 일반형을 제시하고 꼭짓점과 축을 구하는 유사문항을 생성합니다.

```bash
pip install -r requirements.txt
python engines/quad_gen.py
```

출력:

- 문제 JSON
- SVG 그래프
