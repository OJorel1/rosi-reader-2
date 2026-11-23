import { useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, ChevronLeft, ImageDown, Pencil, ChevronRight, LayoutGrid, List, Plus, Search, Trash2 } from "lucide-react";
import { useStore } from "../store";
import type { Book, Clip } from "../types";
import BookCard from "./BookCard";
import Cover from "./Cover";
import { Avatar } from "./Authors";
import ProfileDialog from "./ProfileDialog";
import QuoteCardDialog from "./QuoteCardDialog";
import { useTr } from "../lib/i18n";

function Header({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {children}
    </header>
  );
}

function Empty({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="empty-card glass">
      <p>{text}</p>
      {action}
    </div>
  );
}

function Rail({ books }: { books: Book[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [arrows, setArrows] = useState({ left: false, right: false });
  const tr = useTr();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setArrows({
        left: el.scrollLeft > 4,
        right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
      });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [books.length]);

  const go = (d: number) => ref.current?.scrollBy({ left: d * 480, behavior: "smooth" });
  return (
    <div className="rail-wrap">
      {arrows.left && (
        <button className="rail-btn l" onClick={() => go(-1)} aria-label={tr("home.anteriorAria")}><ChevronLeft size={20} /></button>
      )}
      <div className="rail" ref={ref}>
        {books.map((b) => <BookCard key={b.id} book={b} />)}
      </div>
      {arrows.right && (
        <button className="rail-btn r" onClick={() => go(1)} aria-label={tr("home.proximoAria")}><ChevronRight size={20} /></button>
      )}
    </div>
  );
}

function ClipCard({ clip }: { clip: Clip }) {
  const book = useStore((s) => s.books.find((b) => b.id === clip.bookId));
  const openBook = useStore((s) => s.openBook);
  const removeClip = useStore((s) => s.removeClip);
  const profile = useStore((s) => s.profile);
  const tr = useTr();
  const me = profile.name || tr("common.voce");
  const [card, setCard] = useState(false);
  return (
    <article className="clip glass" style={{ ["--clip" as string]: clip.color }} onClick={() => book && openBook(book.id, clip.location)}>
      <p className="clip-text">“{clip.text}”</p>
      {clip.note && (
        <div className="opinion">
          <Avatar name={me} photo={profile.photo} size={34} />
          <div>
            <strong>{me}</strong>
            <p>{clip.note}</p>
          </div>
        </div>
      )}
      <footer>
        <span className="muted small clamp1">{book?.title ?? tr("clips.livroRemovido")} · {clip.pageLabel}</span>
        <button className="icon-btn" aria-label={tr("clips.gerarCartao")} title={tr("clips.cartaoTitulo")} onClick={(e) => { e.stopPropagation(); setCard(true); }}>
          <ImageDown size={15} />
        </button>
        <button className="icon-btn" aria-label={tr("clips.apagar")} onClick={(e) => { e.stopPropagation(); removeClip(clip.id); }}>
          <Trash2 size={15} />
        </button>
      </footer>
      {card && <QuoteCardDialog clip={clip} onClose={() => setCard(false)} />}
    </article>
  );
}

export function Home({ onAdd }: { onAdd(): void }) {
  const books = useStore((s) => s.books);
  const tr = useTr();
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return books.filter((b) => !t || b.title.toLowerCase().includes(t) || b.author.toLowerCase().includes(t));
  }, [books, q]);
  const reading = [...list].filter((b) => b.lastOpenedAt && b.progress < 1).sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0));
  const recent = [...list].sort((a, b) => b.addedAt - a.addedAt);

  return (
    <>
      <Header title={tr("home.titulo")} sub={tr("home.sub")}>
        <label className="search glass">
          <Search size={16} />
          <input placeholder={tr("home.buscarLivros")} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </Header>

      {!books.length ? (
        <Empty
          text={tr("home.estanteVazia")}
          action={<button className="btn primary" onClick={onAdd}><Plus size={16} /> {tr("home.adicionarLivro")}</button>}
        />
      ) : (
        <>
          {reading.length > 0 && (
            <section>
              <h2>{tr("home.continueLendo")}</h2>
              <Rail books={reading} />
            </section>
          )}
          <section>
            <h2>{tr("home.adicionadosRecentes")}</h2>
            {recent.length ? <Rail books={recent} /> : <p className="muted">{tr("home.nenhumEncontrado", { q })}</p>}
          </section>
        </>
      )}
    </>
  );
}

