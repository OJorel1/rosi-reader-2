declare module "page-flip" {
  export interface FlipSettings {
    width: number;
    height: number;
    size?: "fixed" | "stretch";
    showCover?: boolean;
    drawShadow?: boolean;
    maxShadowOpacity?: number;
    flippingTime?: number;
    usePortrait?: boolean;
    startPage?: number;
    useMouseEvents?: boolean;
    mobileScrollSupport?: boolean;
    autoSize?: boolean;
  }
  export class PageFlip {
    constructor(el: HTMLElement, settings: FlipSettings);
    loadFromHTML(items: HTMLElement[] | NodeListOf<HTMLElement>): void;
    on(event: string, cb: (e: { data: unknown }) => void): this;
    flipNext(corner?: "top" | "bottom"): void;
    flipPrev(corner?: "top" | "bottom"): void;
    turnToPage(page: number): void;
    getCurrentPageIndex(): number;
    destroy(): void;
  }
}
