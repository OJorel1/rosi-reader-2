import { Fragment, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import type { MutableRefObject } from "react";
import type { Loc } from "../types";
import type { ReaderControls, SearchHit, TocItem } from "./ReaderTypes";
import { useTr } from "../lib/i18n";

interface Props {
  ctrl: MutableRefObject<ReaderControls | null>;
  tab: "sumario" | "busca";
  setTab(t: "sumario" | "busca"): void;
  onGo(loc: Loc): void;
  onClose(): void;
}

function Marked({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i"));
  return (
    <>
      {parts.map((p, i) => (p.toLowerCase() === q.toLowerCase() ? <mark key={i}>{p}</mark> : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}

export default function ReaderPanel({ ctrl, tab, setTab, onGo, onClose }: Props) {
  const [toc, setToc] = useState<TocItem[] | null>(null);
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const token = useRef({ cancel: false });
  const tr = useTr();

  useEffect(() => {
    ctrl.current?.getToc().then(setToc).catch(() => setToc([]));
    return () => {
      token.current.cancel = true;
    };
  }, [ctrl]);

  const run = async () => {
    const term = q.trim();
    if (term.length < 2 || !ctrl.current) return;
    token.current.cancel = true;
    const mine = (token.current = { cancel: false });
    setHits([]);
    setAsked(term);
    setBusy(true);
    await ctrl.current.search(term, (h) => setHits((a) => (a.length < 100 ? [...a, h] : a)), () => mine.cancel).catch(() => {});
    if (!mine.cancel) setBusy(false);
  };

  return (
    <aside className="rpanel glass" onMouseDown={(e) => e.stopPropagation()}>
      <header>
        <div className="seg">
          <button className={tab === "sumario" ? "on" : ""} onClick={() => setTab("sumario")}>{tr("reader.sumarioTab")}</button>
          <button className={tab === "busca" ? "on" : ""} onClick={() => setTab("busca")}>{tr("reader.buscarTab")}</button>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label={tr("common.fechar")}><X size={18} /></button>
      </header>

      {tab === "sumario" ? (
        <div className="rpanel-body">
          {toc === null && <p className="muted">{tr("reader.carregando")}</p>}
          {toc?.length === 0 && <p className="muted">{tr("reader.semSumario")}</p>}
          {toc?.map((t, i) => (
            <button key={i} className="toc-item" style={{ paddingLeft: 12 + t.depth * 16 }} onClick={() => onGo(t.loc)}>
              {t.label}
            </button>
          ))}
        </div>
      ) : (
        <>
          <form className="rpanel-search" onSubmit={(e) => { e.preventDefault(); run(); }}>
            <label className="search glass">
              <Search size={16} />
              <input autoFocus placeholder={tr("reader.buscarLivro")} value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          </form>
          <div className="rpanel-body">
            {!asked && <p className="muted">{tr("reader.digite2letras")}</p>}
            {asked && !busy && !hits.length && <p className="muted">{tr("reader.nadaEncontrado", { q: asked })}</p>}
            {hits.map((h, i) => (
              <button key={i} className="hit" onClick={() => onGo(h.loc)}>
                <span className="muted small">{h.label}</span>
                <span><Marked text={h.excerpt} q={asked} /></span>
              </button>
            ))}
            {busy && <p className="muted small">{tr("reader.buscando")}</p>}
          </div>
        </>
      )}
    </aside>
  );
}
