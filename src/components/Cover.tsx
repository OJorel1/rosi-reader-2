import type { Book } from "../types";

const hue = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

export default function Cover({ book }: { book: Pick<Book, "title" | "cover"> }) {
  if (book.cover) return <img className="cover" src={book.cover} alt="" draggable={false} />;
  const h = hue(book.title);
  return (
    <div className="cover fallback" style={{ background: `linear-gradient(155deg, hsl(${h} 55% 38%), hsl(${(h + 50) % 360} 60% 16%))` }}>
      <span>{book.title}</span>
    </div>
  );
}
