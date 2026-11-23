import { useState } from "react";
import { Camera, Plus, Trash2, X } from "lucide-react";
import { remove } from "@tauri-apps/plugin-fs";
import { useStore } from "../store";
import { imageToCover, pickImage } from "../lib/files";
import { statusLabel, statusOf } from "../lib/books";
import type { Book, Status } from "../types";
import { useTr } from "../lib/i18n";
import Cover from "./Cover";

export default function BookDetailsDialog({ book, onClose }: { book: Book; onClose(): void }) {
  const shelves = useStore((s) => s.shelves);
  const updateBook = useStore((s) => s.updateBook);
  const addShelf = useStore((s) => s.addShelf);
  const removeBook = useStore((s) => s.removeBook);
  const notify = useStore((s) => s.notify);
  const tr = useTr();

  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author);
  const [cover, setCover] = useState<string | undefined>(book.cover);
  const [status, setStatus] = useState<Status | "auto">(book.status ?? "auto");
  const [ids, setIds] = useState<string[]>(book.shelfIds ?? []);
  const [newShelf, setNewShelf] = useState("");

  const chooseCover = async () => {
    const p = await pickImage();
    if (!p) return;
    try {
      setCover(await imageToCover(p));
    } catch {
      notify(tr("photos.fotoNaoConsigo"));
    }
  };
  const toggle = (id: string) => setIds((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const createShelf = () => {
    if (!newShelf.trim()) return;
    const id = addShelf(newShelf);
    setIds((a) => [...a, id]);
    setNewShelf("");
  };
  const save = () => {
    if (!title.trim()) return;
    updateBook(book.id, {
      title: title.trim(),
      author: author.trim() || tr("data.authorUnknown"),
      cover,
      status: status === "auto" ? undefined : status,
      shelfIds: ids,
    });
    notify(tr("details.atualizado"));
    onClose();
  };
  const del = () => {
    removeBook(book.id);
    if (book.managed) remove(book.path).catch(() => {});
    notify(tr("books.removido", { title: book.title }));
    onClose();
  };

  // o cartão do livro abre o leitor ao clicar/Enter: impedimos que isso vaze do diálogo
  return (
    <div className="modal-back" onMouseDown={onClose} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <div className="modal glass details" onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <h3>{tr("details.titulo")}</h3>
          <button className="icon-btn" onClick={onClose} aria-label={tr("common.fechar")}><X size={18} /></button>
        </header>

        <div className="details-top">
          <div className="details-cover">
            <Cover book={{ title, cover }} />
          </div>
          <div className="grow">
            <button className="btn sm" onClick={chooseCover}><Camera size={14} /> {cover ? tr("details.trocarCapa") : tr("details.adicionarCapa")}</button>
            {cover && <button className="btn ghost sm" onClick={() => setCover(undefined)}>{tr("details.removerCapa")}</button>}
            <label className="field"><span>{tr("details.tituloLivro")}</span><input className="text-input" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
            <label className="field"><span>{tr("details.autor")}</span><input className="text-input" value={author} onChange={(e) => setAuthor(e.target.value)} /></label>
          </div>
        </div>

        <div className="opt">
          <span>{tr("details.statusLeitura")}</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as Status | "auto")}>
            <option value="auto">{tr("details.automatico", { status: statusLabel(statusOf(book)) })}</option>
            {(["quero", "lendo", "lido"] as Status[]).map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
        </div>

        <div className="field">
          <span>{tr("details.colecoes")}</span>
          <div className="chips">
            {shelves.map((s) => (
              <button key={s.id} className={`chip-btn${ids.includes(s.id) ? " on" : ""}`} onClick={() => toggle(s.id)}>{s.name}</button>
            ))}
            {!shelves.length && <span className="muted small">{tr("details.semColecoes")}</span>}
          </div>
          <div className="row">
            <input className="text-input grow" placeholder={tr("details.novaColecao")} value={newShelf} onChange={(e) => setNewShelf(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createShelf()} />
            <button className="btn" onClick={createShelf} disabled={!newShelf.trim()}><Plus size={14} /> {tr("details.criar")}</button>
          </div>
        </div>

        <footer className="split">
          <button className="btn ghost danger" onClick={del}><Trash2 size={15} /> {tr("details.removerBiblio")}</button>
          <div className="row">
            <button className="btn ghost" onClick={onClose}>{tr("details.cancelar")}</button>
            <button className="btn primary" onClick={save} disabled={!title.trim()}>{tr("details.salvar")}</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
