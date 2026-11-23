import { Download, FileText, Upload } from "lucide-react";
import { useStore } from "../store";
import { fontOptions } from "../lib/fonts";
import { LANGUAGES, useTr } from "../lib/i18n";
import { exportBackup, exportClipsMarkdown, importBackup } from "../lib/backup";

export default function SettingsPage() {
  const s = useStore((x) => x.settings);
  const set = useStore((x) => x.setSettings);
  const books = useStore((x) => x.books.length);
  const clips = useStore((x) => x.clips.length);
  const tr = useTr();
  const themeLabels: Record<string, string> = {
    papel: tr("settings.temaPapel"),
    sepia: tr("settings.temaSepia"),
    noite: tr("settings.temaNoite"),
  };
  const confirmRestore = async () => {
    if (window.confirm(tr("settings.confirmarRestaurar"))) await importBackup();
  };
  return (
    <>
      <header className="page-head">
        <div><h1>{tr("settings.titulo")}</h1><p className="muted">{tr("settings.sub")}</p></div>
      </header>

      <div className="settings glass">
        <h2>{tr("settings.leitura")}</h2>
        <div className="opt"><span>{tr("settings.temaLeitura")}</span>
          <div className="seg">{(["papel", "sepia", "noite"] as const).map((t) => <button key={t} className={s.theme === t ? "on" : ""} onClick={() => set({ theme: t })}>{themeLabels[t]}</button>)}</div>
        </div>
        <div className="opt"><span>{tr("settings.fonte")}</span>
          <select value={s.font} onChange={(e) => set({ font: e.target.value })}>{fontOptions().map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select>
        </div>
        <div className="opt"><span>{tr("settings.zoomPadrao")}</span>
          <div className="seg">{[0.8, 1, 1.2, 1.5].map((z) => <button key={z} className={s.zoom === z ? "on" : ""} onClick={() => set({ zoom: z })}>{Math.round(z * 100)}%</button>)}</div>
        </div>
        <div className="opt"><span>{tr("settings.luzQuente")}</span>
          <input type="range" min={0} max={0.5} step={0.05} value={s.warm} onChange={(e) => set({ warm: +e.target.value })} />
        </div>
      </div>

      <div className="settings glass">
        <h2>{tr("settings.idioma")}</h2>
        <div className="opt">
          <select value={s.lang} onChange={(e) => set({ lang: e.target.value as typeof s.lang })} aria-label={tr("settings.idioma")}>
            {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
      </div>

      <div className="settings glass">
        <h2>{tr("settings.backupTitulo")}</h2>
        <p className="muted small">{tr("settings.backupDesc", { books, clips })}</p>
        <div className="hero-actions">
          <button className="btn primary" onClick={exportBackup}><Download size={16} /> {tr("settings.exportarBackup")}</button>
          <button className="btn" onClick={confirmRestore}><Upload size={16} /> {tr("settings.restaurarBackup")}</button>
          <button className="btn" onClick={exportClipsMarkdown}><FileText size={16} /> {tr("settings.exportarTrechos")}</button>
        </div>
      </div>
    </>
  );
}
