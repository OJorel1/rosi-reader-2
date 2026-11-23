import { useState } from "react";
import { FileText, FolderOpen, X } from "lucide-react";
import { pickFiles, pickFolder } from "../lib/files";
import { importPaths } from "../lib/importer";
import { isAndroid } from "../lib/platform";
import { useTr } from "../lib/i18n";

export default function AddBookDialog({ onClose }: { onClose(): void }) {
  const [busy, setBusy] = useState(false);
  const tr = useTr();
  const run = async (pick: () => Promise<string[]>) => {
    const paths = await pick();
    if (!paths.length) return;
    setBusy(true);
    await importPaths(paths);
    setBusy(false);
    onClose();
  };
  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className="modal glass" onMouseDown={(e) => e.stopPropagation()}>
        <header>
          <h3>{tr("addDialog.titulo")}</h3>
          <button className="icon-btn" onClick={onClose} aria-label={tr("common.fechar")}><X size={18} /></button>
        </header>
        <div className="drop">
          <FileText size={34} />
          <strong>{isAndroid ? tr("addDialog.androidTip") : tr("addDialog.desktopTip")}</strong>
          <span className="muted small">{isAndroid ? tr("addDialog.androidHint") : tr("addDialog.desktopHint")}</span>
        </div>
        <div className="row">
          <button className="btn primary" disabled={busy} onClick={() => run(pickFiles)}>
            <FileText size={16} /> {tr("addDialog.escolherArquivos")}
          </button>
          {!isAndroid && (
            <button className="btn" disabled={busy} onClick={() => run(pickFolder)}>
              <FolderOpen size={16} /> {tr("addDialog.escolherPasta")}
            </button>
          )}
        </div>
        <p className="muted small">{tr("addDialog.formats")}</p>
      </div>
    </div>
  );
}
