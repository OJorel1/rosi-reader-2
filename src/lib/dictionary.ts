import { invoke } from "@tauri-apps/api/core";
import { langOf, tr } from "./i18n";
import type { Language } from "../types";

export interface DictEntry {
  pos?: string;
  defs: string[];
}
export interface DictResult {
  word: string;
  source: string;
  entries: DictEntry[];
}

const get = (url: string) => invoke<string>("http_get", { url });
const squash = (t: string | null | undefined) => (t ?? "").replace(/\s+/g, " ").trim();

/** Tira pontuação das pontas: "“casa,”" -> "casa" */
export const cleanWord = (w: string) => w.trim().replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, "");

// Wikcionários por idioma: host do Wiktionary e a seção de língua que o parse busca.
const WIKTIONARY: Record<Language, { host: string; section: string }> = {
  pt: { host: "pt.wiktionary.org", section: "Português" },
  en: { host: "en.wiktionary.org", section: "English" },
  es: { host: "es.wiktionary.org", section: "Español" },
  fr: { host: "fr.wiktionary.org", section: "Français" },
  de: { host: "de.wiktionary.org", section: "Deutsch" },
  it: { host: "it.wiktionary.org", section: "Italiano" },
};

async function wiktionary(lang: Language, word: string): Promise<DictEntry[]> {
  const { host, section } = WIKTIONARY[lang];
  const url = `https://${host}/w/api.php?action=parse&page=${encodeURIComponent(word)}&prop=text&format=json&formatversion=2&redirects=1`;
  const json = JSON.parse(await get(url));
  const html: string | undefined = json?.parse?.text;
  if (!html) return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll(".mw-editsection, style, sup.reference").forEach((n) => n.remove());

  const entries: DictEntry[] = [];
  let langName = "";
  let pos = "";
  doc.querySelectorAll("h2, h3, h4, ol").forEach((el) => {
    const tag = el.tagName;
    if (tag === "H2") {
      langName = squash(el.textContent);
      pos = "";
    } else if (tag === "H3" || tag === "H4") {
      pos = squash(el.textContent);
    } else if (langName === section && !el.closest("li")) {
      const defs: string[] = [];
      el.querySelectorAll(":scope > li").forEach((li) => {
        const c = li.cloneNode(true) as HTMLElement;
        c.querySelectorAll("ul, ol, dl").forEach((n) => n.remove());
        const t = squash(c.textContent);
        if (t) defs.push(t);
      });
      if (defs.length) entries.push({ pos: pos || undefined, defs: defs.slice(0, 8) });
    }
  });
  return entries;
}

async function dicionarioAberto(word: string): Promise<DictEntry[]> {
  const arr = JSON.parse(await get(`https://api.dicionario-aberto.net/word/${encodeURIComponent(word)}`)) as { xml?: string }[];
  const entries: DictEntry[] = [];
  for (const item of arr) {
    if (!item.xml) continue;
    const doc = new DOMParser().parseFromString(item.xml, "text/xml");
    if (doc.querySelector("parsererror")) continue;
    doc.querySelectorAll("sense").forEach((sense) => {
      const def = squash(sense.querySelector("def")?.textContent);
      if (!def) return;
      entries.push({ pos: squash(sense.querySelector("gramGrp")?.textContent) || undefined, defs: [def] });
    });
  }
  return entries.slice(0, 10);
}

/** Procura no Wikcionário do idioma do app e, para português, no Dicionário Aberto. Devolve null se não existir. */
export async function lookup(raw: string, lang: Language = langOf()): Promise<DictResult | null> {
  const word = cleanWord(raw);
  if (!word) return null;
  const tries = [...new Set([word, word.toLowerCase()])];
  const sources: { labelKey: string; fn: (w: string) => Promise<DictEntry[]> }[] = [
    { labelKey: "dict.src.wikcionario", fn: (w) => wiktionary(lang, w) },
    ...(lang === "pt" ? [{ labelKey: "dict.src.dicionarioAberto", fn: dicionarioAberto }] : []),
  ];
  let failures = 0;
  let attempts = 0;
  for (const { labelKey, fn } of sources) {
    for (const t of tries) {
      attempts++;
      try {
        const entries = await fn(t);
        if (entries.length) return { word: t, source: tr(lang, labelKey), entries };
      } catch (e) {
        console.error(labelKey, e);
        failures++;
      }
    }
  }
  if (failures === attempts) throw new Error("offline");
  return null;
}
