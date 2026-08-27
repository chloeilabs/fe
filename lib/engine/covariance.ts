import { add, cholesky, frobenius, identity, scale } from "@/lib/engine/matrix";
import { mean } from "@/lib/engine/stats";

export function sampleCovariance(returns: number[][]): {
  mu: number[];
  cov: number[][];
} {
  const T = returns.length;
  const N = returns[0]?.length ?? 0;
  const mu = Array.from({ length: N }, (_, j) =>
    mean(returns.map((row) => row[j] ?? 0)),
  );
  const cov = Array.from({ length: N }, () => Array.from({ length: N }, () => 0));
  if (T < 2 || N === 0) return { mu, cov };
  for (let i = 0; i < N; i += 1) {
    for (let j = i; j < N; j += 1) {
      let s = 0;
      for (let t = 0; t < T; t += 1) {
        s += (returns[t][i] - mu[i]) * (returns[t][j] - mu[j]);
      }
      const v = s / (T - 1);
      cov[i][j] = v;
      cov[j][i] = v;
    }
  }
  return { mu, cov };
}

function sampleCorrelations(cov: number[][]): number[][] {
  const N = cov.length;
  const corr = Array.from({ length: N }, () => Array.from({ length: N }, () => 0));
  for (let i = 0; i < N; i += 1) {
    for (let j = 0; j < N; j += 1) {
      const di = Math.sqrt(Math.max(cov[i][i], 1e-18));
      const dj = Math.sqrt(Math.max(cov[j][j], 1e-18));
      corr[i][j] = cov[i][j] / (di * dj);
    }
  }
  return corr;
}

/**
 * Ledoit–Wolf shrinkage toward the constant-correlation target.
 * Ledoit & Wolf, Journal of Portfolio Management 2004.
 */
export function ledoitWolfShrink(returns: number[][]): {
  mu: number[];
  sample: number[][];
  shrunk: number[][];
  delta: number;
} {
  const { mu, cov: sample } = sampleCovariance(returns);
  const T = returns.length;
  const N = sample.length;
  if (T < 3 || N === 0) {
    return { mu, sample, shrunk: sample, delta: 0 };
  }

  const vols = sample.map((row, i) => Math.sqrt(Math.max(row[i], 1e-18)));
  let rhoBar = 0;
  let pairs = 0;
  for (let i = 0; i < N; i += 1) {
    for (let j = i + 1; j < N; j += 1) {
      rhoBar += sample[i][j] / (vols[i] * vols[j]);
      pairs += 1;
    }
  }
  rhoBar = pairs > 0 ? rhoBar / pairs : 0;

  const target = Array.from({ length: N }, () =>
    Array.from({ length: N }, () => 0),
  );
  for (let i = 0; i < N; i += 1) {
    for (let j = 0; j < N; j += 1) {
      target[i][j] =
        i === j ? sample[i][i] : rhoBar * vols[i] * vols[j];
    }
  }

  const centered = returns.map((row) => row.map((v, j) => v - mu[j]));
  let piHat = 0;
  let rhoHat = 0;
  let gammaHat = 0;
  for (let i = 0; i < N; i += 1) {
    for (let j = 0; j < N; j += 1) {
      let theta = 0;
      for (let t = 0; t < T; t += 1) {
        const d = centered[t][i] * centered[t][j] - sample[i][j];
        theta += d * d;
      }
      theta /= T;
      piHat += theta;
      const targetIj = target[i][j];
      gammaHat += (sample[i][j] - targetIj) ** 2;
    }
  }

  for (let i = 0; i < N; i += 1) {
    for (let j = 0; j < N; j += 1) {
      if (i === j) continue;
      let phi = 0;
      for (let t = 0; t < T; t += 1) {
        phi +=
          (vols[j] / vols[i]) *
            (centered[t][i] ** 2 - sample[i][i]) *
            (centered[t][i] * centered[t][j] - sample[i][j]) +
          (vols[i] / vols[j]) *
            (centered[t][j] ** 2 - sample[j][j]) *
            (centered[t][i] * centered[t][j] - sample[i][j]);
      }
      rhoHat += (rhoBar / 2) * (phi / T);
    }
  }
  for (let i = 0; i < N; i += 1) {
    let phi = 0;
    for (let t = 0; t < T; t += 1) {
      const d = centered[t][i] ** 2 - sample[i][i];
      phi += d * d;
    }
    rhoHat += phi / T;
  }

  const kappa = gammaHat > 1e-18 ? (piHat - rhoHat) / gammaHat : 0;
  const delta = Math.min(1, Math.max(0, kappa / T));
  const shrunk = add(scale(sample, 1 - delta), scale(target, delta));
  return { mu, sample, shrunk, delta };
}

export function ewmaCovariance(
  returns: number[][],
  lambda = 0.94,
): number[][] {
  const T = returns.length;
  const N = returns[0]?.length ?? 0;
  const cov = Array.from({ length: N }, () => Array.from({ length: N }, () => 0));
  if (T === 0 || N === 0) return cov;
  const mu = Array.from({ length: N }, (_, j) =>
    mean(returns.map((row) => row[j] ?? 0)),
  );
  for (let t = 0; t < T; t += 1) {
    const r = returns[t].map((v, j) => v - mu[j]);
    const w = 1 - lambda;
    for (let i = 0; i < N; i += 1) {
      for (let j = i; j < N; j += 1) {
        const v = lambda * cov[i][j] + w * r[i] * r[j];
        cov[i][j] = v;
        cov[j][i] = v;
      }
    }
  }
  return cov;
}

export function annualizeCov(daily: number[][], periods = 252): number[][] {
  return scale(daily, periods);
}

export function annualizeMu(daily: number[], periods = 252): number[] {
  return daily.map((m) => m * periods);
}

export function covToCorr(cov: number[][]): number[][] {
  return sampleCorrelations(cov);
}

export function isSpd(cov: number[][]): boolean {
  try {
    cholesky(cov);
    return true;
  } catch {
    return false;
  }
}

export function covDistance(a: number[][], b: number[][]): number {
  return frobenius(add(a, scale(b, -1)));
}

export function identityPrior(n: number, variance: number): number[][] {
  return scale(identity(n), variance);
}

export function toReturnMatrix(
  returns: Record<string, number[]>,
  symbols: string[],
): number[][] {
  if (symbols.length === 0) return [];
  const T = Math.min(...symbols.map((s) => returns[s]?.length ?? 0));
  if (!Number.isFinite(T) || T <= 0) return [];
  return Array.from({ length: T }, (_, t) =>
    symbols.map((s) => returns[s]?.[t] ?? 0),
  );
}

export function ewmaVariance(returns: number[], lambda = 0.94): number {
  let v = 0;
  const m = mean(returns);
  for (const r of returns) {
    const d = r - m;
    v = lambda * v + (1 - lambda) * d * d;
  }
  return v;
}
