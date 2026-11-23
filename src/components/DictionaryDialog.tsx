import { useEffect, useRef, useState } from "react";
import { BookmarkPlus, Check, Search, X } from "lucide-react";
import { useStore } from "../store";
import { langOf } from "../lib/i18n";
import { cleanWord, lookup, type DictResult } from "../lib/dictionary";
import { useTr } from "../lib/i18n";

type State =
  | { s: "idle" }
  | { s: "loading" }
  | { s: "ok"; data: DictResult }
  | { s: "none"; word: string }
  | { s: "error" };

interface Props {
  initialWord?: string;
  bookId?: string;
  pageLabel?: string;
  onClose(): void;
}

export default function DictionaryDialog({ initialWord = "", bookId, pageLabel, onClose }: Props) {
  const vocab = useStore((s) => s.vocab);
  const addWord = useStore((s) => s.addWord);
  const notify = useStore((s) => s.notify);
  const tr = useTr();
  const [q, setQ] = useState(initialWord.trim());
  const [state, setState] = useState<State>({ s: "idle" });
  const seq = useRef(0);

  const run = async (raw: string) => {
    const word = cleanWord(raw);
    if (!word) return;
    const id = ++seq.current;
    setState({ s: "loading" });
    try {
      const data = await lookup(word, langOf());
      if (id !== seq.current) return;
      setState(data ? { s: "ok", data } : { s: "none", word });
    } catch {
      if (id === seq.current) setState({ s: "error" });
    }
  };

  useEffect(() => {
    if (initialWord.trim()) run(initialWord);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saved = state.s === "ok" && vocab.some((v) => v.word.toLowerCase() === state.data.word.toLowerCase());
  const save = () => {
    if (state.s !== "ok" || saved) return;
    const first = state.data.entries[0]?.defs[0] ?? "";
    addWord({
      word: state.data.word,
      meaning: first.length > 160 ? first.slice(0, 157) + "…" : first,
      bookId,
      pageLabel,
    });
    notify(tr("dict.salvo"));
  };

  // dentro do leitor, o Esc/setas não devem agir sobre o livro
  return (
    <div className="modal-back" onMouseDown={onClose} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <div className="modal glass dict" onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <h3>{tr("dict.titulo")}</h3>
          <button className="icon-btn" onClick={onClose} aria-label={tr("common.fechar")}><X size={18} /></button>
        </header>

        <form className="dict-search" onSubmit={(e) => { e.preventDefault(); run(q); }}>
          <label className="search glass">
            <Search size={16} />
            <input
              autoFocus
              placeholder={tr("dict.placeholder")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && onClose()}
            />
          </label>
          <button className="btn primary" type="submit" disabled={!cleanWord(q)}>{tr("dict.buscar")}</button>
        </form>

        <div className="dict-body">
          {state.s === "idle" && <p className="muted">{tr("dict.digiteAqui")}</p>}
          {state.s === "loading" && <p className="muted">{tr("dict.buscando")}</p>}
          {state.s === "none" && <p className="muted">{tr("dict.naoEncontrado", { word: state.word })}</p>}
          {state.s === "error" && <p className="muted">{tr("dict.erroOffline")}</p>}
          {state.s === "ok" && (
            <>
              <div className="dict-title">
                <h2>{state.data.word}</h2>
                <button className={`btn sm${saved ? "" : " primary"}`} onClick={save} disabled={saved}>
                  {saved ? <><Check size={14} /> {tr("dict.noVocabulario")}</> : <><BookmarkPlus size={14} /> {tr("dict.salvarPalavra")}</>}
                </button>
              </div>
              {state.data.entries.map((en, i) => (
                <section key={i} className="dict-entry">
                  {en.pos && <span className="chip">{en.pos}</span>}
                  <ol>{en.defs.map((d, j) => <li key={j}>{d}</li>)}</ol>
                </section>
              ))}
              <p className="muted small">{tr("dict.fonte", { source: state.data.source })}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
