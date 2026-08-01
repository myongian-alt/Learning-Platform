import { Platform } from 'react-native';

// PDF → slide rendering runs entirely in-browser via PDF.js (canvas rendering, Blob,
// document.createElement — all DOM APIs with no native equivalent here), so it's web-only.
// On native, uploaded PDFs stay as a plain file with conversion_status 'none'.
export const SLIDES_SUPPORTED = Platform.OS === 'web';

export interface RenderedSlide {
  position: number;
  blob: Blob;
}

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${mod.version}/build/pdf.worker.min.mjs`;
      return mod;
    });
  }
  return pdfjsPromise;
}

/** Renders every page of a PDF blob to a PNG image blob, in page order. Web only. */
export async function renderPdfToSlides(fileBlob: Blob): Promise<RenderedSlide[]> {
  if (!SLIDES_SUPPORTED) {
    throw new Error('PDF-to-slide rendering is only supported on web.');
  }

  const pdfjsLib = await getPdfjs();
  const arrayBuffer = await fileBlob.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const slides: RenderedSlide[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.5 });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const canvasContext = canvas.getContext('2d');
    if (!canvasContext) throw new Error('Canvas 2D context unavailable');

    await page.render({ canvasContext, viewport, canvas }).promise;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))), 'image/png');
    });

    slides.push({ position: pageNumber, blob });
  }

  return slides;
}
