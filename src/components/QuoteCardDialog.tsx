import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, Download, X } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { useStore } from "../store";
import type { Book, Clip } from "../types";
import { useTr } from "../lib/i18n";

const THEMES = [
  { name: "Roxo", a: "#2a1457", b: "#6d3df0", fg: "#ffffff", sub: "rgba(255,255,255,.7)" },
  { name: "Noite", a: "#0d0a1c", b: "#2b2250", fg: "#f2eefc", sub: "rgba(242,238,252,.65)" },
  { name: "Papel", a: "#f6f1e7", b: "#e6d8b8", fg: "#2a2433", sub: "rgba(42,36,51,.65)" },
  { name: "Pôr do sol", a: "#5b1d6e", b: "#f97362", fg: "#ffffff", sub: "rgba(255,255,255,.8)" },
];
const W = 1080, H = 1350;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const lines: string[] = [];
  for (const para of text.split(/\n+/)) {
    let line = "";
    for (const w of para.split(/\s+/)) {
      const t = line ? `${line} ${w}` : w;
      if (ctx.measureText(t).width > maxW && line) {
        lines.push(line);
        line = w;
      } else line = t;
    }
    if (line) lines.push(line);
  }
  return lines;
}

function draw(c: HTMLCanvasElement, clip: Clip, book: Book | undefined, t: (typeof THEMES)[number]) {
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, t.a);
  g.addColorStop(1, t.b);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = t.sub;
  ctx.font = "bold 260px Georgia, serif";
  ctx.fillText("“", 80, 340);

  const maxW = W - 220;
  const text = clip.text.length > 600 ? clip.text.slice(0, 597) + "…" : clip.text;
  let size = 68, lines: string[] = [];
  for (; size >= 30; size -= 4) {
    ctx.font = `${size}px Georgia, serif`;
    lines = wrap(ctx, text, maxW);
    if (lines.length * size * 1.4 <= 760) break;
  }
  ctx.fillStyle = t.fg;
  ctx.font = `${size}px Georgia, serif`;
  const blockH = lines.length * size * 1.4;
  let y = 400 + (760 - blockH) / 2 + size;
  for (const l of lines) {
    ctx.fillText(l, 110, y);
    y += size * 1.4;
  }

  ctx.fillStyle = t.sub;
  ctx.fillRect(110, 1130, 90, 4);
  ctx.fillStyle = t.fg;
  ctx.font = "bold 40px Inter, Segoe UI, sans-serif";
  ctx.fillText((book?.title ?? "").slice(0, 38), 110, 1196);
  ctx.fillStyle = t.sub;
  ctx.font = "34px Inter, Segoe UI, sans-serif";
  ctx.fillText(book?.author ?? "", 110, 1244);
  ctx.font = "28px Inter, Segoe UI, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("Rosi Reader", W - 110, 1290);
  ctx.textAlign = "left";
}

export default function QuoteCardDialog({ clip, onClose }: { clip: Clip; onClose(): void }) {
  const book = useStore((s) => s.books.find((b) => b.id === clip.bookId));
  const notify = useStore((s) => s.notify);
  const tr = useTr();
  const ref = useRef<HTMLCanvasElement>(null);
  const [ti, setTi] = useState(0);

  useEffect(() => {
    if (ref.current) draw(ref.current, clip, book, THEMES[ti]);
  }, [clip, book, ti]);

  const blob = () => new Promise<Blob>((res, rej) => ref.current!.toBlob((b) => (b ? res(b) : rej()), "image/png"));
  const saveImg = async () => {
    const path = await save({ defaultPath: "citacao.png", filters: [{ name: "Imagem PNG", extensions: ["png"] }] }).catch(() => "erro" as const);
    if (path === "erro") return notify(tr("quote.erroSalvarAqui"));
    if (!path) return;
    try {
      await writeFile(path, new Uint8Array(await (await blob()).arrayBuffer()));
      notify(tr("quote.imgSalva"));
    } catch {
      notify(tr("quote.naoConsigoSalvarImg"));
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": await blob() })]);
      notify(tr("quote.imgCopiada"));
    } catch {
      notify(tr("quote.naoConsigoCopiar"));
    }
  };

  // vai para o <body>: dentro do cartão do destaque (que tem efeito de vidro) o diálogo ficava preso e cortado
  return createPortal(
    <div className="modal-back" onMouseDown={onClose} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <div className="modal glass quote-modal" onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <h3>{tr("quote.titulo")}</h3>
          <button className="icon-btn" onClick={onClose} aria-label={tr("common.fechar")}><X size={18} /></button>
        </header>
        <canvas ref={ref} className="quote-canvas" />
        <div className="seg">{THEMES.map((t, i) => <button key={t.name} className={i === ti ? "on" : ""} onClick={() => setTi(i)}>{t.name}</button>)}</div>
        <footer>
          <button className="btn" onClick={copy}><Copy size={15} /> {tr("quote.copiar")}</button>
          <button className="btn primary" onClick={saveImg}><Download size={15} /> {tr("quote.salvarImagem")}</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
