import type { MutableRefObject } from "react";
import type { Loc, Rect, Settings } from "../types";

export interface TocItem { label: string; loc: Loc; depth: number }
export interface SearchHit { loc: Loc; excerpt: string; label: string }
export interface Mark { id: string; color: string; loc: Loc; page?: number; rects?: Rect[] }
export interface SelectionExtra { rects?: Rect[] }

export interface ReaderControls {
  next(): void;
  prev(): void;
  goTo(loc: Loc): void;
  getToc(): Promise<TocItem[]>;
  search(q: string, onHit: (h: SearchHit) => void, cancelled: () => boolean): Promise<void>;
  /** texto da página atual e avanço para a próxima (leitura em voz alta) */
  speech: { read(): Promise<string>; advance(): Promise<boolean> };
}

export interface ReaderProps {
  data: Uint8Array;
  start: Loc;
  settings: Settings;
  ctrl: MutableRefObject<ReaderControls | null>;
  selectMode: boolean;
  marks: Mark[];
  onRelocate(loc: Loc, progress: number, label: string): void;
  onSelection(text: string, loc: Loc, pageLabel: string, extra?: SelectionExtra): void;
}
