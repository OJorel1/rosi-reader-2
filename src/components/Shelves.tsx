import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useStore } from "../store";
import { statusLabel, statusOf } from "../lib/books";
import type { Status } from "../types";
import { useTr } from "../lib/i18n";
import BookCard from "./BookCard";

type Tab = Status | string; // status ou id de coleção

export default function Shelves() {
  const books = useStore((s) => s.books);
  const shelves = useStore((s) => s.shelves);
  const addShelf = useStore((s) => s.addShelf);
  const renameShelf = useStore((s) => s.renameShelf);
  const removeShelf = useStore((s) => s.removeShelf);
  const tr = useTr();
  const [tab, setTab] = useState<Tab>("lendo");
  const [creating, setCreating] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);

  const isStatus = tab === "quero" || tab === "lendo" || tab === "lido";
  const shelf = isStatus ? undefined : shelves.find((s) => s.id === tab);
  const list = books.filter((b) => (isStatus ? statusOf(b) === tab : b.shelfIds?.includes(tab)));

  const create = () => {
    if (!creating.trim()) return;
    setTab(addShelf(creating));
    setCreating("");
  };

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{tr("shelves.titulo")}</h1>
          <p className="muted">{tr("shelves.sub")}</p>
        </div>
      </header>

      <div className="chips">
        {(["quero", "lendo", "lido"] as Status[]).map((s) => (
          <button key={s} className={`chip-btn${tab === s ? " on" : ""}`} onClick={() => setTab(s)}>
            {statusLabel(s)} <em>{books.filter((b) => statusOf(b) === s).length}</em>
          </button>
        ))}
        <span className="chips-sep" />
        {shelves.map((s) => (
          <button key={s.id} className={`chip-btn${tab === s.id ? " on" : ""}`} onClick={() => setTab(s.id)}>
            {s.name} <em>{books.filter((b) => b.shelfIds?.includes(s.id)).length}</em>
          </button>
        ))}
        <label className="chip-new">
          <Plus size={14} />
          <input placeholder={tr("shelves.novaColecao")} value={creating} onChange={(e) => setCreating(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
        </label>
      </div>

      {shelf && (
        <div className="shelf-head">
          {renaming === shelf.id ? (
            <input
              autoFocus
              className="text-input"
              defaultValue={shelf.name}
              onBlur={(e) => { if (e.target.value.trim()) renameShelf(shelf.id, e.target.value); setRenaming(null); }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            />
          ) : (
            <h2>{shelf.name}</h2>
          )}
          <button className="icon-btn" aria-label={tr("shelves.renomearAria")} onClick={() => setRenaming(shelf.id)}><Pencil size={15} /></button>
          <button className="icon-btn" aria-label={tr("shelves.apagarAria")} title={tr("shelves.apagarTitulo")} onClick={() => { removeShelf(shelf.id); setTab("lendo"); }}><Trash2 size={15} /></button>
        </div>
      )}

      {list.length ? (
        <div className="grid">{list.map((b) => <BookCard key={b.id} book={b} />)}</div>
      ) : (
        <div className="empty-card glass">
          <p>{isStatus ? tr("shelves.vazioStatus", { status: statusLabel(tab as Status) }) : tr("shelves.vazio")}</p>
        </div>
      )}
    </>
  );
}
