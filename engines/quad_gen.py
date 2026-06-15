"""
이차함수 유사문항 생성기 (코어 한 벌)
==================================================
핵심 원칙: 수학적 사실은 LLM이 만들지 않는다.
  1) 파라미터를 제약 안에서 샘플링
  2) 정답은 SymPy가 결정론적으로 계산
  3) 문제 텍스트 / 그림 좌표 / 정답이 모두 같은 파라미터 dict에서 파생
  4) 출력은 문제 JSON + SVG
"""

import json
import random
import sympy as sp

x = sp.Symbol("x")


# ---------------------------------------------------------------------------
# 1) 파라미터 샘플링  (제약된 난수)
# ---------------------------------------------------------------------------
def sample_params(seed=None):
    rng = random.Random(seed)
    a = rng.choice([-2, -1, 1, 2])
    p = rng.randint(-4, 4)
    q = rng.randint(-4, 4)
    return {"a": a, "p": p, "q": q}


# ---------------------------------------------------------------------------
# 2) 정답을 SymPy로 계산
# ---------------------------------------------------------------------------
def solve(params):
    a, p, q = params["a"], params["p"], params["q"]

    f_vertex = a * (x - p) ** 2 + q
    f_general = sp.expand(f_vertex)

    poly = sp.Poly(f_general, x)
    A, B, C = poly.all_coeffs()
    vertex_x = sp.nsimplify(-B / (2 * A))
    vertex_y = sp.simplify(f_general.subs(x, vertex_x))

    assert (vertex_x, vertex_y) == (p, q), "정답 도출 불일치 — 생성 폐기"

    return {
        "general_form": f_general,
        "A": A,
        "B": B,
        "C": C,
        "vertex": (int(vertex_x), int(vertex_y)),
        "axis": int(vertex_x),
    }


# ---------------------------------------------------------------------------
# 3) 문제 텍스트 / 해설
# ---------------------------------------------------------------------------
def to_latex(expr):
    s = sp.latex(expr)
    return s.replace("1.0", "1")


def vertex_form_latex(a, p, q):
    coef = "" if a == 1 else ("-" if a == -1 else str(a))
    if p == 0:
        inner = "x"
    elif p > 0:
        inner = f"(x - {p})"
    else:
        inner = f"(x + {abs(p)})"
    body = f"{coef}{inner}^2"
    if q > 0:
        return f"{body} + {q}"
    if q < 0:
        return f"{body} - {abs(q)}"
    return body


def build_problem(params, sol):
    a, p, q = params["a"], params["p"], params["q"]
    gen = to_latex(sol["general_form"])
    vx, vy = sol["vertex"]
    vform = vertex_form_latex(a, p, q)

    question = (
        f"이차함수 $y = {gen}$ 의 그래프에 대하여, "
        f"꼭짓점의 좌표와 축의 방정식을 각각 구하시오."
    )

    explanation = (
        f"주어진 식을 완전제곱식으로 변형하면 $y = {vform}$ 이다. "
        f"따라서 꼭짓점의 좌표는 $({vx},\\ {vy})$, "
        f"축의 방정식은 $x = {sol['axis']}$ 이다."
    )

    answer = f"꼭짓점 ({vx}, {vy}), 축의 방정식 x = {sol['axis']}"

    return {
        "question": question,
        "answer": answer,
        "explanation": explanation,
        "short_solution": f"y = {a}(x-({p}))^2+({q}) → 꼭짓점 ({vx},{vy}), x={sol['axis']}",
        "curriculum": {
            "school_level": "high",
            "grade": "1",
            "domain": "대수",
            "unit": "이차함수의 그래프",
            "achievement_standard": "[10공수2-01] 이차함수의 그래프의 꼭짓점과 축을 이해한다",
        },
        "difficulty": 2,
    }


