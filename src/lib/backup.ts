import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { buildBackup, useStore, type Backup } from "../store";
import { dayKey } from "../store";
import { t } from "./i18n";

const notify = (m: string) => useStore.getState().notify(m);

export async function exportBackup() {
  const path = await save({
    defaultPath: `rosi-reader-backup-${dayKey()}.json`,
    filters: [{ name: t("backup.filtroBackup"), extensions: ["json"] }],
  }).catch(() => "erro" as const);
  if (path === "erro") return notify(t("backup.falhaLocal"));
  if (!path) return;
  try {
    await writeTextFile(path, JSON.stringify(buildBackup()));
    notify(t("backup.sucesso"));
  } catch (e) {
    console.error(e);
    notify(t("backup.erroLocal"));
  }
}

export async function importBackup() {
  const path = await open({ multiple: false, filters: [{ name: t("backup.filtroBackup"), extensions: ["json"] }] });
  if (typeof path !== "string") return;
  try {
    const data = JSON.parse(await readTextFile(path)) as Partial<Backup>;
    if (data.app !== "rosi-reader" || !Array.isArray(data.books)) throw new Error("arquivo inválido");
    useStore.getState().restore(data);
    notify(t("backup.restaurado", { n: data.books.length }));
  } catch (e) {
    console.error(e);
    notify(t("backup.invalido"));
  }
}

/** Trechos e destaques em Markdown, agrupados por livro. */
export async function exportClipsMarkdown() {
  const { clips, books } = useStore.getState();
  if (!clips.length) return notify(t("backup.semTrechos"));
  const path = await save({ defaultPath: "meus-trechos-e-destaques.md", filters: [{ name: t("backup.filtroMarkdown"), extensions: ["md"] }] }).catch(() => "erro" as const);
  if (path === "erro") return notify(t("backup.falhaLocalExportar"));
  if (!path) return;
  const out: string[] = [`# ${t("backup.mdTitulo")}`, ""];
  for (const b of books) {
    const list = clips.filter((c) => c.bookId === b.id);
    if (!list.length) continue;
    out.push(`## ${b.title} — ${b.author}`, "");
    for (const c of list) {
      out.push(`> ${c.text.replace(/\n+/g, "\n> ")}`, "");
      out.push(`— ${t(c.kind === "destaque" ? "clip.destaqueLabel" : "clip.trechoLabel")}, ${c.pageLabel}`, "");
      if (c.note) out.push(`**${t("clip.minhaAnotacao")}:** ${c.note}`, "");
    }
  }
  try {
    await writeTextFile(path, out.join("\n"));
    notify(t("backup.arquivoMarkdownSalvo"));
  } catch (e) {
    console.error(e);
    notify(t("backup.semArquivo"));
  }
}
