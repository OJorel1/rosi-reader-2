import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, BookA, Bookmark as BookmarkIcon, ChevronLeft, ChevronRight, Highlighter, ListTree,
  MousePointer2, Quote, Square, Type, Volume2, X, ZoomIn, ZoomOut,
} from "lucide-react";
import { useStore } from "../store";
import { readBookFile } from "../lib/files";
import { toEpub } from "../lib/convert";
import { fontOptions } from "../lib/fonts";
import { isAndroid } from "../lib/platform";
import { chunkText, hasTts, langVoices, speak } from "../lib/tts";
import { useTr } from "../lib/i18n";
import type { Loc, Rect, Settings } from "../types";
import PdfReader from "./PdfReader";
import EpubReader from "./EpubReader";
import ClipDialog from "./ClipDialog";
import DictionaryDialog from "./DictionaryDialog";
import ReaderPanel from "./ReaderPanel";
import type { Mark, ReaderControls } from "./ReaderTypes";

const THEMES = [
  ["papel", "settings.temaPapel"],
  ["sepia", "settings.temaSepia"],
  ["noite", "settings.temaNoite"],
] as const;

function useTts(ctrl: React.MutableRefObject<ReaderControls | null>, settings: Settings, notify: (m: string) => void) {
  const tr = useTr();
  const [speaking, setSpeaking] = useState(false);
  const run = useRef(0);
  const cfg = useRef(settings);
  cfg.current = settings;

  const stop = useCallback(() => {
    run.current++;
    if (hasTts) speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const start = useCallback(async () => {
    const c = ctrl.current;
    if (!c || !hasTts) return;
    if (!isAndroid && !speechSynthesis.getVoices().length) {
      notify(tr("reader.vozNaoEncontrada"));
      return;
    }
    const id = ++run.current;
    setSpeaking(true);
    let empty = 0;
    let fails = 0;
    try {
      while (run.current === id) {
        const chunks = chunkText(await c.speech.read());
        if (!chunks.length) {
          if (++empty >= 3) {
            notify(tr("reader.semTextoParaLer"));
            break;
          }
        } else {
          empty = 0;
          for (const ch of chunks) {
            if (run.current !== id) return;
            const ok = await speak(ch, cfg.current.ttsVoice, cfg.current.ttsRate, cfg.current.lang);
            if (!ok && ++fails >= 2) {
              notify(tr("reader.falhaFalar"));
              stop();
              return;
            }
            if (ok) fails = 0;
          }
        }
        if (run.current !== id) return;
        if (!(await c.speech.advance())) break;
      }
    } finally {
      if (run.current === id) setSpeaking(false);
    }
  }, [ctrl, notify, stop, tr]);

  useEffect(() => stop, [stop]);
  return { speaking, start, stop };
}

export default function ReaderShell() {
  const book = useStore((s) => s.books.find((b) => b.id === s.openBookId));
  const startAt = useStore((s) => s.startAt);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const updateBook = useStore((s) => s.updateBook);
  const openBook = useStore((s) => s.openBook);
  const bookmarks = useStore((s) => s.bookmarks);
  const clips = useStore((s) => s.clips);
  const addBookmark = useStore((s) => s.addBookmark);
  const removeBookmark = useStore((s) => s.removeBookmark);
  const addReading = useStore((s) => s.addReading);
  const notify = useStore((s) => s.notify);
  const tr = useTr();

  const [data, setData] = useState<Uint8Array | null>(null);
  const [error, setError] = useState("");
  const [here, setHere] = useState<{ loc: Loc; progress: number; label: string } | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [picked, setPicked] = useState<{ text: string; loc: Loc; label: string; rects?: Rect[] } | null>(null);
  const [dialog, setDialog] = useState<{ kind: "trecho" | "destaque"; text: string; loc: Loc; label: string; rects?: Rect[] } | null>(null);
  const [panel, setPanel] = useState(false);
  const [side, setSide] = useState<null | "sumario" | "busca">(null);
  const [dict, setDict] = useState<{ word: string; label: string } | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const ctrl = useRef<ReaderControls | null>(null);
  const pages = useRef(0);
  const lastLoc = useRef<Loc | null>(null);
  const tts = useTts(ctrl, settings, notify);

  const start = useMemo<Loc>(() => startAt ?? book?.location ?? 1, []); // eslint-disable-line react-hooks/exhaustive-deps

  // destaques e trechos do livro, pintados no texto
  const marks = useMemo<Mark[]>(
    () =>
      clips
        .filter((c) => c.bookId === book?.id && (c.rects?.length || (typeof c.location === "string" && c.location.includes(","))))
        .map((c) => ({ id: c.id, color: c.color, loc: c.location, page: typeof c.location === "number" ? c.location : undefined, rects: c.rects })),
    [clips, book?.id],
  );

  // abre o arquivo (formatos que não são PDF/EPUB são convertidos na hora)
  useEffect(() => {
    if (!book) return;
    updateBook(book.id, { lastOpenedAt: Date.now() });
    readBookFile(book.path)
      .then(async (raw) => {
        if (book.format === "pdf" || book.format === "epub") return setData(raw);
        const c = await toEpub(book.format, raw, book.path.split(/[\\/]/).pop() ?? "livro", settings.lang);
        setData(c.epub);
      })
      .catch((e) => {
        console.error(e);
        setError(tr("reader.erroAbrir"));
      });
  }, [book?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!data || startAt == null) return;
    const t = setTimeout(() => ctrl.current?.goTo(startAt), 500);
    return () => clearTimeout(t);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // estatísticas: conta o tempo lido (janela em foco) e as páginas viradas
  useEffect(() => {
    const t = setInterval(() => {
      if (document.hidden || !document.hasFocus()) return;
      const p = pages.current;
      pages.current = 0;
      addReading(5, p);
    }, 5000);
    return () => clearTimeout(t);
  }, [addReading]);

  useEffect(() => {
    if (!hasTts) return;
    const load = () => setVoices(langVoices(settings.lang));
    load();
    speechSynthesis.addEventListener("voiceschanged", load);
    return () => speechSynthesis.removeEventListener("voiceschanged", load);
  }, [settings.lang]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setSide("busca");
        return;
      }
      if ((e.target as HTMLElement).closest("textarea,input,select")) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") ctrl.current?.next();
      if (e.key === "ArrowLeft" || e.key === "PageUp") ctrl.current?.prev();
      if (e.key === "Escape") {
        if (dict) setDict(null);
        else if (dialog) setDialog(null);
        else if (side) setSide(null);
        else openBook(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog, dict, side, openBook]);

  if (!book) return null;

  const marked = here ? bookmarks.find((b) => b.bookId === book.id && b.location === here.loc) : undefined;
  const toggleBookmark = () => {
    if (!here) return;
    if (marked) {
      removeBookmark(marked.id);
      notify(tr("reader.marcadorRemovido"));
    } else {
      addBookmark({ bookId: book.id, location: here.loc, label: here.label });
      notify(tr("reader.marcadorSalvo"));
    }
  };

  const props = {
    data: data!,
    start,
    settings,
    ctrl,
    selectMode,
    marks,
    onRelocate: (loc: Loc, progress: number, label: string) => {
      if (lastLoc.current !== null && lastLoc.current !== loc) pages.current += 1;
      lastLoc.current = loc;
      setHere({ loc, progress, label });
      updateBook(book.id, { location: loc, progress });
    },
    onSelection: (text: string, loc: Loc, label: string, extra?: { rects?: Rect[] }) =>
      setPicked({ text, loc, label, rects: extra?.rects }),
  };

  const openDialog = (kind: "trecho" | "destaque") => {
    setDialog({
      kind,
      text: picked?.text ?? "",
      loc: picked?.loc ?? here?.loc ?? book.location,
      label: picked?.label ?? here?.label ?? "",
      rects: picked?.rects,
    });
    setPicked(null);
  };

  return (
    <div className={`reader theme-${settings.theme} fmt-${book.format}`}>
      <div className="warm" style={{ opacity: settings.warm }} />
      <header className="reader-bar glass">
        <button className="icon-btn" onClick={() => openBook(null)} aria-label={tr("reader.voltarAria")} title={tr("reader.voltarTitulo")}>
          <ArrowLeft size={19} />
        </button>
        <div className="reader-title">
          <strong>{book.title}</strong>
          <span className="muted small">{book.author}</span>
        </div>
        <div className="spacer" />

        <div className="zoom">
          <button className="icon-btn" onClick={() => setSettings({ zoom: Math.max(0.6, +(settings.zoom - 0.1).toFixed(1)) })} aria-label={tr("reader.diminuirZoom")}>
            <ZoomOut size={17} />
          </button>
          <span>{Math.round(settings.zoom * 100)}%</span>
          <button className="icon-btn" onClick={() => setSettings({ zoom: Math.min(2.4, +(settings.zoom + 0.1).toFixed(1)) })} aria-label={tr("reader.aumentarZoom")}>
            <ZoomIn size={17} />
          </button>
        </div>

        <button className={`icon-btn${side ? " on" : ""}`} onClick={() => setSide(side ? null : "sumario")} title={tr("reader.sumarioAria")} aria-label={tr("reader.sumarioAria")}>
          <ListTree size={18} />
        </button>

        <div className="pop-wrap">
          <button className={`icon-btn${panel ? " on" : ""}`} onClick={() => setPanel(!panel)} aria-label={tr("reader.opcoesAria")} title={tr("reader.opcoesLeitura")}>
            <Type size={18} />
          </button>
          {panel && (
            <div className="popover glass">
              <h4>{tr("reader.opcoesLeitura")}</h4>
              <div className="opt">
                <span>{tr("reader.tema")}</span>
                <div className="seg">
                  {THEMES.map(([k, key]) => (
                    <button key={k} className={settings.theme === k ? "on" : ""} onClick={() => setSettings({ theme: k })}>{tr(key)}</button>
                  ))}
                </div>
              </div>
              <div className="opt">
                <span>{tr("reader.fonte")}</span>
                <select value={settings.font} onChange={(e) => setSettings({ font: e.target.value })}>
                  {fontOptions().map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div className="opt">
                <span>{tr("reader.espacamento")}</span>
                <div className="seg">
                  {[1.4, 1.6, 1.9].map((v) => (
                    <button key={v} className={settings.lineHeight === v ? "on" : ""} onClick={() => setSettings({ lineHeight: v })}>
                      {v === 1.4 ? tr("reader.compacto") : v === 1.6 ? tr("reader.normal") : tr("reader.amplo")}
                    </button>
                  ))}
                </div>
              </div>
              <div className="opt">
                <span>{tr("reader.luzQuente")}</span>
                <input type="range" min={0} max={0.5} step={0.05} value={settings.warm} onChange={(e) => setSettings({ warm: +e.target.value })} />
              </div>
              {hasTts && (
                <>
                  <div className="opt">
                    <span>{tr("reader.voz")}</span>
                    <select value={settings.ttsVoice ?? ""} onChange={(e) => setSettings({ ttsVoice: e.target.value || undefined })}>
                      <option value="">{tr("reader.vozPadrao")}</option>
                      {voices.map((v) => <option key={v.name} value={v.name}>{v.name.replace(/^Microsoft /, "")}</option>)}
                    </select>
                  </div>
                  <div className="opt">
                    <span>{tr("reader.velocidade", { rate: settings.ttsRate.toFixed(1) })}</span>
                    <input type="range" min={0.6} max={1.8} step={0.1} value={settings.ttsRate} onChange={(e) => setSettings({ ttsRate: +e.target.value })} />
                  </div>
                </>
              )}
              {book.format === "pdf" && <p className="muted small">{tr("reader.notaPDF")}</p>}
            </div>
          )}
        </div>

        <button className="icon-btn" onClick={() => setDict({ word: "", label: here?.label ?? "" })} title={tr("reader.dictAria")} aria-label={tr("reader.dictAria")}>
          <BookA size={18} />
        </button>
        <button className={`icon-btn${selectMode ? " on" : ""}`} onClick={() => setSelectMode(!selectMode)} title={tr("reader.selTitulo")} aria-label={tr("reader.selAria")}>
          <MousePointer2 size={18} />
        </button>
        <button className={`icon-btn${marked ? " on" : ""}`} onClick={toggleBookmark} title={tr("reader.marcarAria")} aria-label={tr("reader.marcarAria")}>
          <BookmarkIcon size={18} fill={marked ? "currentColor" : "none"} />
        </button>
        <button className="icon-btn" onClick={() => openDialog("trecho")} title={tr("reader.trechoAria")} aria-label={tr("reader.trechoAria")}>
          <Quote size={18} />
        </button>
        <button className="icon-btn" onClick={() => openDialog("destaque")} title={tr("reader.destaqueAria")} aria-label={tr("reader.destaqueAria")}>
          <Highlighter size={18} />
        </button>
        {hasTts && (
          <button
            className={`icon-btn${tts.speaking ? " on" : ""}`}
            onClick={() => (tts.speaking ? tts.stop() : tts.start())}
            title={tts.speaking ? tr("reader.pararVozAria") : tr("reader.lerVozAria")}
            aria-label={tr("reader.lerVozAria")}
          >
            {tts.speaking ? <Square size={16} fill="currentColor" /> : <Volume2 size={18} />}
          </button>
        )}
      </header>

      <div className="reader-stage" onMouseDown={() => panel && setPanel(false)}>
        {error ? (
          <p className="empty">{error}</p>
        ) : !data ? (
          <p className="empty">{tr("reader.abrindo")}</p>
        ) : book.format === "pdf" ? (
          <PdfReader {...props} />
        ) : (
          <EpubReader {...props} />
        )}

        {side && data && (
          <ReaderPanel ctrl={ctrl} tab={side} setTab={setSide} onGo={(l) => ctrl.current?.goTo(l)} onClose={() => setSide(null)} />
        )}

        {picked && (
          <div className="pick glass">
            <span className="clamp">“{picked.text.slice(0, 90)}{picked.text.length > 90 ? "…" : ""}”</span>
            {picked.text.trim().split(/\s+/).length <= 3 && (
              <button className="btn primary sm" onClick={() => { setDict({ word: picked.text, label: picked.label }); setPicked(null); }}>{tr("reader.significado")}</button>
            )}
            <button className="btn sm" onClick={() => openDialog("trecho")}>{tr("reader.trechoAria")}</button>
            <button className="btn sm" onClick={() => openDialog("destaque")}>{tr("reader.destacar")}</button>
            <button className="icon-btn" onClick={() => setPicked(null)} aria-label={tr("common.fechar")}><X size={16} /></button>
          </div>
        )}
      </div>

      <footer className="reader-foot glass">
        <button className="icon-btn" onClick={() => ctrl.current?.prev()} aria-label={tr("reader.paginaAnt")}><ChevronLeft size={20} /></button>
        <div className="track"><i style={{ width: `${Math.round((here?.progress ?? book.progress) * 100)}%` }} /></div>
        <span className="small muted">{here?.label ?? ""}</span>
        <button className="icon-btn" onClick={() => ctrl.current?.next()} aria-label={tr("reader.paginaProx")}><ChevronRight size={20} /></button>
      </footer>

      {dict && <DictionaryDialog initialWord={dict.word} bookId={book.id} pageLabel={dict.label} onClose={() => setDict(null)} />}
      {dialog && (
        <ClipDialog kind={dialog.kind} bookId={book.id} text={dialog.text} location={dialog.loc} pageLabel={dialog.label} rects={dialog.rects} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}
