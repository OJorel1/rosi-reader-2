import { useEffect, useRef, useState } from "react";
import { PageFlip } from "page-flip";
import { openPdf, pdfjs, type PDFDocumentProxy } from "../lib/pdf";
import { isNarrow } from "../lib/platform";
import { t } from "../lib/i18n";
import type { Rect } from "../types";
import type { ReaderProps, TocItem } from "./ReaderTypes";

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function PdfReader({ data, start, settings, ctrl, selectMode, marks, onRelocate, onSelection }: ReaderProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [tick, setTick] = useState(0);
  const page = useRef(Number(start) || 1);
  const zoom = useDebounced(settings.zoom, 250);
  const cb = useRef({ onRelocate, onSelection });
  cb.current = { onRelocate, onSelection };
  const marksRef = useRef(marks);
  marksRef.current = marks;
  const paintRef = useRef<(() => void) | null>(null);

  // redesenha os destaques quando a lista muda
  useEffect(() => {
    paintRef.current?.();
  }, [marks]);

  useEffect(() => {
    let alive = true;
    let loaded: PDFDocumentProxy | null = null;
    openPdf(data).then((d) => {
      loaded = d;
      if (alive) setDoc(d);
      else d.destroy();
    });
    return () => {
      alive = false;
      loaded?.destroy();
    };
  }, [data]);

  useEffect(() => {
    let t: number;
    const on = () => {
      clearTimeout(t);
      t = window.setTimeout(() => setTick((n) => n + 1), 300);
    };
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  useEffect(() => {
    if (!doc || !hostRef.current || !scrollRef.current) return;
    const pdf = doc;
    const host = hostRef.current;
    const scroller = scrollRef.current;
    const total = pdf.numPages;
    let disposed = false;
    let flip: PageFlip | null = null;
    const done = new Set<number>();
    const els: HTMLDivElement[] = [];

    (async () => {
      const first = await pdf.getPage(1);
      const v = first.getViewport({ scale: 1 });
      const ratio = v.width / v.height;

      // celular: uma página por vez, ajustada à largura da tela
      const portrait = isNarrow();
      let baseH = scroller.clientHeight - 40;
      let baseW = baseH * ratio;
      if (portrait && baseW > scroller.clientWidth - 24) {
        baseW = scroller.clientWidth - 24;
        baseH = baseW / ratio;
      }
      const H = Math.max(280, Math.round(baseH * zoom));
      const W = Math.round(portrait ? baseW * zoom : H * ratio);
      if (disposed) return;

      host.innerHTML = "";
      const stage = document.createElement("div");
      if (portrait) stage.style.width = `${W}px`;
      host.appendChild(stage);

      for (let i = 0; i < total; i++) {
        const el = document.createElement("div");
        el.className = "pdf-page";
        el.dataset.page = String(i + 1);
        if (i === 0 || i === total - 1) el.dataset.density = "hard";
        els.push(el);
      }

      const paintPage = (n: number) => {
        const el = els[n - 1];
        if (!el) return;
        el.querySelector(":scope > .hl-layer")?.remove();
        const ms = marksRef.current.filter((m) => m.page === n && m.rects?.length);
        if (!ms.length) return;
        const layer = document.createElement("div");
        layer.className = "hl-layer";
        for (const m of ms)
          for (const r of m.rects!) {
            const d = document.createElement("div");
            d.style.cssText = `left:${r.x * 100}%;top:${r.y * 100}%;width:${r.w * 100}%;height:${r.h * 100}%;background:${m.color}`;
            layer.appendChild(d);
          }
        el.appendChild(layer);
      };
      paintRef.current = () => done.forEach(paintPage);

      async function render(n: number) {
        if (n < 1 || n > total || done.has(n) || disposed) return;
        done.add(n);
        const p = await pdf.getPage(n);
        if (disposed) return;
        const base = p.getViewport({ scale: 1 });
        const scale = W / base.width;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        const canvas = document.createElement("canvas");
        const vp = p.getViewport({ scale: scale * dpr });
        canvas.width = vp.width;
        canvas.height = vp.height;
        await p.render({ canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;

        const text = document.createElement("div");
        text.className = "textLayer";
        text.style.setProperty("--scale-factor", String(scale));
        const layer = new pdfjs.TextLayer({
          textContentSource: p.streamTextContent(),
          container: text,
          viewport: p.getViewport({ scale }),
        });
        await layer.render().catch(() => {});
        if (!disposed) {
          els[n - 1].replaceChildren(canvas, text);
          paintPage(n);
        }
      }
      const around = (n: number) => {
        for (let k = -2; k <= 4; k++) render(n + k);
      };

      flip = new PageFlip(stage, {
        width: W,
        height: H,
        size: "fixed",
        showCover: true,
        drawShadow: true,
        maxShadowOpacity: 0.45,
        flippingTime: 750,
        usePortrait: portrait,
        startPage: Math.min(Math.max(page.current - 1, 0), total - 1),
        useMouseEvents: !selectMode,
        mobileScrollSupport: false,
        autoSize: false,
      });
      flip.loadFromHTML(els);

      const report = (n: number) => cb.current.onRelocate(n, n / total, t("reader.paginaDe", { n, total }));
      flip.on("flip", (e) => {
        const n = (e.data as number) + 1;
        page.current = n;
        report(n);
        around(n);
      });

      const pageText = async (n: number) => {
        const tc = await (await pdf.getPage(n)).getTextContent();
        return tc.items.map((i) => ("str" in i ? i.str : "")).join(" ");
      };

      ctrl.current = {
        next: () => flip?.flipNext(),
        prev: () => flip?.flipPrev(),
        goTo: (l) => {
          const n = Math.min(Math.max(Number(l) || 1, 1), total);
          flip?.turnToPage(n - 1);
          page.current = n;
          report(n);
          around(n);
        },
        getToc: async () => {
          const out: TocItem[] = [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const walk = async (items: any[], depth: number) => {
            for (const it of items) {
              let pg = 0;
              try {
                let dest = it.dest;
                if (typeof dest === "string") dest = await pdf.getDestination(dest);
                if (Array.isArray(dest)) pg = (await pdf.getPageIndex(dest[0])) + 1;
              } catch { /* destino inválido */ }
              if (pg) out.push({ label: String(it.title).trim(), loc: pg, depth });
              if (it.items?.length) await walk(it.items, depth + 1);
            }
          };
          const outline = await pdf.getOutline();
          if (outline) await walk(outline, 0);
          return out;
        },
        search: async (q, onHit, cancelled) => {
          const needle = q.toLowerCase();
          let hits = 0;
          for (let p = 1; p <= total && hits < 100; p++) {
            if (cancelled()) return;
            const text = await pageText(p);
            const low = text.toLowerCase();
            let from = 0;
            for (let k = 0; k < 3; k++) {
              const i = low.indexOf(needle, from);
              if (i < 0) break;
              onHit({
                loc: p,
                label: t("reader.pagina", { n: p }),
                excerpt: (i > 40 ? "…" : "") + text.slice(Math.max(0, i - 40), i + q.length + 60).trim() + "…",
              });
              hits++;
              from = i + needle.length;
            }
          }
        },
        speech: {
          read: async () => {
            const n = page.current;
            const both = !portrait && n > 1 && n < total;
            return (await pageText(n)) + " " + (both ? await pageText(n + 1) : "");
          },
          advance: async () => {
            if (page.current >= total) return false;
            flip?.flipNext();
            await sleep(950);
            return true;
          },
        },
      };

      around(page.current);
      report(page.current);
    })();

    const pageOf = (n: Node | null) => (n?.parentElement as HTMLElement | null)?.closest(".pdf-page") as HTMLElement | null;
    const emitSelection = () => {
      const sel = window.getSelection();
      const txt = sel?.toString().replace(/(\p{L})-\s+(\p{Ll})/gu, "$1$2").trim();
      if (!txt || !sel || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      const pageEl = pageOf(range.startContainer);
      let pg = page.current;
      let rects: Rect[] | undefined;
      if (pageEl) {
        pg = Number(pageEl.dataset.page) || pg;
        const pr = pageEl.getBoundingClientRect();
        rects = Array.from(range.getClientRects())
          .filter((r) => r.width > 1 && r.height > 1)
          .map((r) => ({ x: (r.left - pr.left) / pr.width, y: (r.top - pr.top) / pr.height, w: r.width / pr.width, h: r.height / pr.height }))
          .filter((r) => r.x > -0.01 && r.x < 1.01 && r.y > -0.01 && r.y < 1.01);
      }
      cb.current.onSelection(txt, pg, t("reader.pagina", { n: pg }), { rects });
    };
    const onUp = () => {
      if (selectMode) emitSelection();
    };
    host.addEventListener("mouseup", onUp);

    // toque: depois de segurar e arrastar para selecionar, lê a seleção quando ela estabiliza
    let selTimer: number;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const onSel = () => {
      if (!selectMode || !coarse) return;
      clearTimeout(selTimer);
      selTimer = window.setTimeout(() => {
        const a = window.getSelection()?.anchorNode;
        if (a && host.contains(a)) emitSelection();
      }, 500);
    };
    document.addEventListener("selectionchange", onSel);

    return () => {
      disposed = true;
      host.removeEventListener("mouseup", onUp);
      document.removeEventListener("selectionchange", onSel);
      clearTimeout(selTimer);
      paintRef.current = null;
      ctrl.current = null;
      try {
        flip?.destroy();
      } catch {
        /* já destruído */
      }
      host.innerHTML = "";
    };
  }, [doc, zoom, selectMode, tick, ctrl]);

  return (
    <div ref={scrollRef} className={`pdf-scroll theme-${settings.theme}${selectMode ? " select-mode" : ""}`}>
      <div ref={hostRef} className="pdf-host" />
    </div>
  );
}
