export type Matrix = number[][];
export type Vector = number[];

export function zeros(n: number, m = n): Matrix {
  return Array.from({ length: n }, () => Array(m).fill(0));
}

export function identity(n: number): Matrix {
  const I = zeros(n);
  for (let i = 0; i < n; i++) I[i]![i] = 1;
  return I;
}

export function clone(A: Matrix): Matrix {
  return A.map((row) => [...row]);
}

export function transpose(A: Matrix): Matrix {
  const n = A.length;
  const m = A[0]?.length ?? 0;
  const T = zeros(m, n);
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) T[j]![i] = A[i]![j]!;
  return T;
}

export function add(A: Matrix, B: Matrix): Matrix {
  return A.map((row, i) => row.map((v, j) => v + (B[i]?.[j] ?? 0)));
}

export function scale(A: Matrix, s: number): Matrix {
  return A.map((row) => row.map((v) => v * s));
}

export function vecScale(v: Vector, s: number): Vector {
  return v.map((x) => x * s);
}

export function vecAdd(a: Vector, b: Vector): Vector {
  return a.map((x, i) => x + (b[i] ?? 0));
}

export function dot(a: Vector, b: Vector): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i]! * b[i]!;
  return s;
}

export function multiply(A: Matrix, B: Matrix): Matrix {
  const n = A.length;
  const k = A[0]?.length ?? 0;
  const m = B[0]?.length ?? 0;
  const C = zeros(n, m);
  for (let i = 0; i < n; i++) {
    for (let t = 0; t < k; t++) {
      const a = A[i]![t]!;
      if (a === 0) continue;
      for (let j = 0; j < m; j++) C[i]![j]! += a * B[t]![j]!;
    }
  }
  return C;
}

export function mv(A: Matrix, v: Vector): Vector {
  return A.map((row) => dot(row, v));
}

export function quadratic(w: Vector, Sigma: Matrix): number {
  return dot(w, mv(Sigma, w));
}

export function ridge(A: Matrix, eps = 1e-10): Matrix {
  const B = clone(A);
  for (let i = 0; i < B.length; i++) B[i]![i]! += eps;
  return B;
}

/** Cholesky L with A = L L'. */
export function cholesky(A: Matrix): Matrix {
  const n = A.length;
  const L = zeros(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = A[i]![j]!;
      for (let k = 0; k < j; k++) sum -= L[i]![k]! * L[j]![k]!;
      if (i === j) {
        L[i]![j] = Math.sqrt(Math.max(sum, 1e-18));
      } else {
        L[i]![j] = sum / L[j]![j]!;
      }
    }
  }
  return L;
}

export function cholSolve(L: Matrix, b: Vector): Vector {
  const n = L.length;
  const y = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = b[i]!;
    for (let k = 0; k < i; k++) s -= L[i]![k]! * y[k]!;
    y[i] = s / L[i]![i]!;
  }
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i]!;
    for (let k = i + 1; k < n; k++) s -= L[k]![i]! * x[k]!;
    x[i] = s / L[i]![i]!;
  }
  return x;
}

export function solveSPD(A: Matrix, b: Vector): Vector {
  return cholSolve(cholesky(ridge(A)), b);
}

export function inverseSPD(A: Matrix): Matrix {
  const n = A.length;
  const L = cholesky(ridge(A));
  const I = identity(n);
  return transpose(I.map((_, j) => cholSolve(L, I[j]!)));
}

export function frobenius(A: Matrix): number {
  let s = 0;
  for (const row of A) for (const v of row) s += v * v;
  return Math.sqrt(s);
}

export function ones(n: number): Vector {
  return Array(n).fill(1);
}

export function normalize(w: Vector): Vector {
  const s = w.reduce((a, b) => a + b, 0);
  if (Math.abs(s) < 1e-18) return w.map(() => 1 / Math.max(w.length, 1));
  return w.map((x) => x / s);
}

/** Duchi et al. Euclidean projection onto the probability simplex. */
export function projectSimplex(v: Vector): Vector {
  const n = v.length;
  const u = [...v].sort((a, b) => b - a);
  let cssv = 0;
  let rho = 0;
  for (let i = 0; i < n; i++) {
    cssv += u[i]!;
    const t = (cssv - 1) / (i + 1);
    if (u[i]! - t > 0) rho = i;
  }
  cssv = 0;
  for (let i = 0; i <= rho; i++) cssv += u[i]!;
  const theta = (cssv - 1) / (rho + 1);
  return v.map((x) => Math.max(x - theta, 0));
}

/**
 * Jacobi eigenvalue decomposition for a real symmetric matrix.
 * Returns eigenvalues descending and corresponding orthonormal columns.
 */
export function jacobiEigen(A: Matrix, maxIter = 80): { values: Vector; vectors: Matrix } {
  const n = A.length;
  const S = clone(A);
  let V = identity(n);
  for (let iter = 0; iter < maxIter; iter++) {
    let p = 0;
    let q = 1;
    let max = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = Math.abs(S[i]![j]!);
        if (a > max) {
          max = a;
          p = i;
          q = j;
        }
      }
    }
    if (max < 1e-12) break;
    const app = S[p]![p]!;
    const aqq = S[q]![q]!;
    const apq = S[p]![q]!;
    const tau = (aqq - app) / (2 * apq);
    const t = sign(tau) / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
    const c = 1 / Math.sqrt(1 + t * t);
    const s = t * c;
    S[p]![p] = app - t * apq;
    S[q]![q] = aqq + t * apq;
    S[p]![q] = 0;
    S[q]![p] = 0;
    for (let k = 0; k < n; k++) {
      if (k === p || k === q) continue;
      const akp = S[k]![p]!;
      const akq = S[k]![q]!;
      S[k]![p] = S[p]![k] = c * akp - s * akq;
      S[k]![q] = S[q]![k] = s * akp + c * akq;
    }
    for (let k = 0; k < n; k++) {
      const vkp = V[k]![p]!;
      const vkq = V[k]![q]!;
      V[k]![p] = c * vkp - s * vkq;
      V[k]![q] = s * vkp + c * vkq;
    }
  }
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => S[b]![b]! - S[a]![a]!);
  const values = idx.map((i) => S[i]![i]!);
  const vectors = zeros(n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) vectors[i]![j] = V[i]![idx[j]!]!;
  return { values, vectors };
}

export function sign(x: number) {
  return x < 0 ? -1 : 1;
}
