// Expression 구역: 값에 적용할 식을 eval 없이 해석한다.
// 숫자, 변수 x·y, + - * / ^(오른쪽 결합), 단항 -, 괄호, 함수
// abs log(밑 10) ln sqrt exp round floor ceil min max pow.
// 빈 식은 호출하는 쪽에서 원래 값을 그대로 쓴다. 결과가 유한하지 않으면 NaN이고, 호출하는 쪽에서 뺀다.

type Fn = (x: number, y: number) => number;

export type CompiledExpression =
  | { ok: true; fn: Fn }
  | { ok: false; error: string };

const FUNCTIONS: Record<
  string,
  { arity: number; f: (...a: number[]) => number }
> = {
  abs: { arity: 1, f: Math.abs },
  log: { arity: 1, f: Math.log10 },
  ln: { arity: 1, f: Math.log },
  sqrt: { arity: 1, f: Math.sqrt },
  exp: { arity: 1, f: Math.exp },
  round: { arity: 1, f: Math.round },
  floor: { arity: 1, f: Math.floor },
  ceil: { arity: 1, f: Math.ceil },
  min: { arity: 2, f: Math.min },
  max: { arity: 2, f: Math.max },
  pow: { arity: 2, f: Math.pow },
};

type Token =
  | { t: "num"; v: number; at: number }
  | { t: "id"; v: string; at: number }
  | { t: "op"; v: string; at: number }
  | { t: "end"; at: number };

class ExprError extends Error {}

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9.]/.test(c)) {
      const m = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i));
      if (!m) throw new ExprError(`숫자가 잘못되었습니다 (${i + 1}번째 글자)`);
      tokens.push({ t: "num", v: Number(m[0]), at: i });
      i += m[0].length;
    } else if (/[a-zA-Z_]/.test(c)) {
      const m = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(src.slice(i)) as RegExpExecArray;
      tokens.push({ t: "id", v: m[0].toLowerCase(), at: i });
      i += m[0].length;
    } else if ("+-*/^(),".includes(c)) {
      tokens.push({ t: "op", v: c, at: i });
      i++;
    } else {
      throw new ExprError(`쓸 수 없는 글자 '${c}' (${i + 1}번째 글자)`);
    }
  }
  tokens.push({ t: "end", at: src.length });
  return tokens;
}

/** 재귀 하강 파서. 식을 클로저 트리로 바꾼다. */
function parse(tokens: Token[]): Fn {
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (v: string) => {
    const t = peek();
    return t.t === "op" && t.v === v;
  };
  const expect = (v: string) => {
    if (!isOp(v))
      throw new ExprError(`'${v}'가 필요합니다 (${peek().at + 1}번째 글자)`);
    pos++;
  };

  // expr := term (('+'|'-') term)*
  function expr(): Fn {
    let left = term();
    while (isOp("+") || isOp("-")) {
      const op = (tokens[pos++] as { v: string }).v;
      const l = left;
      const r = term();
      left =
        op === "+" ? (x, y) => l(x, y) + r(x, y) : (x, y) => l(x, y) - r(x, y);
    }
    return left;
  }
  // term := unary (('*'|'/') unary)*
  function term(): Fn {
    let left = unary();
    while (isOp("*") || isOp("/")) {
      const op = (tokens[pos++] as { v: string }).v;
      const l = left;
      const r = unary();
      left =
        op === "*" ? (x, y) => l(x, y) * r(x, y) : (x, y) => l(x, y) / r(x, y);
    }
    return left;
  }
  // unary := '-' unary | power   (-x^2 = -(x^2))
  function unary(): Fn {
    if (isOp("-")) {
      pos++;
      const v = unary();
      return (x, y) => -v(x, y);
    }
    if (isOp("+")) {
      pos++;
      return unary();
    }
    return power();
  }
  // power := primary ('^' unary)?   오른쪽 결합
  function power(): Fn {
    const base = primary();
    if (isOp("^")) {
      pos++;
      const exp = unary();
      return (x, y) => base(x, y) ** exp(x, y);
    }
    return base;
  }
  function primary(): Fn {
    const t = peek();
    if (t.t === "num") {
      pos++;
      const v = t.v;
      return () => v;
    }
    if (t.t === "op" && t.v === "(") {
      pos++;
      const inner = expr();
      expect(")");
      return inner;
    }
    if (t.t === "id") {
      pos++;
      if (t.v === "x") return (x) => x;
      if (t.v === "y") return (_x, y) => y;
      const fn = FUNCTIONS[t.v];
      if (!fn) throw new ExprError(`모르는 이름 '${t.v}'`);
      expect("(");
      const args: Fn[] = [expr()];
      while (isOp(",")) {
        pos++;
        args.push(expr());
      }
      expect(")");
      if (args.length !== fn.arity)
        throw new ExprError(`${t.v}는 인자 ${fn.arity}개가 필요합니다`);
      const f = fn.f;
      if (args.length === 1) {
        const [a] = args;
        return (x, y) => f(a(x, y));
      }
      const [a, b] = args;
      return (x, y) => f(a(x, y), b(x, y));
    }
    if (t.t === "end") throw new ExprError("식이 끝나지 않았습니다");
    throw new ExprError(`'${t.v}'가 올 자리가 아닙니다 (${t.at + 1}번째 글자)`);
  }

  const root = expr();
  const rest = peek();
  if (rest.t !== "end")
    throw new ExprError(
      `식 뒤에 남은 글자가 있습니다 (${rest.at + 1}번째 글자)`,
    );
  return root;
}

/** 식을 함수로 바꾼다. 빈 식은 오류다 (호출하는 쪽에서 원래 값을 쓴다). */
export function compileExpression(src: string): CompiledExpression {
  if (src.trim() === "") return { ok: false, error: "식이 비어 있습니다" };
  try {
    const root = parse(tokenize(src));
    return {
      ok: true,
      fn: (x, y) => {
        const v = root(x, y);
        return Number.isFinite(v) ? v : Number.NaN;
      },
    };
  } catch (err) {
    if (err instanceof ExprError) return { ok: false, error: err.message };
    throw err;
  }
}
