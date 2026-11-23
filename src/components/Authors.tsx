import { useMemo, useState } from "react";
import { ArrowLeft, Camera, Heart, Pencil, Search, Trash2, X } from "lucide-react";
import { useStore } from "../store";
import { authorKey, groupAuthors, type AuthorGroup } from "../lib/authors";
import { imageToAvatar, pickImage } from "../lib/files";
import BookCard from "./BookCard";
import { useTr } from "../lib/i18n";

const hue = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 11);
const initials = (n: string) =>
  n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

export function Avatar({ name, photo, size }: { name: string; photo?: string; size: number }) {
  const h = hue(name);
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        background: photo ? undefined : `linear-gradient(155deg, hsl(${h} 50% 42%), hsl(${(h + 60) % 360} 55% 22%))`,
      }}
    >
      {photo ? <img src={photo} alt="" draggable={false} /> : initials(name)}
    </div>
  );
}

function usePhotoActions(key: string) {
  const setAuthorPhoto = useStore((s) => s.setAuthorPhoto);
  const notify = useStore((s) => s.notify);
  const tr = useTr();
  return {
    choose: async () => {
      const path = await pickImage();
      if (!path) return;
      try {
        setAuthorPhoto(key, await imageToAvatar(path));
      } catch (e) {
        console.error(e);
        notify(tr("photos.fotoNaoConsigo"));
      }
    },
    remove: () => setAuthorPhoto(key, undefined),
  };
}

function RenameAuthorDialog({ a, onClose }: { a: AuthorGroup; onClose(): void }) {
  const rename = useStore((s) => s.renameAuthor);
  const notify = useStore((s) => s.notify);
  const all = useStore((s) => s.books);
  const tr = useTr();
  const [name, setName] = useState(a.name);
  const save = () => {
    const n = name.trim();
    if (!n) return;
    const merging = n.toLowerCase() !== a.key && all.some((b) => authorKey(b.author) === authorKey(n));
    rename(a.key, n);
    notify(merging ? tr("authors.unido", { n }) : tr("authors.renomeado"));
    onClose();
  };
  // evita que cliques/Enter dentro do diálogo "vazem" para o cartão do autor
  return (
    <div className="modal-back" onMouseDown={onClose} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <div className="modal glass" onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <h3>{tr("authors.renomearAutor")}</h3>
          <button className="icon-btn" onClick={onClose} aria-label={tr("common.fechar")}><X size={18} /></button>
        </header>
        <label className="field">
          <span>{tr("authors.novoNome", { n: a.books.length, word: tr(a.books.length === 1 ? "data.livro" : "data.livros") })}</span>
          <input
            autoFocus
            className="text-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") onClose();
            }}
          />
        </label>
        <footer>
          <button className="btn ghost" onClick={onClose}>{tr("authors.cancelar")}</button>
          <button className="btn primary" onClick={save} disabled={!name.trim()}>{tr("authors.salvar")}</button>
        </footer>
      </div>
    </div>
  );
}

function AuthorCard({ a }: { a: AuthorGroup }) {
  const selectAuthor = useStore((s) => s.selectAuthor);
  const toggle = useStore((s) => s.toggleFavoriteAuthor);
  const photo = usePhotoActions(a.key);
  const tr = useTr();
  const [renaming, setRenaming] = useState(false);
  return (
    <article className="author" onClick={() => selectAuthor(a.key)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && selectAuthor(a.key)}>
      <div className="author-pic">
        <Avatar name={a.name} photo={a.photo} size={112} />
        <div className="book-actions">
          <button
            className={`icon-btn${a.favorite ? " fav" : ""}`}
            aria-label={a.favorite ? tr("authors.removerFavoritos") : tr("authors.favoritarAutor")}
            onClick={(e) => { e.stopPropagation(); toggle(a.key); }}
          >
            <Heart size={16} fill={a.favorite ? "currentColor" : "none"} />
          </button>
          <button className="icon-btn" aria-label={tr("authors.renomearAutor")} title={tr("authors.renomearAutor")} onClick={(e) => { e.stopPropagation(); setRenaming(true); }}>
            <Pencil size={16} />
          </button>
          <button className="icon-btn" aria-label={tr("authors.adicionarFoto")} title={tr("authors.fotoTitulo")} onClick={(e) => { e.stopPropagation(); photo.choose(); }}>
            <Camera size={16} />
          </button>
        </div>
      </div>
      <h4 className="clamp">{a.name}</h4>
      <p className="muted small">{a.books.length} {tr(a.books.length === 1 ? "data.livro" : "data.livros")}</p>
      {renaming && <RenameAuthorDialog a={a} onClose={() => setRenaming(false)} />}
    </article>
  );
}