export function Library({ onlyFavorites }: { onlyFavorites?: boolean }) {
  const books = useStore((s) => s.books);
  const [mode, setMode] = useState<"grid" | "list">("grid");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"recentes" | "titulo" | "autor" | "progresso">("recentes");
  const openBook = useStore((s) => s.openBook);
  const tr = useTr();
  const list = books.filter((b) => (!onlyFavorites || b.favorite) && (!q.trim() || (b.title + b.author).toLowerCase().includes(q.trim().toLowerCase()))).sort((a, b) =>
    sort === "titulo" ? a.title.localeCompare(b.title, "pt-BR") : sort === "autor" ? a.author.localeCompare(b.author, "pt-BR") : sort === "progresso" ? b.progress - a.progress : b.addedAt - a.addedAt);
  return (
    <>
      <Header
        title={tr(onlyFavorites ? "home.favoritosTitulo" : "home.livrosTitulo")}
        sub={onlyFavorites ? tr("home.favoritosSub") : tr("home.subBiblioteca", { n: books.length })}
      >
        <div className="head-tools">
          <label className="search glass"><Search size={16} /><input placeholder={tr("home.buscar")} value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label={tr("home.ordenarAria")}>
            <option value="recentes">{tr("home.ordemRecentes")}</option>
            <option value="titulo">{tr("home.ordemTitulo")}</option>
            <option value="autor">{tr("home.ordemAutor")}</option>
            <option value="progresso">{tr("home.ordemProgresso")}</option>
          </select>
          <div className="seg glass">
            <button className={mode === "grid" ? "on" : ""} onClick={() => setMode("grid")} aria-label={tr("home.gradeAria")}><LayoutGrid size={16} /></button>
            <button className={mode === "list" ? "on" : ""} onClick={() => setMode("list")} aria-label={tr("home.listaAria")}><List size={16} /></button>
          </div>
        </div>
      </Header>
      {!list.length ? (
        <Empty text={tr(onlyFavorites ? "library.favoritosVazios" : "library.livrosVazios")} />
      ) : mode === "grid" ? (
        <div className="grid">{list.map((b) => <BookCard key={b.id} book={b} />)}</div>
      ) : (
        <div className="rows">
          {list.map((b) => (
            <button key={b.id} className="row-item glass" onClick={() => openBook(b.id)}>
              <div className="mini"><Cover book={b} /></div>
              <div className="grow"><strong>{b.title}</strong><span className="muted small">{b.author} · {b.format.toUpperCase()}</span></div>
              <span className="muted small">{Math.round(b.progress * 100)}%</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export function Clips({ kind }: { kind: "trecho" | "destaque" }) {
  const clips = useStore((s) => s.clips.filter((c) => c.kind === kind));
  const trecho = kind === "trecho";
  const profile = useStore((s) => s.profile);
  const tr = useTr();
  const [editing, setEditing] = useState(false);
  return (
    <>
      <Header title={tr(trecho ? "clips.tituloTrecho" : "clips.tituloDestaque")} sub={tr(trecho ? "clips.subTrecho" : "clips.subDestaque")}>
        {!trecho && (
          <button className="profile-chip glass" onClick={() => setEditing(true)} title={tr("clips.editarPerfil")}>
            <Avatar name={profile.name || tr("common.voce")} photo={profile.photo} size={36} />
            <span>{profile.name || tr("clips.adicionarNomeFoto")}</span>
            <Pencil size={14} />
          </button>
        )}
      </Header>
      {editing && <ProfileDialog onClose={() => setEditing(false)} />}
      {!clips.length ? (
        <Empty text={tr(trecho ? "clips.vazioTrecho" : "clips.vazioDestaque")} />
      ) : (
        <div className="clip-grid">{clips.map((c) => <ClipCard key={c.id} clip={c} />)}</div>
      )}
    </>
  );
}

export function Bookmarks() {
  const bookmarks = useStore((s) => s.bookmarks);
  const books = useStore((s) => s.books);
  const openBook = useStore((s) => s.openBook);
  const remove = useStore((s) => s.removeBookmark);
  const tr = useTr();
  return (
    <>
      <Header title={tr("bookmarks.titulo")} sub={tr("bookmarks.sub")} />
      {!bookmarks.length ? (
        <Empty text={tr("bookmarks.vazio")} />
      ) : (
        <div className="rows">
          {bookmarks.map((m) => {
            const b = books.find((x) => x.id === m.bookId);
            if (!b) return null;
            return (
              <div key={m.id} className="row-item glass" onClick={() => openBook(b.id, m.location)} role="button" tabIndex={0}>
                <div className="mini"><Cover book={b} /></div>
                <div className="grow"><strong>{b.title}</strong><span className="muted small">{b.author}</span></div>
                <span className="chip"><Bookmark size={13} /> {m.label}</span>
                <button className="icon-btn" aria-label={tr("clips.apagar")} onClick={(e) => { e.stopPropagation(); remove(m.id); }}><Trash2 size={15} /></button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
