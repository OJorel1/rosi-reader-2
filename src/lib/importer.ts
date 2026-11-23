import ePub from "epubjs";
import JSZip from "jszip";
import { appDataDir, join } from "@tauri-apps/api/path";
import { mkdir, writeFile } from "@tauri-apps/plugin-fs";
import { useStore, uid } from "../store";
import type { Book, Format } from "../types";
import { COMING_SOON, SUPPORTED, baseName, expandPaths, extOf, readBookFile } from "./files";
import { isAndroid } from "./platform";
import { openPdf } from "./pdf";
import { toEpub } from "./convert";
import { t } from "./i18n";

async function shrink(blob: Blob, width = 320): Promise<string> {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, width / bmp.width);
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
}

/** Descobre o formato pelo conteúdo (no Android o caminho não tem extensão). */
async function sniff(d: Uint8Array): Promise<Format | null> {
  const head = new TextDecoder("latin1").decode(d.slice(0, 1024));
  if (head.includes("%PDF-")) return "pdf";
  if (head.includes("<FictionBook")) return "fb2";
  if (new TextDecoder("latin1").decode(d.slice(60, 68)) === "BOOKMOBI") return "mobi";
  if (d[0] === 0x50 && d[1] === 0x4b) {
    if (head.includes("application/epub+zip")) return "epub";
    try {
      const z = await JSZip.loadAsync(d);
      if (Object.keys(z.files).some((n) => /\.(jpe?g|png|webp|gif)$/i.test(n))) return "cbz";
    } catch { /* zip ilegível */ }
    return null;
  }
  if (d.length && !d.slice(0, 1024).includes(0)) return "txt"; // sem bytes nulos: texto simples
  return null;
}

async function readPdf(data: Uint8Array): Promise<Partial<Book>> {
  const doc = await openPdf(data);
  const meta = (await doc.getMetadata().catch(() => null)) as { info?: Record<string, string> } | null;
  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: 320 / base.width });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
  const out = {
    title: meta?.info?.Title?.trim() || undefined,
    author: meta?.info?.Author?.trim() || undefined,
    cover: canvas.toDataURL("image/jpeg", 0.82),
    totalPages: doc.numPages,
  };
  await doc.destroy();
  return out;
}

async function readEpub(data: Uint8Array): Promise<Partial<Book>> {
  const book = ePub(data.slice().buffer as ArrayBuffer);
  try {
    const md = await book.loaded.metadata;
    let cover: string | undefined;
    const url = await book.coverUrl().catch(() => null);
    if (url) cover = await shrink(await (await fetch(url)).blob()).catch(() => undefined);
    return { title: md.title?.trim(), author: md.creator?.trim(), cover };
  } finally {
    book.destroy();
  }
}

/** No Android o seletor devolve um endereço temporário (content://): copiamos o livro para o app. */
async function keepCopy(id: string, format: Format, data: Uint8Array): Promise<string> {
  const dir = await join(await appDataDir(), "books");
  await mkdir(dir, { recursive: true });
  const dest = await join(dir, `${id}.${format}`);
  await writeFile(dest, data);
  return dest;
}

async function buildBook(path: string): Promise<Book> {
  const data = await readBookFile(path);
  const byName = extOf(path);
  const format = (SUPPORTED.includes(byName) ? byName : await sniff(data)) as Format | null;
  if (!format) throw new Error("unsupported");

  let meta: Partial<Book>;
  if (format === "pdf") meta = await readPdf(data);
  else if (format === "epub") meta = await readEpub(data);
  else {
    const c = await toEpub(format, data, baseName(path), useStore.getState().settings.lang);
    meta = { title: c.meta.title, author: c.meta.author, cover: c.meta.cover ? await shrink(c.meta.cover).catch(() => undefined) : undefined };
  }
  const id = uid();
  const fallback = baseName(path).replace(/\.[^.]+$/, "");
  const managed = isAndroid;
  return {
    id,
    title: meta.title || (path.startsWith("content:") ? t("data.titleUnknown") : fallback),
    author: meta.author || t("data.authorUnknown"),
    format,
    path: managed ? await keepCopy(id, format, data) : path,
    managed: managed || undefined,
    cover: meta.cover,
    totalPages: meta.totalPages,
    addedAt: Date.now(),
    progress: 0,
    location: format === "pdf" ? 1 : "",
    favorite: false,
  };
}

export async function importPaths(raw: string[]) {
  const { books, addBooks, notify } = useStore.getState();
  const files = await expandPaths(raw);
  const known = new Set(books.map((b) => b.path));
  const added: Book[] = [];
  const failed: string[] = [];
  const unsupported = new Set<string>();

  if (files.length) notify(t("imp.importando"));

  for (const p of files) {
    if (known.has(p)) continue;
    const ext = extOf(p);
    if (!p.startsWith("content:") && !SUPPORTED.includes(ext)) {
      if (COMING_SOON.includes(ext)) unsupported.add(ext.toUpperCase());
      continue;
    }
    try {
      added.push(await buildBook(p));
    } catch (e) {
      if ((e as Error).message === "unsupported") unsupported.add(t("imp.formatoGenerico"));
      else {
        console.error(e);
        failed.push(p.startsWith("content:") ? t("imp.umArquivo") : baseName(p));
      }
    }
  }

  if (added.length) addBooks(added);

  const parts: string[] = [];
  if (added.length) parts.push(t(added.length === 1 ? "imp.adicionado" : "imp.adicionados", { n: added.length }));
  if (unsupported.size) parts.push(t("imp.naoSuportado", { ext: [...unsupported].join(", "), lista: t("imp.lista") }));
  if (failed.length) parts.push(t("imp.falhaAbrir", { list: failed.join(", ") }));
  if (!parts.length) parts.push(files.length ? t("imp.jaBiblioteca") : t("imp.nenhumLivro"));
  notify(parts.join(" · "));
}
