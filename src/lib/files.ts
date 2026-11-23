import { open } from "@tauri-apps/plugin-dialog";
import { readFile, readDir } from "@tauri-apps/plugin-fs";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { isAndroid } from "./platform";

export const SUPPORTED = ["pdf", "epub", "mobi", "azw3", "fb2", "cbz", "txt"];
export const COMING_SOON: string[] = [];

export const extOf = (p: string) => p.split(".").pop()?.toLowerCase() ?? "";
export const baseName = (p: string) => p.split(/[\\/]/).pop() ?? p;

export const readBookFile = (path: string) => readFile(path);

export async function pickFiles(): Promise<string[]> {
  const r = await open({
    multiple: true,
    // no Android o seletor do sistema não conhece .epub; liberamos tudo e conferimos o conteúdo depois
    filters: isAndroid ? undefined : [{ name: "Livros", extensions: [...SUPPORTED, ...COMING_SOON] }],
  });
  return r ?? [];
}

export async function pickFolder(): Promise<string[]> {
  const dir = await open({ directory: true });
  return dir ? [dir] : [];
}

/** Expande pastas em arquivos de livros (recursivo). */
export async function expandPaths(paths: string[], depth = 0): Promise<string[]> {
  const out: string[] = [];
  for (const p of paths) {
    if (p.startsWith("content:")) {
      out.push(p);
      continue;
    }
    const ext = extOf(p);
    if (SUPPORTED.includes(ext) || COMING_SOON.includes(ext)) {
      out.push(p);
      continue;
    }
    if (depth > 4) continue;
    try {
      const entries = await readDir(p);
      const children = entries.map((e) => `${p}/${e.name}`);
      out.push(...(await expandPaths(children, depth + 1)));
    } catch {
      /* não é pasta: ignora */
    }
  }
  return out;
}

export function onFilesDropped(cb: (paths: string[]) => void) {
  return getCurrentWebview().onDragDropEvent((e) => {
    if (e.payload.type === "drop") cb(e.payload.paths);
  });
}

export async function pickImage(): Promise<string | null> {
  const r = await open({
    multiple: false,
    filters: [{ name: "Imagens", extensions: ["png", "jpg", "jpeg", "webp"] }],
  });
  return typeof r === "string" ? r : null;
}

/** Lê uma imagem, recorta o centro em quadrado e reduz para um avatar leve. */
export async function imageToAvatar(path: string, size = 256): Promise<string> {
  const bytes = await readFile(path);
  const bmp = await createImageBitmap(new Blob([bytes.slice()]));
  const side = Math.min(bmp.width, bmp.height);
  const c = document.createElement("canvas");
  c.width = c.height = Math.min(size, side);
  c.getContext("2d")!.drawImage(
    bmp,
    (bmp.width - side) / 2,
    (bmp.height - side) / 2,
    side,
    side,
    0,
    0,
    c.width,
    c.height,
  );
  return c.toDataURL("image/jpeg", 0.86);
}

/** Capa de livro: reduz mantendo a proporção. */
export async function imageToCover(path: string, width = 320): Promise<string> {
  const bytes = await readFile(path);
  const bmp = await createImageBitmap(new Blob([bytes.slice()]));
  const scale = Math.min(1, width / bmp.width);
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}
