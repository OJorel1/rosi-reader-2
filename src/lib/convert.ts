// Converte MOBI/AZW3, FB2, CBZ e TXT em um EPUB na memória, para o leitor abrir tudo do mesmo jeito.
import JSZip from "jszip";
import { initKf8File, initMobiFile } from "@lingo-reader/mobi-parser";
import type { Format } from "../types";
import { langPrefix, tr, type Language } from "./i18n";

interface Chapter { title: string; body: string; css?: string[] }
interface Asset { name: string; data: Uint8Array; type: string }
export interface Converted {
  epub: Uint8Array;
  meta: { title?: string; author?: string; cover?: Blob };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const squash = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif",
  webp: "image/webp", avif: "image/avif", bmp: "image/bmp", svg: "image/svg+xml",
};
const extFromType = (t: string) => (t.split("/")[1] || "jpeg").replace("jpeg", "jpg").replace("svg+xml", "svg");

async function buildEpub(title: string, author: string, chapters: Chapter[], assets: Asset[] = [], lang: Language): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
  );
  const base = "img{max-width:100%;height:auto}p{margin:0 0 .8em}";
  chapters.forEach((c, i) => {
    const css = [base, ...(c.css ?? [])].map((x) => `<style><![CDATA[${x}]]></style>`).join("");
    zip.file(
      `OEBPS/c${i}.xhtml`,
      `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${langPrefix(lang)}"><head><title>${esc(c.title)}</title>${css}</head><body>${c.body}</body></html>`,
    );
  });
  assets.forEach((a) => zip.file(`OEBPS/${a.name}`, a.data));
  zip.file(
    "OEBPS/nav.xhtml",
    `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${esc(tr(lang, "data.sumario"))}</title></head><body><nav epub:type="toc"><ol>${chapters
      .map((c, i) => `<li><a href="c${i}.xhtml">${esc(c.title)}</a></li>`)
      .join("")}</ol></nav></body></html>`,
  );
  const manifest = [
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    ...chapters.map((_, i) => `<item id="c${i}" href="c${i}.xhtml" media-type="application/xhtml+xml"/>`),
    ...assets.map((a, i) => `<item id="a${i}" href="${a.name}" media-type="${a.type}"/>`),
  ].join("");
  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">urn:uuid:${crypto.randomUUID()}</dc:identifier><dc:title>${esc(title)}</dc:title><dc:creator>${esc(author)}</dc:creator><dc:language>${langPrefix(lang)}</dc:language><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, "Z")}</meta></metadata><manifest>${manifest}</manifest><spine>${chapters
      .map((_, i) => `<itemref idref="c${i}"/>`)
      .join("")}</spine></package>`,
  );
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

/* ---------- TXT ---------- */
async function txtToEpub(data: Uint8Array, name: string, lang: Language): Promise<Converted> {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    text = new TextDecoder("windows-1252").decode(data);
  }
  const hasBlank = /\n\s*\n/.test(text);
  const paras = text.split(hasBlank ? /\r?\n\s*\r?\n/ : /\r?\n/).map((p) => p.trim()).filter(Boolean);
  const chapters: Chapter[] = [];
  let cur: string[] = [];
  let len = 0;
  const flush = () => {
    if (cur.length) chapters.push({ title: tr(lang, "data.parte", { n: chapters.length + 1 }), body: cur.join("") });
    cur = [];
    len = 0;
  };
  for (const p of paras) {
    cur.push(`<p>${esc(p).replace(/\r?\n/g, "<br/>")}</p>`);
    len += p.length;
    if (len > 12000) flush();
  }
  flush();
  const title = name.replace(/\.[^.]+$/, "");
  return { epub: await buildEpub(title, tr(lang, "data.authorUnknown"), chapters.length ? chapters : [{ title, body: "<p></p>" }], [], lang), meta: { title } };
}

/* ---------- CBZ (quadrinhos) ---------- */
async function cbzToEpub(data: Uint8Array, name: string, lang: Language): Promise<Converted> {
  const zip = await JSZip.loadAsync(data);
  const files = Object.values(zip.files)
    .filter((f) => !f.dir && !f.name.includes("__MACOSX") && /\.(jpe?g|png|gif|webp|avif|bmp)$/i.test(f.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (!files.length) throw new Error("cbz vazio");
  let title = name.replace(/\.[^.]+$/, "");
  let author = tr(lang, "data.authorUnknown");
  const info = zip.file(/comicinfo\.xml$/i)[0];
  if (info) {
    const xml = await info.async("string");
    const pick = (tag: string) => xml.match(new RegExp(`<${tag}>([^<]+)</${tag}>`, "i"))?.[1]?.trim();
    const t = [pick("Series"), pick("Title")].filter(Boolean).join(" — ");
    if (t) title = t;
    author = pick("Writer") || author;
  }
  const assets: Asset[] = [];
  const chapters: Chapter[] = [];
  let cover: Blob | undefined;
  for (let i = 0; i < files.length; i++) {
    const ext = files[i].name.split(".").pop()!.toLowerCase();
    const bytes = await files[i].async("uint8array");
    const type = MIME[ext] ?? "image/jpeg";
    if (i === 0) cover = new Blob([bytes.slice()], { type });
    assets.push({ name: `p${i}.${ext}`, data: bytes, type });
    chapters.push({
      title: tr(lang, "reader.pagina", { n: i + 1 }),
      body: `<div class="pg"><img src="p${i}.${ext}" alt=""/></div>`,
      css: ["html,body{margin:0;height:100%}.pg{height:100vh;display:flex;align-items:center;justify-content:center}.pg img{max-width:100%;max-height:100vh;object-fit:contain}"],
    });
  }
  return { epub: await buildEpub(title, author, chapters, assets, lang), meta: { title, author, cover } };
}

/* ---------- FB2 ---------- */
function fb2Text(data: Uint8Array): string {
  const head = new TextDecoder("latin1").decode(data.slice(0, 200));
  const enc = head.match(/encoding=["']([\w-]+)["']/i)?.[1] ?? "utf-8";
  try {
    return new TextDecoder(enc).decode(data);
  } catch {
    return new TextDecoder("utf-8").decode(data);
  }
}

async function fb2ToEpub(data: Uint8Array, name: string, lang: Language): Promise<Converted> {
  // arquivos FB2 da vida real costumam ter "&" soltos e caracteres de controle, que o parser XML rejeita
  const clean = fb2Text(data)
    .replace(/&(?!(?:[a-zA-Z][a-zA-Z0-9]*|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  const doc = new DOMParser().parseFromString(clean, "text/xml");
  if (doc.querySelector("parsererror")) throw new Error("fb2 inválido");
  const q = (root: ParentNode, sel: string) => root.querySelector(sel);

  const binaries = new Map<string, Asset>();
  doc.querySelectorAll("binary").forEach((b) => {
    const id = b.getAttribute("id");
    if (!id) return;
    const type = b.getAttribute("content-type") || "image/jpeg";
    const bin = atob((b.textContent ?? "").replace(/\s+/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    binaries.set(id, { name: `img_${binaries.size}.${extFromType(type)}`, data: bytes, type });
  });
  const used = new Set<string>();
  const hrefOf = (el: Element) => (el.getAttribute("l:href") || el.getAttribute("xlink:href") || el.getAttribute("href") || "").replace(/^#/, "");

  const conv = (n: Node): string => {
    if (n.nodeType === 3) return esc(n.textContent ?? "");
    if (n.nodeType !== 1) return "";
    const el = n as Element;
    const inner = () => Array.from(el.childNodes).map(conv).join("");
    switch (el.localName) {
      case "p": case "v": return `<p>${inner()}</p>`;
      case "emphasis": return `<em>${inner()}</em>`;
      case "strong": return `<strong>${inner()}</strong>`;
      case "strikethrough": return `<s>${inner()}</s>`;
      case "sub": return `<sub>${inner()}</sub>`;
      case "sup": return `<sup>${inner()}</sup>`;
      case "code": return `<code>${inner()}</code>`;
      case "empty-line": return "<br/>";
      case "title": return `<h2>${Array.from(el.children).map((c) => squash(c.textContent)).join("<br/>") || esc(squash(el.textContent))}</h2>`;
      case "subtitle": return `<h3>${inner()}</h3>`;
      case "epigraph": case "cite": return `<blockquote>${inner()}</blockquote>`;
      case "text-author": return `<p><em>${inner()}</em></p>`;
      case "image": {
        const b = binaries.get(hrefOf(el));
        if (!b) return "";
        used.add(b.name);
        return `<div style="text-align:center"><img src="${b.name}" alt=""/></div>`;
      }
      case "a": return inner();
      default: return `<div>${inner()}</div>`;
    }
  };

  const titleOf = (sec: Element) => squash(sec.querySelector(":scope > title")?.textContent);
  const chapters: Chapter[] = [];
  const addSection = (sec: Element, fallback: string) => {
    const subs = Array.from(sec.children).filter((c) => c.localName === "section");
    if (!subs.length) {
      chapters.push({ title: titleOf(sec) || fallback, body: conv(sec) });
      return;
    }
    const head = Array.from(sec.children).filter((c) => c.localName !== "section");
    if (head.length) chapters.push({ title: titleOf(sec) || fallback, body: head.map(conv).join("") });
    subs.forEach((s, i) => addSection(s, `${fallback}.${i + 1}`));
  };
  doc.querySelectorAll("FictionBook > body").forEach((body, bi) => {
    const secs = Array.from(body.children).filter((c) => c.localName === "section");
    if (secs.length) secs.forEach((s, i) => addSection(s, tr(lang, "data.capitulo", { n: i + 1 })));
    else if (body.textContent?.trim()) chapters.push({ title: body.getAttribute("name") || tr(lang, "data.texto", { n: bi + 1 }), body: Array.from(body.childNodes).map(conv).join("") });
  });
  if (!chapters.length) throw new Error("fb2 sem texto");

  const ti = q(doc, "description > title-info");
  const title = squash(ti && q(ti, "book-title")?.textContent) || name.replace(/\.[^.]+$/, "");
  const a = ti && q(ti, "author");
  const author = squash([a && q(a, "first-name")?.textContent, a && q(a, "last-name")?.textContent].filter(Boolean).join(" ")) || tr(lang, "data.authorUnknown");
  const coverEl = ti && q(ti, "coverpage image");
  const cb = coverEl ? binaries.get(hrefOf(coverEl)) : undefined;
  const cover = cb ? new Blob([cb.data.slice()], { type: cb.type }) : undefined;

  const assets = [...binaries.values()].filter((b) => used.has(b.name));
  return { epub: await buildEpub(title, author, chapters, assets, lang), meta: { title, author, cover } };
}

/* ---------- MOBI / AZW3 ---------- */
async function mobiToEpub(format: Format, data: Uint8Array, name: string, lang: Language): Promise<Converted> {
  const copy = () => data.slice();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let p: any;
  if (format === "azw3") p = await initKf8File(copy()).catch(() => initMobiFile(copy()));
  else p = await initMobiFile(copy()).catch(() => initKf8File(copy()));

  try {
    const md = p.getMetadata?.() ?? {};
    const labels = new Map<string, string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const walk = (items: any[] = []) =>
      items.forEach((it) => {
        try {
          const r = p.resolveHref(it.href);
          if (r?.id && !labels.has(r.id)) labels.set(r.id, squash(it.label));
        } catch { /* sem destino */ }
        walk(it.children);
      });
    try { walk(p.getToc?.()); } catch { /* sem sumário */ }

    const assets: Asset[] = [];
    const seen = new Map<string, string>();
    const chapters: Chapter[] = [];
    const spine: { id: string }[] = p.getSpine();
    for (let i = 0; i < spine.length; i++) {
      const ch = await p.loadChapter(spine[i].id);
      if (!ch?.html) continue;
      const d = new DOMParser().parseFromString(ch.html, "text/html");
      d.querySelectorAll("script").forEach((s) => s.remove());
      for (const img of Array.from(d.querySelectorAll("img[src^='blob:']"))) {
        const src = img.getAttribute("src")!;
        let nameOut = seen.get(src);
        if (!nameOut) {
          try {
            const blob = await (await fetch(src)).blob();
            nameOut = `m${assets.length}.${extFromType(blob.type)}`;
            assets.push({ name: nameOut, data: new Uint8Array(await blob.arrayBuffer()), type: blob.type || "image/jpeg" });
            seen.set(src, nameOut);
          } catch { continue; }
        }
        img.setAttribute("src", nameOut);
        img.removeAttribute("srcset");
      }
      const css: string[] = [];
      for (const part of ch.css ?? []) {
        try { css.push(await (await fetch(part.href)).text()); } catch { /* ignora */ }
      }
      const ser = new XMLSerializer();
      const body = Array.from(d.body.childNodes).map((n) => ser.serializeToString(n)).join("");
      if (!squash(d.body.textContent) && !d.body.querySelector("img")) continue;
      chapters.push({ title: labels.get(spine[i].id) || tr(lang, "data.secao", { n: chapters.length + 1 }), body, css });
    }
    if (!chapters.length) throw new Error("mobi sem texto");

    let cover: Blob | undefined;
    try {
      const url = p.getCoverImage?.();
      if (url) cover = await (await fetch(url)).blob();
    } catch { /* sem capa */ }

    const title = squash(md.title) || name.replace(/\.[^.]+$/, "");
    const author = Array.isArray(md.author) ? md.author.join(", ") : squash(md.author) || tr(lang, "data.authorUnknown");
    return { epub: await buildEpub(title, author || tr(lang, "data.authorUnknown"), chapters, assets, lang), meta: { title, author, cover } };
  } finally {
    try { p.destroy?.(); } catch { /* já liberado */ }
  }
}

export async function toEpub(format: Format, data: Uint8Array, fileName: string, lang: Language): Promise<Converted> {
  switch (format) {
    case "txt": return txtToEpub(data, fileName, lang);
    case "cbz": return cbzToEpub(data, fileName, lang);
    case "fb2": return fb2ToEpub(data, fileName, lang);
    case "mobi":
    case "azw3": return mobiToEpub(format, data, fileName, lang);
    default: throw new Error("sem conversão");
  }
}
