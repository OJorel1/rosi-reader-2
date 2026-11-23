import { langCodeOf, langPrefix, type Language } from "./i18n";

export const hasTts = typeof window !== "undefined" && "speechSynthesis" in window;

/** Vozes do sistema que falam o idioma do app (sem vozes específicas, devolve todas). */
export function langVoices(lang: Language): SpeechSynthesisVoice[] {
  if (!hasTts) return [];
  const prefix = langPrefix(lang);
  const all = speechSynthesis.getVoices();
  const mine = all.filter((v) => v.lang.toLowerCase().startsWith(prefix));
  return mine.length ? mine : all;
}

/** Quebra o texto em pedaços curtos (o motor de voz trava com trechos muito longos). */
export function chunkText(text: string, max = 230): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?…]+[.!?…]*\s*/g) ?? [clean];
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (cur && (cur + s).length > max) {
      out.push(cur.trim());
      cur = "";
    }
    if (s.length > max) for (let i = 0; i < s.length; i += max) out.push(s.slice(i, i + max).trim());
    else cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Resolve true se a fala terminou normalmente, false se o sistema falhou. */
export function speak(text: string, voiceName: string | undefined, rate: number, lang: Language): Promise<boolean> {
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = langCodeOf(lang);
    u.rate = rate;
    const v = voiceName ? speechSynthesis.getVoices().find((x) => x.name === voiceName) : undefined;
    if (v) u.voice = v;
    u.onend = () => resolve(true);
    u.onerror = (e) => resolve(e.error === "canceled" || e.error === "interrupted");
    speechSynthesis.speak(u);
  });
}
