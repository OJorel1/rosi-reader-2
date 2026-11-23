import { useState } from "react";
import { Search, Plus, Trash2 } from "lucide-react";
import { useStore } from "../store";
import DictionaryDialog from "./DictionaryDialog";
import { useTr } from "../lib/i18n";

export default function Vocabulary() {
  const vocab = useStore((s) => s.vocab);
  const books = useStore((s) => s.books);
  const removeWord = useStore((s) => s.removeWord);
  const [q, setQ] = useState("");
  const [dict, setDict] = useState<{ word: string } | null>(null);
  const tr = useTr();

  const t = q.trim().toLowerCase();
  const list = vocab.filter((v) => !t || v.word.toLowerCase().includes(t) || v.meaning.toLowerCase().includes(t));

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{tr("catalog.titulo")}</h1>
          <p className="muted">{tr("catalog.sub")}</p>
        </div>
        <div className="head-tools">
          <label className="search glass">
            <Search size={16} />
            <input placeholder={tr("catalog.buscar")} value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <button className="btn primary" onClick={() => setDict({ word: "" })}><Plus size={16} /> {tr("catalog.consultarPalavra")}</button>
        </div>
      </header>

      {!vocab.length ? (
        <div className="empty-card glass">
          <p>{tr("catalog.vazio")}</p>
        </div>
      ) : !list.length ? (
        <p className="muted">{tr("catalog.nenhumEncontrado", { q })}</p>
      ) : (
        <div className="clip-grid">
          {list.map((v) => {
            const book = books.find((b) => b.id === v.bookId);
            return (
              <article key={v.id} className="clip glass word" style={{ ["--clip" as string]: "#a78bfa" }} onClick={() => setDict({ word: v.word })}>
                <h3>{v.word}</h3>
                <p className="word-meaning">{v.meaning}</p>
                <footer>
                  <span className="muted small clamp1">{book ? `${book.title}${v.pageLabel ? " · " + v.pageLabel : ""}` : tr("catalog.consultaAvulsa")}</span>
                  <button className="icon-btn" aria-label={tr("catalog.removerPalavra")} onClick={(e) => { e.stopPropagation(); removeWord(v.id); }}>
                    <Trash2 size={15} />
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      )}
      {dict && <DictionaryDialog initialWord={dict.word} onClose={() => setDict(null)} />}
    </>
  );
}
