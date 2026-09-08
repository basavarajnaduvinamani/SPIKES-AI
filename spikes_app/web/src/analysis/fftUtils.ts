/**
 * NumPy-compatible FFT/IFFT and fftfreq for parity with scipy.fft in spike_detection.py
 */

export type Complex = { re: number; im: number }

export const cAdd = (a: Complex, b: Complex): Complex => ({
  re: a.re + b.re,
  im: a.im + b.im,
})

export const cMul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
})

export const cScale = (a: Complex, s: number): Complex => ({
  re: a.re * s,
  im: a.im * s,
})

/** np.fft.fft — forward DFT, unscaled */
export const numpyFft = (x: Complex[]): Complex[] => {
  const n = x.length
  const out: Complex[] = new Array(n)
  for (let k = 0; k < n; k++) {
    let re = 0
    let im = 0
    for (let m = 0; m < n; m++) {
      const angle = (-2 * Math.PI * k * m) / n
      const c = Math.cos(angle)
      const s = Math.sin(angle)
      re += x[m].re * c - x[m].im * s
      im += x[m].re * s + x[m].im * c
    }
    out[k] = { re, im }
  }
  return out
}

/** np.fft.ifft — inverse DFT, scales by 1/n */
export const numpyIfft = (X: Complex[]): Complex[] => {
  const n = X.length
  const out: Complex[] = new Array(n)
  for (let m = 0; m < n; m++) {
    let re = 0
    let im = 0
    for (let k = 0; k < n; k++) {
      const angle = (2 * Math.PI * k * m) / n
      const c = Math.cos(angle)
      const s = Math.sin(angle)
      re += X[k].re * c - X[k].im * s
      im += X[k].re * s + X[k].im * c
    }
    out[m] = { re: re / n, im: im / n }
  }
  return out
}

/** numpy.fft.fftfreq(n, d) — cycles per unit of sample spacing */
export const fftfreq = (n: number, d: number): Float64Array => {
  const val = 1.0 / (n * d)
  const results = new Float64Array(n)
  const N = Math.floor((n - 1) / 2) + 1
  for (let i = 0; i < N; i++) {
    results[i] = i * val
  }
  const p2Len = n - N
  for (let j = 0; j < p2Len; j++) {
    results[N + j] = (-Math.floor(n / 2) + j) * val
  }
  return results
}

export const absComplex = (z: Complex): number => Math.hypot(z.re, z.im)
