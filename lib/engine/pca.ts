import { covToCorr } from "@/lib/engine/covariance";
import { jacobiEigen } from "@/lib/engine/matrix";

export type PcaResult = {
  eigenvalues: number[];
  eigenvectors: number[][];
  explained: number[];
  cumulative: number[];
};

export function pcaFactors(cov: number[][]): PcaResult {
  const corr = covToCorr(cov);
  const { values, vectors } = jacobiEigen(corr);
  const total = values.reduce((s, v) => s + Math.max(v, 0), 0);
  const explained = values.map((v) => (total > 0 ? Math.max(v, 0) / total : 0));
  const cumulative: number[] = [];
  explained.reduce((s, v, i) => {
    cumulative[i] = s + v;
    return cumulative[i];
  }, 0);
  return {
    eigenvalues: values,
    eigenvectors: vectors,
    explained,
    cumulative,
  };
}

export function factorLoadings(
  pca: PcaResult,
  k = 3,
): number[][] {
  const n = pca.eigenvalues.length;
  const m = Math.min(k, n);
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: m }, (_, j) => {
      const lam = Math.max(pca.eigenvalues[j], 0);
      return pca.eigenvectors[i][j] * Math.sqrt(lam);
    }),
  );
}
