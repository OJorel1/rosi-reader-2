export type Format = "pdf" | "epub" | "mobi" | "azw3" | "fb2" | "cbz" | "txt";
export type Language = "pt" | "en" | "es" | "fr" | "de" | "it"; // idioma da interface
export type Status = "quero" | "lendo" | "lido";
export type Loc = string | number; // PDF: nº da página · EPUB: CFI/href
export interface Rect { x: number; y: number; w: number; h: number } // 0..1 dentro da página

export interface Book {
  id: string;
  title: string;
  author: string;
  format: Format;
  path: string;
  cover?: string;
  addedAt: number;
  lastOpenedAt?: number;
  progress: number; // 0..1
  location: Loc;
  totalPages?: number;
  favorite: boolean;
  status?: Status; // se vazio, é calculado pelo progresso
  shelfIds?: string[];
  managed?: boolean; // arquivo copiado para dentro do app
}

export interface Shelf { id: string; name: string }

export interface Bookmark {
  id: string;
  bookId: string;
  location: Loc;
  label: string;
  createdAt: number;
}

export interface Clip {
  id: string;
  bookId: string;
  kind: "trecho" | "destaque";
  text: string;
  note?: string;
  color: string;
  location: Loc;
  pageLabel: string;
  rects?: Rect[]; // PDF: onde pintar o destaque na página
  createdAt: number;
}

export interface Settings {
  lang: Language;
  theme: "papel" | "sepia" | "noite";
  font: string;
  lineHeight: number;
  zoom: number; // 1 = ajustar à altura
  warm: number; // 0..0.5 filtro de luz quente
  ttsRate: number;
  ttsVoice?: string;
  dailyGoal: number; // minutos por dia
}

export type View =
  | "inicio"
  | "favoritos"
  | "livros"
  | "estantes"
  | "autores"
  | "vocabulario"
  | "trechos"
  | "marcadores"
  | "destaques"
  | "estatisticas"
  | "config";

export interface AuthorMeta { photo?: string; favorite?: boolean }
export interface UserProfile { name: string; photo?: string }
export interface VocabWord {
  id: string;
  word: string;
  meaning: string;
  bookId?: string;
  pageLabel?: string;
  createdAt: number;
}
export interface DayStat { sec: number; pages: number }