# ---------------------------------------------------------------------------
# 4) 그림 — 같은 params에서 SVG 좌표를 도출
# ---------------------------------------------------------------------------
def render_svg(params, sol):
    a, p, q = params["a"], params["p"], params["q"]
    W, H = 460, 460
    PAD = 30

    xs = [0, p - 3, p + 3]
    x_lo, x_hi = min(xs), max(xs)
    sample_x = [x_lo + i * (x_hi - x_lo) / 40 for i in range(41)]
    ys_curve = [a * (xx - p) ** 2 + q for xx in sample_x]
    y_lo = min(ys_curve + [0, q])
    y_hi = max(ys_curve + [0, q])
    xr = (x_hi - x_lo) or 1
    yr = (y_hi - y_lo) or 1
    x_lo -= 0.6
    x_hi += 0.6
    y_lo -= 0.6 * (yr / xr if yr else 1)
    y_hi += 0.6

    def sx(mx):
        return PAD + (mx - x_lo) / (x_hi - x_lo) * (W - 2 * PAD)

    def sy(my):
        return H - PAD - (my - y_lo) / (y_hi - y_lo) * (H - 2 * PAD)

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
        f'viewBox="0 0 {W} {H}" font-family="Georgia, serif">'
    ]
    parts.append(f'<rect width="{W}" height="{H}" fill="#ffffff"/>')

    import math

    for gx in range(math.ceil(x_lo), math.floor(x_hi) + 1):
        parts.append(
            f'<line x1="{sx(gx):.1f}" y1="{PAD}" x2="{sx(gx):.1f}" y2="{H-PAD}" '
            f'stroke="#eee" stroke-width="1"/>'
        )
    for gy in range(math.ceil(y_lo), math.floor(y_hi) + 1):
        parts.append(
            f'<line x1="{PAD}" y1="{sy(gy):.1f}" x2="{W-PAD}" y2="{sy(gy):.1f}" '
            f'stroke="#eee" stroke-width="1"/>'
        )

    parts.append(f'<line x1="{PAD}" y1="{sy(0):.1f}" x2="{W-PAD}" y2="{sy(0):.1f}" stroke="#333" stroke-width="1.5"/>')
    parts.append(f'<line x1="{sx(0):.1f}" y1="{PAD}" x2="{sx(0):.1f}" y2="{H-PAD}" stroke="#333" stroke-width="1.5"/>')
    parts.append(f'<text x="{W-PAD+4}" y="{sy(0)+4:.1f}" font-size="14" font-style="italic">x</text>')
    parts.append(f'<text x="{sx(0)+6:.1f}" y="{PAD-6}" font-size="14" font-style="italic">y</text>')
    parts.append(f'<text x="{sx(0)-12:.1f}" y="{sy(0)+15:.1f}" font-size="13">O</text>')

    parts.append(f'<line x1="{sx(p):.1f}" y1="{PAD}" x2="{sx(p):.1f}" y2="{H-PAD}" stroke="#c0392b" stroke-width="1.2" stroke-dasharray="5 4"/>')

    pts = " ".join(
        f"{sx(xx):.1f},{sy(yy):.1f}"
        for xx, yy in zip(sample_x, ys_curve)
        if PAD - 5 <= sy(yy) <= H - PAD + 5
    )
    parts.append(f'<polyline points="{pts}" fill="none" stroke="#1f4e79" stroke-width="2.5"/>')
    parts.append(f'<circle cx="{sx(p):.1f}" cy="{sy(q):.1f}" r="4" fill="#1f4e79"/>')
    parts.append(f'<text x="{sx(p)+9:.1f}" y="{sy(q)-8:.1f}" font-size="14">({p}, {q})</text>')
    parts.append("</svg>")
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# 파이프라인
# ---------------------------------------------------------------------------
def generate(seed=None):
    params = sample_params(seed)
    sol = solve(params)
    prob = build_problem(params, sol)
    svg = render_svg(params, sol)
    return params, prob, svg


if __name__ == "__main__":
    params, prob, svg = generate(seed=7)
    print("PARAMS:", params)
    print("\nPROBLEM JSON:")
    print(json.dumps(prob, ensure_ascii=False, indent=2))
    with open("sample.svg", "w", encoding="utf-8") as f:
        f.write(svg)
    print("\nSVG written.")
