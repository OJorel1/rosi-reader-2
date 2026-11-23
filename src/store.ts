import { create } from "zustand";
import { persist } from "zustand/middleware";
import { t } from "./lib/i18n";
import { authorKey } from "./lib/authors";
import type {
  AuthorMeta, Book, Bookmark, Clip, DayStat, Loc, Settings, Shelf, Status, UserProfile, View, VocabWord,
} from "./types";

export const uid = () => crypto.randomUUID();
export const dayKey = (d = new Date()) => d.toLocaleDateString("sv-SE"); // AAAA-MM-DD, horário local

const DEFAULT_SETTINGS: Settings = {
  lang: "pt",
  theme: "papel", font: "Georgia", lineHeight: 1.6, zoom: 1, warm: 0, ttsRate: 1, dailyGoal: 20,
};

export interface Backup {
  app: "rosi-reader";
  version: number;
  exportedAt: string;
  books: Book[];
  bookmarks: Bookmark[];
  clips: Clip[];
  settings: Settings;
  authors: Record<string, AuthorMeta>;
  profile: UserProfile;
  vocab: VocabWord[];
  shelves: Shelf[];
  stats: Record<string, DayStat>;
}

interface State {
  books: Book[];
  bookmarks: Bookmark[];
  clips: Clip[];
  settings: Settings;
  authors: Record<string, AuthorMeta>;
  profile: UserProfile;
  vocab: VocabWord[];
  shelves: Shelf[];
  stats: Record<string, DayStat>;

  view: View;
  openBookId: string | null;
  startAt: Loc | null;
  selectedAuthor: string | null;
  toast: string | null;

  addBooks: (b: Book[]) => void;
  removeBook: (id: string) => void;
  updateBook: (id: string, patch: Partial<Book>) => void;
  toggleFavorite: (id: string) => void;
  setStatus: (id: string, s: Status | undefined) => void;
  addShelf: (name: string) => string;
  renameShelf: (id: string, name: string) => void;
  removeShelf: (id: string) => void;
  setBookShelves: (bookId: string, ids: string[]) => void;
  addBookmark: (b: Omit<Bookmark, "id" | "createdAt">) => void;
  removeBookmark: (id: string) => void;
  addClip: (c: Omit<Clip, "id" | "createdAt">) => void;
  removeClip: (id: string) => void;
  setSettings: (p: Partial<Settings>) => void;
  setAuthorPhoto: (key: string, photo?: string) => void;
  toggleFavoriteAuthor: (key: string) => void;
  selectAuthor: (key: string | null) => void;
  renameAuthor: (oldKey: string, newName: string) => void;
  setProfile: (p: Partial<UserProfile>) => void;
  addWord: (w: Omit<VocabWord, "id" | "createdAt">) => void;
  removeWord: (id: string) => void;
  addReading: (sec: number, pages: number) => void;
  restore: (d: Partial<Backup>) => void;
  setView: (v: View) => void;
  openBook: (id: string | null, at?: Loc | null) => void;
  notify: (msg: string) => void;
}

