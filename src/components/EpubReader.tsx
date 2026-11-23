import { useEffect, useRef } from "react";
import ePub, { type Rendition } from "epubjs";
import type { ReaderProps, TocItem } from "./ReaderTypes";
import { fontStack } from "../lib/fonts";
import { t } from "../lib/i18n";

const PALETTE = {
  papel: { bg: "#f6f1e7", fg: "#2a2433" },
  sepia: { bg: "#efe0c0", fg: "#4a3a22" },
  noite: { bg: "#1b1530", fg: "#e8e3f5" },
};

export default function EpubReader({ data, start, settings, ctrl, selectMode, marks, onRelocate, onSelection }: ReaderProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendRef = useRef<Rendition | null>(null);
  const applied = useRef(new Map<string, string>());
  const cb = useRef({ onRelocate, onSelection });
  cb.current = { onRelocate, onSelection };
  const sel = useRef(selectMode);
  sel.current = selectMode;

  useEffect(() => {
    const host = hostRef.current!;
    const book = ePub(data.slice().buffer as ArrayBuffer);
    const rendition = book.renderTo(host, { width: "100%", height: "100%", flow: "paginated", spread: "auto" });
    rendRef.current = rendition;

    rendition.display(typeof start === "string" && start ? start : undefined);

    let located = false;
    book.ready
      .then(() => book.locations.generate(1200))
      .then(() => {
        located = true;
      })
      .catch(() => {});

    rendition.on("relocated", (loc: { start: { cfi: string; percentage: number } }) => {
      const cfi = loc.start.cfi;
      const p = located ? book.locations.percentageFromCfi(cfi) : loc.start.percentage;
      cb.current.onRelocate(cfi, p || 0, t("reader.pctDoLivro", { pct: Math.round((p || 0) * 100) }));
    });

    rendition.on("selected", (cfiRange: string, contents: { window: Window }) => {
      const txt = contents.window.getSelection()?.toString().trim();
      if (txt) cb.current.onSelection(txt, cfiRange, t("reader.trechoLivro"));
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyBook = book as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const here = () => (rendition.currentLocation() as any)?.start;

    ctrl.current = {
      next: () => void rendition.next(),
      prev: () => void rendition.prev(),
      goTo: (l) => void rendition.display(String(l)),
      getToc: async () => {
        const nav = await book.loaded.navigation;
        const out: TocItem[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const walk = (items: any[], depth: number) =>
          items.forEach((i) => {
            out.push({ label: String(i.label).trim(), loc: i.href, depth });
            if (i.subitems?.length) walk(i.subitems, depth + 1);
          });
        walk(nav.toc, 0);
        return out;
      },
      search: async (q, onHit, cancelled) => {
        await book.ready;
        let hits = 0;
        for (const item of anyBook.spine.spineItems ?? []) {
          if (cancelled() || hits >= 100) return;
          try {
            await item.load(book.load.bind(book));
            const found = (item.find(q) ?? []) as { cfi: string; excerpt: string }[];
            for (const f of found.slice(0, 5)) {
              onHit({ loc: f.cfi, excerpt: f.excerpt.trim(), label: t("reader.secao", { n: item.index + 1 }) });
              hits++;
            }
            item.unload();
          } catch { /* seção ilegível */ }
        }
      },
      speech: {
        read: async () => {
          const cfi = here()?.cfi;
          if (!cfi) return "";
          const range: Range = await anyBook.getRange(cfi);
          const body = range.startContainer.ownerDocument?.body;
          if (!body?.lastChild) return "";
          const r = range.cloneRange();
          r.setEndAfter(body.lastChild);
          return r.toString();
        },
        advance: async () => {
          const idx = here()?.index;
          const next = typeof idx === "number" ? anyBook.spine.get(idx + 1) : undefined;
          if (!next) return false;
          const moved = new Promise((res) => rendition.once("relocated", res));
          await rendition.display(next.href);
          await Promise.race([moved, new Promise((res) => setTimeout(res, 1500))]);
          return true;
        },
      },
    };

    return () => {
      ctrl.current = null;
      rendRef.current = null;
      applied.current.clear();
      book.destroy();
      host.innerHTML = "";
    };
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // tema, fonte e espaçamento
  useEffect(() => {
    const r = rendRef.current;
    if (!r) return;
    const c = PALETTE[settings.theme];
    r.themes.override("color", c.fg);
    r.themes.override("background", "transparent");
    r.themes.override("font-family", fontStack(settings.font));
    r.themes.override("line-height", String(settings.lineHeight));
    r.themes.fontSize(`${Math.round(settings.zoom * 100)}%`);
  });

  // destaques pintados no texto (só os criados por seleção têm intervalo CFI)
  useEffect(() => {
    const r = rendRef.current;
    if (!r) return;
    const want = new Map(marks.filter((m) => typeof m.loc === "string" && m.loc.includes(",")).map((m) => [m.id, m]));
    for (const [id, cfi] of applied.current) {
      if (!want.has(id)) {
        try { r.annotations.remove(cfi, "highlight"); } catch { /* já removido */ }
        applied.current.delete(id);
      }
    }
    for (const [id, m] of want) {
      if (applied.current.has(id)) continue;
      try {
        r.annotations.highlight(m.loc as string, {}, undefined, "rosi-hl", { fill: m.color, "fill-opacity": "0.35", "mix-blend-mode": "multiply" });
        applied.current.set(id, m.loc as string);
      } catch { /* CFI inválido */ }
    }
  }, [marks, data]);

  const c = PALETTE[settings.theme];
  return (
    <div className="epub-wrap">
      <div className="epub-paper" style={{ background: c.bg }}>
        <div ref={hostRef} className="epub-host" />
      </div>
    </div>
  );
}
