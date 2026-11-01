/**
 * Nelder–Mead simplex minimiser (PF-T6). Pure and deterministic (no random restart): same start → same
 * answer. Standard coefficients (reflect 1, expand 2, contract ½, shrink ½).
 */
export interface NelderMeadResult {
  x: number[];
  fx: number;
  evals: number;
}

export function nelderMead(
  f: (x: number[]) => number,
  x0: number[],
  steps: number[],
  { maxEvals = 150, tol = 1e-3 }: { maxEvals?: number; tol?: number } = {}
): NelderMeadResult {
  const n = x0.length;
  let evals = 0;
  const value = (x: number[]) => {
    evals++;
    const v = f(x);
    return Number.isFinite(v) ? v : Infinity;
  };
  const simplex = [x0, ...x0.map((_, i) => x0.map((v, j) => (i === j ? v + steps[i]! : v)))].map(
    (x) => ({ x, fx: value(x) })
  );
  if (n === 0) return { x: x0, fx: simplex[0]!.fx, evals };
  const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + t * (b[i]! - v));
  while (evals < maxEvals) {
    simplex.sort((a, b) => a.fx - b.fx);
    const best = simplex[0]!;
    const worst = simplex[n]!;
    if (Math.abs(worst.fx - best.fx) < tol) break;
    const centre = x0.map((_, i) => simplex.slice(0, n).reduce((s, p) => s + p.x[i]!, 0) / n);
    const r = mix(centre, worst.x, -1);
    const fr = value(r);
    if (fr < best.fx) {
      const e = mix(centre, worst.x, -2);
      const fe = value(e);
      simplex[n] = fe < fr ? { x: e, fx: fe } : { x: r, fx: fr };
    } else if (fr < simplex[n - 1]!.fx) {
      simplex[n] = { x: r, fx: fr };
    } else {
      const c = fr < worst.fx ? mix(centre, r, 0.5) : mix(centre, worst.x, 0.5);
      const fc = value(c);
      if (fc < Math.min(fr, worst.fx)) simplex[n] = { x: c, fx: fc };
      else {
        for (let k = 1; k <= n && evals < maxEvals; k++) {
          const x = mix(best.x, simplex[k]!.x, 0.5);
          simplex[k] = { x, fx: value(x) };
        }
      }
    }
  }
  simplex.sort((a, b) => a.fx - b.fx);
  return { x: simplex[0]!.x, fx: simplex[0]!.fx, evals };
}
