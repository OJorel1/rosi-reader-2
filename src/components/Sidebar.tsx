import { BarChart3, Bookmark, BookOpen, Heart, Library, Highlighter, Home, Languages, Plus, Quote, Settings, UserRound } from "lucide-react";
import { useStore } from "../store";
import { useTr } from "../lib/i18n";
import type { View } from "../types";

const ITEMS: [View, string, typeof Home][] = [
  ["inicio", "sidebar.inicio", Home],
  ["favoritos", "sidebar.favoritos", Heart],
  ["livros", "sidebar.livros", BookOpen],
  ["estantes", "sidebar.estantes", Library],
  ["autores", "sidebar.autores", UserRound],
  ["trechos", "sidebar.trechos", Quote],
  ["vocabulario", "sidebar.vocabulario", Languages],
  ["marcadores", "sidebar.marcadores", Bookmark],
  ["destaques", "sidebar.destaques", Highlighter],
  ["estatisticas", "sidebar.estatisticas", BarChart3],
  ["config", "sidebar.config", Settings],
];

export default function Sidebar({ onAdd }: { onAdd(): void }) {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const tr = useTr();
  return (
    <aside className="sidebar">
      <div className="brand">
        <BookOpen size={26} />
        <span>Rosi Reader</span>
      </div>
      <nav>
        {ITEMS.map(([id, key, Icon]) => (
          <button key={id} className={view === id ? "on" : ""} onClick={() => setView(id)}>
            <Icon size={18} />
            {tr(key)}
          </button>
        ))}
      </nav>
      <button className="btn primary add" onClick={onAdd}>
        <Plus size={18} /> {tr("sidebar.adicionarLivro")}
      </button>
    </aside>
  );
}