function AuthorDetail({ a }: { a: AuthorGroup }) {
  const selectAuthor = useStore((s) => s.selectAuthor);
  const toggle = useStore((s) => s.toggleFavoriteAuthor);
  const photo = usePhotoActions(a.key);
  const tr = useTr();
  const [renaming, setRenaming] = useState(false);
  const booksWord = tr(a.books.length === 1 ? "data.livro" : "data.livros");
  return (
    <>
      <button className="back link" onClick={() => selectAuthor(null)}>
        <ArrowLeft size={16} /> {tr("authors.voltarAutores")}
      </button>
      <div className="author-hero">
        <Avatar name={a.name} photo={a.photo} size={132} />
        <div className="grow">
          <h1>{a.name}</h1>
          <p className="muted">{tr("authors.naBiblioteca", { n: a.books.length, word: booksWord })}</p>
          <div className="hero-actions">
            <button className={`btn${a.favorite ? " primary" : ""}`} onClick={() => toggle(a.key)}>
              <Heart size={16} fill={a.favorite ? "currentColor" : "none"} /> {a.favorite ? tr("authors.favorito") : tr("authors.favoritarAutor")}
            </button>
            <button className="btn" onClick={() => setRenaming(true)}>
              <Pencil size={16} /> {tr("authors.renomear")}
            </button>
            <button className="btn" onClick={photo.choose}>
              <Camera size={16} /> {a.photo ? tr("authors.trocarFoto") : tr("authors.adicionarFoto")}
            </button>
            {a.photo && (
              <button className="btn ghost" onClick={photo.remove}>
                <Trash2 size={16} /> {tr("authors.removerFoto")}
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="grid">{a.books.map((b) => <BookCard key={b.id} book={b} />)}</div>
      {renaming && <RenameAuthorDialog a={a} onClose={() => setRenaming(false)} />}
    </>
  );
}

export default function AuthorsPage() {
  const books = useStore((s) => s.books);
  const meta = useStore((s) => s.authors);
  const selected = useStore((s) => s.selectedAuthor);
  const tr = useTr();
  const [q, setQ] = useState("");

  const all = useMemo(() => groupAuthors(books, meta), [books, meta]);
  const current = selected ? all.find((a) => a.key === selected) : undefined;
  if (current) return <AuthorDetail a={current} />;

  const t = q.trim().toLowerCase();
  const list = all.filter((a) => !t || a.name.toLowerCase().includes(t));
  const favorites = all.filter((a) => a.favorite);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{tr("authors.titulo")}</h1>
          <p className="muted">{tr("authors.sub")}</p>
        </div>
        <label className="search glass">
          <Search size={16} />
          <input placeholder={tr("authors.buscar")} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </header>

      {!all.length ? (
        <div className="empty-card glass"><p>{tr("authors.vazio")}</p></div>
      ) : (
        <>
          <section>
            <h2>{tr("authors.favoritosTitulo")}</h2>
            {favorites.length ? (
              <div className="author-row">{favorites.map((a) => <AuthorCard key={a.key} a={a} />)}</div>
            ) : (
              <p className="muted">{tr("authors.favoritosVazios")}</p>
            )}
          </section>
          <section>
            <h2>{tr("authors.todosTitulo")}</h2>
            {list.length ? (
              <div className="author-row wrap">{list.map((a) => <AuthorCard key={a.key} a={a} />)}</div>
            ) : (
              <p className="muted">{tr("authors.nenhumEncontrado", { q })}</p>
            )}
          </section>
        </>
      )}
    </>
  );
}
