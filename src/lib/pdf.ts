import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "pdfjs-dist/web/pdf_viewer.css";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export { pdfjs };
export type { PDFDocumentProxy } from "pdfjs-dist";

// O pdf.js "consome" o buffer, então sempre passamos uma cópia.
export const openPdf = (data: Uint8Array) => pdfjs.getDocument({ data: data.slice() }).promise;