let toastTimer: number | undefined;

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      books: [],
      bookmarks: [],
      clips: [],
      settings: DEFAULT_SETTINGS,
      authors: {},
      profile: { name: "" },
      vocab: [],
      shelves: [],
      stats: {},

      view: "inicio",
      openBookId: null,
      startAt: null,
      selectedAuthor: null,
      toast: null,

      addBooks: (b) => set((s) => ({ books: [...b, ...s.books] })),
      removeBook: (id) =>
        set((s) => ({
          books: s.books.filter((x) => x.id !== id),
          bookmarks: s.bookmarks.filter((x) => x.bookId !== id),
          clips: s.clips.filter((x) => x.bookId !== id),
        })),
      updateBook: (id, patch) =>
        set((s) => ({ books: s.books.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
      toggleFavorite: (id) =>
        set((s) => ({ books: s.books.map((b) => (b.id === id ? { ...b, favorite: !b.favorite } : b)) })),
      setStatus: (id, status) =>
        set((s) => ({ books: s.books.map((b) => (b.id === id ? { ...b, status } : b)) })),

      addShelf: (name) => {
        const id = uid();
        set((s) => ({ shelves: [...s.shelves, { id, name: name.trim() }] }));
        return id;
      },
      renameShelf: (id, name) =>
        set((s) => ({ shelves: s.shelves.map((x) => (x.id === id ? { ...x, name: name.trim() } : x)) })),
      removeShelf: (id) =>
        set((s) => ({
          shelves: s.shelves.filter((x) => x.id !== id),
          books: s.books.map((b) => (b.shelfIds?.includes(id) ? { ...b, shelfIds: b.shelfIds.filter((i) => i !== id) } : b)),
        })),
      setBookShelves: (bookId, ids) =>
        set((s) => ({ books: s.books.map((b) => (b.id === bookId ? { ...b, shelfIds: ids } : b)) })),

      addBookmark: (b) =>
        set((s) => ({ bookmarks: [{ ...b, id: uid(), createdAt: Date.now() }, ...s.bookmarks] })),
      removeBookmark: (id) => set((s) => ({ bookmarks: s.bookmarks.filter((x) => x.id !== id) })),
      addClip: (c) => set((s) => ({ clips: [{ ...c, id: uid(), createdAt: Date.now() }, ...s.clips] })),
      removeClip: (id) => set((s) => ({ clips: s.clips.filter((x) => x.id !== id) })),
      setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),

      setAuthorPhoto: (key, photo) =>
        set((s) => ({ authors: { ...s.authors, [key]: { ...s.authors[key], photo } } })),
      toggleFavoriteAuthor: (key) =>
        set((s) => ({ authors: { ...s.authors, [key]: { ...s.authors[key], favorite: !s.authors[key]?.favorite } } })),
      selectAuthor: (selectedAuthor) => set({ selectedAuthor }),
      renameAuthor: (oldKey, newName) =>
        set((s) => {
          const name = newName.trim();
          if (!name) return s;
          const newKey = authorKey(name);
          const books = s.books.map((b) => (authorKey(b.author) === oldKey ? { ...b, author: name } : b));
          const authors = { ...s.authors };
          const old = authors[oldKey];
          if (old && oldKey !== newKey) {
            delete authors[oldKey];
            authors[newKey] = {
              photo: authors[newKey]?.photo ?? old.photo,
              favorite: authors[newKey]?.favorite || old.favorite,
            };
          }
          return { books, authors, selectedAuthor: s.selectedAuthor === oldKey ? newKey : s.selectedAuthor };
        }),
      setProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
      addWord: (w) => set((s) => ({ vocab: [{ ...w, id: uid(), createdAt: Date.now() }, ...s.vocab] })),
      removeWord: (id) => set((s) => ({ vocab: s.vocab.filter((x) => x.id !== id) })),

      addReading: (sec, pages) => {
        const key = dayKey();
        const before = get().stats[key]?.sec ?? 0;
        set((s) => {
          const cur = s.stats[key] ?? { sec: 0, pages: 0 };
          return { stats: { ...s.stats, [key]: { sec: cur.sec + sec, pages: cur.pages + pages } } };
        });
        const goal = get().settings.dailyGoal * 60;
        if (goal > 0 && before < goal && before + sec >= goal) get().notify(t("stats.metaDiariaConcluida"));
      },

      restore: (d) =>
        set((s) => ({
          books: d.books ?? [],
          bookmarks: d.bookmarks ?? [],
          clips: d.clips ?? [],
          authors: d.authors ?? {},
          profile: d.profile ?? { name: "" },
          vocab: d.vocab ?? [],
          shelves: d.shelves ?? [],
          stats: d.stats ?? {},
          settings: { ...DEFAULT_SETTINGS, ...(d.settings ?? s.settings) },
          view: "inicio",
          openBookId: null,
          selectedAuthor: null,
        })),

      setView: (view) => set({ view, selectedAuthor: null }),
      openBook: (id, at = null) => set({ openBookId: id, startAt: at }),
      notify: (msg) => {
        window.clearTimeout(toastTimer);
        set({ toast: msg });
        toastTimer = window.setTimeout(() => set({ toast: null }), 3600);
      },
    }),
    {
      name: "rosi-reader:v1",
      partialize: (s) => ({
        books: s.books, bookmarks: s.bookmarks, clips: s.clips, settings: s.settings,
        authors: s.authors, profile: s.profile, vocab: s.vocab, shelves: s.shelves, stats: s.stats,
      }),
      // dados salvos em versões antigas não têm os campos novos: completa com os padrões
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return { ...current, ...p, settings: { ...current.settings, ...(p.settings ?? {}) } };
      },
    },
  ),
);

export function buildBackup(): Backup {
  const s = useStore.getState();
  return {
    app: "rosi-reader", version: 1, exportedAt: new Date().toISOString(),
    books: s.books, bookmarks: s.bookmarks, clips: s.clips, settings: s.settings, authors: s.authors,
    profile: s.profile, vocab: s.vocab, shelves: s.shelves, stats: s.stats,
  };
}
