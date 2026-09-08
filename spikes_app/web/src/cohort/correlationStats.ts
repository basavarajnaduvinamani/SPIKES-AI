type PearsonInput = { x: number; y: number }

export type PearsonCorrelationResult = {
  n: number
  r: number
  p: number | null
  slope: number
  intercept: number
}

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi)

// Lanczos approximation for log-gamma (Numerical Recipes style coefficients).
// Accurate enough for p-value computation in typical UI datasets.
const logGamma = (z: number): number => {
  const p = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ]

  if (z < 0.5) {
    // Reflection formula: Gamma(z)Gamma(1-z) = pi / sin(pi z)
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z)
  }

  z -= 1
  let x = p[0]
  for (let i = 1; i < p.length; i++) {
    x += p[i] / (z + i)
  }

  const t = z + 7.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
}

// Continued fraction for incomplete beta (betacf).
const betacf = (a: number, b: number, x: number): number => {
  const MAX_ITER = 200
  const EPS = 3e-8

  let qab = a + b
  let qap = a + 1
  let qam = a - 1
  let c = 1
  let d = 1 - (qab * x) / qap
  if (Math.abs(d) < 1e-30) d = 1e-30
  d = 1 / d
  let h = d

  for (let m = 1; m <= MAX_ITER; m++) {
    const m2 = 2 * m
    // Even step
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d
    if (Math.abs(d) < 1e-30) d = 1e-30
    c = 1 + aa / c
    if (Math.abs(c) < 1e-30) c = 1e-30
    d = 1 / d
    h *= d * c

    // Odd step
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d
    if (Math.abs(d) < 1e-30) d = 1e-30
    c = 1 + aa / c
    if (Math.abs(c) < 1e-30) c = 1e-30
    d = 1 / d
    const del = d * c
    h *= del

    if (Math.abs(del - 1) < EPS) break
  }

  return h
}

// Regularized incomplete beta I_x(a,b).
const regularizedIncompleteBeta = (x: number, a: number, b: number): number => {
  const xx = clamp(x, 0, 1)
  if (xx === 0) return 0
  if (xx === 1) return 1

  const logBt =
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(xx) + b * Math.log(1 - xx)
  const bt = Math.exp(logBt)

  // Choose representation for stability.
  if (xx < (a + 1) / (a + b + 2)) {
    return (bt * betacf(a, b, xx)) / a
  }

  return 1 - (bt * betacf(b, a, 1 - xx)) / b
}

// Student-t CDF for real-valued t and df >= 1.
const studentTCdf = (t: number, df: number): number => {
  if (!Number.isFinite(t) || !Number.isFinite(df) || df <= 0) return NaN
  if (t === 0) return 0.5

  const sign = t < 0 ? -1 : 1
  const x = df / (df + t * t)
  const a = df / 2
  const b = 0.5
  const ib = regularizedIncompleteBeta(x, a, b)

  // For t > 0: cdf = 1 - 0.5 * I_{df/(df+t^2)}(df/2, 1/2)
  const cdfPos = 1 - 0.5 * ib
  return sign < 0 ? 1 - cdfPos : cdfPos
}

const pearsonCorrelation = (pairs: PearsonInput[]): PearsonCorrelationResult | null => {
  const n = pairs.length
  if (n < 2) return null

  const xs = pairs.map((p) => p.x)
  const ys = pairs.map((p) => p.y)

  const xMean = xs.reduce((s, v) => s + v, 0) / n
  const yMean = ys.reduce((s, v) => s + v, 0) / n

  let sxx = 0
  let syy = 0
  let sxy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - xMean
    const dy = ys[i] - yMean
    sxx += dx * dx
    syy += dy * dy
    sxy += dx * dy
  }

  if (sxx <= 0 || syy <= 0) {
    // No variance -> correlation undefined; slope/intercept could still be computed,
    // but in practice this means charts will have no meaningful trend.
    return {
      n,
      r: 0,
      p: null,
      slope: 0,
      intercept: yMean,
    }
  }

  const r = sxy / Math.sqrt(sxx * syy)
  const slope = sxy / sxx
  const intercept = yMean - slope * xMean

  const df = n - 2
  if (df < 1 || Math.abs(r) >= 1) {
    return { n, r, p: null, slope, intercept }
  }

  const t = Math.abs(r) * Math.sqrt(df / (1 - r * r))
  const cdf = studentTCdf(t, df)
  const p = 2 * (1 - cdf)
  const pSafe = Number.isFinite(p) ? clamp(p, 0, 1) : null

  return { n, r, p: pSafe, slope, intercept }
}

export const pearsonCorrelationFromSeries = (pairs: PearsonInput[]): PearsonCorrelationResult | null => {
  const filtered = pairs.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
  return pearsonCorrelation(filtered)
}

