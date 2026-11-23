import { useEffect, useState } from "react";
import { useStore } from "./store";
import { onFilesDropped } from "./lib/files";
import { isAndroid } from "./lib/platform";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { SUPPORTED, extOf } from "./lib/files";
import { importPaths } from "./lib/importer";
import Sidebar from "./components/Sidebar";
import AddBookDialog from "./components/AddBookDialog";
import Vocabulary from "./components/Vocabulary";
import AuthorsPage from "./components/Authors";
import ReaderShell from "./components/ReaderShell";
import { Bookmarks, Clips, Home, Library } from "./components/Pages";
import SettingsPage from "./components/SettingsPage";
import Shelves from "./components/Shelves";
import Stats from "./components/Stats";

export default function App() {
  const view = useStore((s) => s.view);
  const openBookId = useStore((s) => s.openBookId);
  const toast = useStore((s) => s.toast);
  const lang = useStore((s) => s.settings.lang);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (isAndroid) return; // arrastar e soltar só existe no computador
    const un = onFilesDropped((paths) => importPaths(paths));
    return () => void un.then((f) => f());
  }, []);

  // duplo clique num livro no Windows ("Abrir com" o Rosi Reader)
  useEffect(() => {
    const openFiles = async (paths: string[]) => {
      const files = paths.filter((p) => SUPPORTED.includes(extOf(p)));
      if (!files.length) return;
      await importPaths(files);
      const b = useStore.getState().books.find((x) => x.path === files[0]);
      if (b) useStore.getState().openBook(b.id);
    };
    invoke<string[]>("launch_files").then(openFiles).catch(() => {});
    const un = listen<string[]>("open-files", (e) => openFiles(e.payload));
    return () => void un.then((f) => f());
  }, []);

  // Android: o botão "voltar" do sistema fecha o livro em vez de sair do app
  useEffect(() => {
    if (!isAndroid) return;
    const onPop = () => {
      const s = useStore.getState();
      if (s.openBookId) s.openBook(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    if (!isAndroid) return;
    if (openBookId) history.pushState({ reader: true }, "");
    else if (history.state?.reader) history.back();
  }, [openBookId]);

  if (openBookId) {
    return (
      <>
        <ReaderShell key={openBookId} />
        {toast && <div className="toast glass">{toast}</div>}
      </>
    );
  }

  return (
    <div className="app">
      <Sidebar onAdd={() => setAdding(true)} />
      <main>
        {view === "inicio" && <Home onAdd={() => setAdding(true)} />}
        {view === "favoritos" && <Library onlyFavorites />}
        {view === "livros" && <Library />}
        {view === "estantes" && <Shelves />}
        {view === "estatisticas" && <Stats />}
        {view === "autores" && <AuthorsPage />}
        {view === "vocabulario" && <Vocabulary />}
        {view === "trechos" && <Clips kind="trecho" />}
        {view === "destaques" && <Clips kind="destaque" />}
        {view === "marcadores" && <Bookmarks />}
        {view === "config" && <SettingsPage />}
      </main>
      {adding && <AddBookDialog onClose={() => setAdding(false)} />}
      {toast && <div className="toast glass">{toast}</div>}
    </div>
  );
}
