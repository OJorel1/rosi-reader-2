import { useState } from "react";
import { Heart, Settings2, Trash2 } from "lucide-react";
import { remove } from "@tauri-apps/plugin-fs";
import { useStore } from "../store";
import type { Book } from "../types";
import Cover from "./Cover";
import BookDetailsDialog from "./BookDetailsDialog";
import { statusOf } from "../lib/books";
import { useTr } from "../lib/i18n";

export default function BookCard({ book }: { book: Book }) {
  const openBook = useStore((s) => s.openBook);
  const toggleFavorite = useStore((s) => s.toggleFavorite);
  const removeBook = useStore((s) => s.removeBook);
  const notify = useStore((s) => s.notify);
  const tr = useTr();
  const pct = Math.round(book.progress * 100);
  const [editing, setEditing] = useState(false);

  return (
    <article className="book" onClick={() => openBook(book.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && openBook(book.id)}>
      <div className="cover-wrap">
        <Cover book={book} />
        {statusOf(book) === "lido" && <span className="badge">{tr("books.lido")}</span>}
        <div className="book-actions">
          <button
            className={`icon-btn${book.favorite ? " fav" : ""}`}
            aria-label={book.favorite ? tr("books.removerFavoritos") : tr("books.favoritar")}
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(book.id);
            }}
          >
            <Heart size={16} fill={book.favorite ? "currentColor" : "none"} />
          </button>
          <button
            className="icon-btn"
            aria-label={tr("books.detalhes")}
            title={tr("books.detalhesSub")}
            onClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
          >
            <Settings2 size={16} />
          </button>
          <button
            className="icon-btn"
            aria-label={tr("books.removerBiblio")}
            title={book.managed ? tr("books.removerBiblio") : tr("books.removerBiblioArq")}
            onClick={(e) => {
              e.stopPropagation();
              removeBook(book.id);
              if (book.managed) remove(book.path).catch(() => {});
              notify(tr("books.removido", { title: book.title }));
            }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <h4 className="clamp">{book.title}</h4>
      <p className="muted small clamp1">{book.author}</p>
      <div className="meter">
        <div className="track"><i style={{ width: `${pct}%` }} /></div>
        <span>{pct}%</span>
      </div>
      {editing && <BookDetailsDialog book={book} onClose={() => setEditing(false)} />}
    </article>
  );
}
