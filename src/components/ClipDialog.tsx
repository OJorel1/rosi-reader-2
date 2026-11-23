import { useState } from "react";
import { X } from "lucide-react";
import { useStore } from "../store";
import type { Loc, Rect } from "../types";
import { useTr } from "../lib/i18n";

const COLORS = ["#facc15", "#a78bfa", "#f472b6", "#34d399"];

interface Props {
  kind: "trecho" | "destaque";
  bookId: string;
  text: string;
  location: Loc;
  pageLabel: string;
  rects?: Rect[];
  onClose(): void;
}

export default function ClipDialog({ kind, bookId, text: initial, location, pageLabel, rects, onClose }: Props) {
  const addClip = useStore((s) => s.addClip);
  const notify = useStore((s) => s.notify);
  const tr = useTr();
  const [text, setText] = useState(initial);
  const [note, setNote] = useState("");
  const [color, setColor] = useState(COLORS[0]);

  const save = () => {
    if (!text.trim()) return;
    addClip({ bookId, kind, text: text.trim(), note: note.trim() || undefined, color, location, pageLabel, rects: rects?.length ? rects : undefined });
    notify(kind === "trecho" ? tr("clip.trechoSalvo") : tr("clip.destaqueSalvo"));
    onClose();
  };

  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className="modal glass" onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <h3>{tr(kind === "trecho" ? "clip.salvarTrecho" : "clip.criarDestaque")}</h3>
          <button className="icon-btn" onClick={onClose} aria-label={tr("common.fechar")}>
            <X size={18} />
          </button>
        </header>
        <label className="field">
          <span>{tr(kind === "trecho" ? "clip.fraseOuPensamento" : "clip.textoDestacado")}</span>
          <textarea
            autoFocus
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={tr("clip.placeholder")}
          />
        </label>
        {kind === "destaque" && (
          <label className="field">
            <span>{tr("clip.anotacao")}</span>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        )}
        <div className="row">
          <div className="swatches">
            {COLORS.map((c) => (
              <button
                key={c}
                className={c === color ? "on" : ""}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={tr("clip.cor", { c })}
              />
            ))}
          </div>
          <span className="muted small">{pageLabel}</span>
        </div>
        <footer>
          <button className="btn ghost" onClick={onClose}>
            {tr("clip.cancelar")}
          </button>
          <button className="btn primary" onClick={save} disabled={!text.trim()}>
            {tr("clip.salvar")}
          </button>
        </footer>
      </div>
    </div>
  );
}
