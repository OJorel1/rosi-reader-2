import { t } from "./i18n";
import type { AuthorMeta, Book } from "../types";

export const authorKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

export interface AuthorGroup {
  key: string;
  name: string;
  books: Book[];
  photo?: string;
  favorite: boolean;
}

export function groupAuthors(books: Book[], meta: Record<string, AuthorMeta>): AuthorGroup[] {
  const map = new Map<string, AuthorGroup>();
  for (const b of books) {
    const key = authorKey(b.author);
    const g = map.get(key) ?? { key, name: b.author.trim(), books: [], photo: meta[key]?.photo, favorite: !!meta[key]?.favorite };
    g.books.push(b);
    map.set(key, g);
  }
  const unknown = authorKey(t("data.authorUnknown"));
  return [...map.values()].sort((a, b) =>
    a.key === unknown ? 1 : b.key === unknown ? -1 : a.name.localeCompare(b.name, "pt-BR"),
  );
}
