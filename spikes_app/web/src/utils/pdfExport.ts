import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export type ExportPdfOptions = {
  password: string
  filename: string
  title?: string
}

/** Depth-first list of elements (HTML + SVG) under root. */
const collectDfs = (root: Element): Element[] => {
  const out: Element[] = []
  const walk = (n: Element) => {
    out.push(n)
    for (const c of n.children) walk(c)
  }
  walk(root)
  return out
}

const COLORISH = /oklab|oklch|color\(display-p3|lab\(|lch\(/i

/**
 * Canvas resolves modern color spaces to sRGB pixels (avoids html2canvas CSS parser errors).
 */
const resolveColorToRgb = (value: string): string => {
  const v = value.trim()
  if (!v || v === 'transparent' || v === 'none') return v
  if (!COLORISH.test(v)) return v
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext('2d')
    if (!ctx) return v
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 1, 1)
    ctx.fillStyle = v
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
    return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a / 255})`
  } catch {
    return v
  }
}

const sanitizePropertyValue = (name: string, value: string): string => {
  if (!value) return value
  const lower = name.toLowerCase()
  if (!COLORISH.test(value)) return value
  if (lower === 'box-shadow') {
    return 'none'
  }
  if (lower === 'background-image' || lower === 'filter') {
    return 'none'
  }
  if (
    lower.includes('color') ||
    lower.includes('background') ||
    lower === 'fill' ||
    lower === 'stroke' ||
    lower === 'stop-color' ||
    lower === 'flood-color' ||
    lower === 'lighting-color'
  ) {
    return resolveColorToRgb(value)
  }
  return value
}

/**
 * Tailwind v4 emits oklab() in bundled CSS; html2canvas cannot parse it. Strip injected
 * styles in the clone and inline resolved computed styles from the live DOM.
 */
const flattenComputedStylesToClone = (originalRoot: HTMLElement, clonedRoot: HTMLElement) => {
  const orig = collectDfs(originalRoot)
  const cl = collectDfs(clonedRoot)
  const n = Math.min(orig.length, cl.length)
  for (let i = 0; i < n; i++) {
    const o = orig[i]
    const c = cl[i]
    if (!(o instanceof HTMLElement || o instanceof SVGElement)) continue
    if (!(c instanceof HTMLElement || c instanceof SVGElement)) continue
    const cs = getComputedStyle(o)
    c.removeAttribute('class')
    c.removeAttribute('style')
    for (let j = 0; j < cs.length; j++) {
      const name = cs.item(j)
      if (!name) continue
      let value = cs.getPropertyValue(name)
      value = sanitizePropertyValue(name, value)
      try {
        c.style.setProperty(name, value, cs.getPropertyPriority(name))
      } catch {
        /* skip unsupported */
      }
    }
  }
}

const stripParserBreakingStylesheets = (clonedDoc: Document) => {
  clonedDoc.querySelectorAll('link[rel="stylesheet"]').forEach((el) => el.remove())
  clonedDoc.querySelectorAll('style').forEach((el) => el.remove())
}

const sliceCanvas = (canvas: HTMLCanvasElement, pdf: jsPDF) => {
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const srcWidth = canvas.width
  const srcHeight = canvas.height
  const pageHeightPx = (srcWidth * pageHeight) / pageWidth
  let y = 0
  let page = 0
  while (y < srcHeight) {
    const sliceH = Math.min(pageHeightPx, srcHeight - y)
    const sliceEl = document.createElement('canvas')
    sliceEl.width = srcWidth
    sliceEl.height = sliceH
    const ctx = sliceEl.getContext('2d')
    if (!ctx) throw new Error('Could not get canvas context')
    ctx.drawImage(canvas, 0, y, srcWidth, sliceH, 0, 0, srcWidth, sliceH)
    const imgData = sliceEl.toDataURL('image/jpeg', 0.92)
    const drawH = (sliceH * pageWidth) / srcWidth
    if (page > 0) pdf.addPage()
    pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, drawH)
    y += sliceH
    page++
  }
}

export const exportHtmlToPasswordPdf = async (
  element: HTMLElement,
  options: ExportPdfOptions,
): Promise<void> => {
  const { password, filename, title } = options
  const pwd = password.trim()
  if (pwd.length < 4) {
    throw new Error('Password must be at least 4 characters.')
  }
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
    encryption: {
      userPassword: pwd,
      ownerPassword: pwd,
      userPermissions: ['print', 'copy', 'modify', 'annot-forms'],
    },
  })
  if (title) {
    pdf.setProperties({ title })
  }
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    onclone: (clonedDoc, clonedRoot) => {
      clonedDoc.documentElement.classList.remove('dark')
      clonedDoc.body.classList.remove('dark')
      stripParserBreakingStylesheets(clonedDoc)
      flattenComputedStylesToClone(element, clonedRoot)
      clonedRoot.style.backgroundColor = '#ffffff'
      clonedRoot.style.color = '#0f172a'
    },
  })
  sliceCanvas(canvas, pdf)
  pdf.save(filename)
}

export const buildPdfFilename = (prefix: string, patientId: string | undefined): string => {
  const safe = (patientId ?? 'unknown').replace(/[^\w.-]+/g, '_')
  const day = new Date().toISOString().slice(0, 10)
  return `${prefix}-${safe}-${day}.pdf`
}
