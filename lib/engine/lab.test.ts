import { describe, expect, it } from "vitest";

import { brinsonFachler, compoundReturn, standardizedSurprises } from "./attribution";
import { walkForward } from "./backtest";
import { kalmanBeta } from "./capm";
import { engleGranger } from "./coint";
import { garchStep } from "./garch";
import { fitNelsonSiegel, nsYield } from "./nelson-siegel";

function close(a: number, b: number, eps = 1e-8) {
  expect(Math.abs(a - b)).toBeLessThan(eps);
}

describe("GARCH(1,1)", () => {
  it("matches the variance recursion σ²_t = ω + α r²_{t−1} + β σ²_{t−1}", () => {
    const omega = 1e-5;
    const alpha = 0.1;
    const beta = 0.8;
    const prevR = 0.02;
    const prevVar = 4e-4;
    close(garchStep(omega, alpha, beta, prevR, prevVar), omega + alpha * prevR * prevR + beta * prevVar);
  });
});

describe("Nelson–Siegel", () => {
  it("recovers known β on the Diebold–Li λ grid", () => {
    const lambda = 1.35;
    const tenors = [0.25, 0.5, 1, 2, 5, 7, 10, 20, 30];
    const yields = tenors.map((tau) => nsYield(tau, 4.1, -1.2, 0.8, lambda));
    const fit = fitNelsonSiegel(tenors, yields);
    close(fit.beta0, 4.1, 2e-3);
    close(fit.beta1, -1.2, 2e-3);
    close(fit.beta2, 0.8, 2e-3);
    close(fit.lambda, lambda, 0.16);
    close(fit.rmse, 0, 1e-6);
  });
});

describe("Engle–Granger", () => {
  it("recovers y = α + β x", () => {
    const x = Array.from({ length: 80 }, (_, i) => i * 0.01);
    const y = x.map((xi) => 0.5 + 1.3 * xi);
    const res = engleGranger(y, x);
    close(res.alpha, 0.5, 1e-10);
    close(res.beta, 1.3, 1e-10);
    close(res.residualVol, 0, 1e-12);
    close(res.lastZ, 0, 1e-12);
  });

  it("reports last residual in σ units", () => {
    const x = [1, 2, 3, 4, 5, 6, 7, 8];
    const y = [2, 4, 6, 8, 10, 12, 14, 20];
    const res = engleGranger(y, x);
    const last = y[y.length - 1]! - res.alpha - res.beta * x[x.length - 1]!;
    close(res.lastZ, last / res.residualVol, 1e-10);
  });
});

describe("Brinson–Fachler", () => {
  it("allocation + selection + interaction equals active return", () => {
    const wP = [0.6, 0.4];
    const wB = [0.5, 0.5];
    const rP = [0.1, 0.05];
    const rB = [0.08, 0.04];
    const res = brinsonFachler(wP, wB, rP, rB);
    close(res.portfolio, 0.08);
    close(res.benchmark, 0.06);
    close(res.allocation, 0.004);
    close(res.selection, 0.015);
    close(res.interaction, 0.001);
    close(res.active, res.allocation + res.selection + res.interaction);
    close(res.active, res.portfolio - res.benchmark);
  });

  it("compounds as Π(1+r) − 1", () => {
    close(compoundReturn([0.1, -0.1]), 1.1 * 0.9 - 1);
  });
});

describe("SUE", () => {
  it("standardizes surprises by the sample σ", () => {
    const pts = standardizedSurprises([
      { date: "a", actual: 3, estimate: 1 },
      { date: "b", actual: 1, estimate: 1 },
    ]);
    const sd = Math.sqrt(2);
    close(pts[0]!.surprise, 2);
    close(pts[1]!.surprise, 0);
    close(pts[0]!.sue, 2 / sd, 1e-10);
    close(pts[1]!.sue, 0, 1e-10);
  });
});

describe("walk-forward", () => {
  it("gives identical wealth for every optimizer when assets are the same series", () => {
    const r = Array.from({ length: 90 }, (_, i) => 0.001 * Math.sin(i / 7));
    const matrix = r.map((x) => [x, x]);
    const wf = walkForward(matrix, 25);
    expect(wf.points.length).toBeGreaterThan(10);
    close(wf.terminal.ew, wf.terminal.gmv, 1e-10);
    close(wf.terminal.ew, wf.terminal.sharpe, 1e-10);
    close(wf.terminal.ew, wf.terminal.erc, 1e-10);
  });
});

describe("Kalman beta", () => {
  it("tracks a constant β when y = β x", () => {
    const x = Array.from({ length: 200 }, (_, i) => Math.sin(i / 9) * 0.01);
    const y = x.map((xi) => 1.7 * xi);
    const path = kalmanBeta(y, x, 1e-8, 1e-6);
    close(path[path.length - 1]!, 1.7, 0.05);
  });
});
