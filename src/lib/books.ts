import { t } from "./i18n";
import type { Book, Status } from "../types";

export const statusLabel = (s: Status): string => t(`status.${s}`);

export const statusOf = (b: Book): Status =>
  b.status ?? (b.progress >= 0.97 ? "lido" : b.progress > 0 || b.lastOpenedAt ? "lendo" : "quero");
