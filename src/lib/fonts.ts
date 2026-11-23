// Cada opção tem alternativas: no Windows usa a fonte do sistema, no Linux cai nas equivalentes.
import { t } from "./i18n";

interface FontOption { value: string; label: string; stack: string }

export function fontOptions(): FontOption[] {
  return [
    { value: "Georgia", label: t("font.serifada"), stack: "Georgia, 'Noto Serif', 'Liberation Serif', 'DejaVu Serif', serif" },
    { value: "Cambria", label: t("font.classica"), stack: "Cambria, 'Noto Serif Display', 'Liberation Serif', 'Times New Roman', serif" },
    { value: "Segoe UI", label: t("font.semSerifa"), stack: "'Segoe UI', 'Noto Sans', 'Liberation Sans', 'DejaVu Sans', sans-serif" },
    { value: "Consolas", label: t("font.monoespaçada"), stack: "Consolas, 'JetBrains Mono', 'DejaVu Sans Mono', 'Liberation Mono', monospace" },
  ];
}

export const fontStack = (v: string) => fontOptions().find((f) => f.value === v)?.stack ?? `${v}, serif`;
