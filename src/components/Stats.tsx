import { useMemo } from "react";
import { Flame, BookCheck, Clock, FileText } from "lucide-react";
import { dayKey, useStore } from "../store";
import { statusOf } from "../lib/books";
import { langCodeOf, useTr } from "../lib/i18n";

const GOALS = [10, 15, 20, 30, 45, 60, 90, 120];

export default function Stats() {
  const stats = useStore((s) => s.stats);
  const goal = useStore((s) => s.settings.dailyGoal);
  const lang = useStore((s) => s.settings.lang);
  const setSettings = useStore((s) => s.setSettings);
  const books = useStore((s) => s.books);
  const tr = useTr();

  const fmt = (sec: number) => {
    const m = Math.round(sec / 60);
    if (m < 60) return tr("stats.minFmt", { m });
    return tr("stats.hFmt", { h: Math.floor(m / 60), m: String(m % 60).padStart(2, "0") });
  };

  const d = useMemo(() => {
    const today = stats[dayKey()]?.sec ?? 0;
    // sequência: dias seguidos com pelo menos 1 minuto lido (hoje ainda pode estar zerado)
    let streak = 0;
    const cur = new Date();
    if ((stats[dayKey(cur)]?.sec ?? 0) < 60) cur.setDate(cur.getDate() - 1);
    while ((stats[dayKey(cur)]?.sec ?? 0) >= 60) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    }
    const week = Array.from({ length: 7 }, (_, i) => {
      const dt = new Date();
      dt.setDate(dt.getDate() - (6 - i));
      return { label: dt.toLocaleDateString(langCodeOf(lang), { weekday: "short" }).replace(/[.:]$/, ""), sec: stats[dayKey(dt)]?.sec ?? 0 };
    });
    const all = Object.values(stats);
    return {
      today, streak, week,
      totalSec: all.reduce((a, s) => a + s.sec, 0),
      totalPages: all.reduce((a, s) => a + s.pages, 0),
    };
  }, [stats, lang]);

  const goalSec = goal * 60;
  const pct = Math.min(1, d.today / goalSec);
  const max = Math.max(goalSec, ...d.week.map((w) => w.sec), 1);
  const finished = books.filter((b) => statusOf(b) === "lido").length;
  const R = 52, C = 2 * Math.PI * R;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{tr("stats.titulo")}</h1>
          <p className="muted">{tr("stats.sub")}</p>
        </div>
      </header>

      <div className="stats-top">
        <section className="glass stat-card goal">
          <svg width="130" height="130" viewBox="0 0 130 130" aria-hidden>
            <circle cx="65" cy="65" r={R} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="11" />
            <circle cx="65" cy="65" r={R} fill="none" stroke="url(#g)" strokeWidth="11" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 65 65)" />
            <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stopColor="#8b5df6" /><stop offset="1" stopColor="#f472b6" /></linearGradient></defs>
          </svg>
          <div>
            <h2>{tr("stats.metaHoje")}</h2>
            <p className="big">{fmt(d.today)} <span className="muted small">{tr("stats.ofGoal", { goal })}</span></p>
            <label className="opt"><span className="muted small">{tr("stats.metaDiaria")}</span>
              <select value={goal} onChange={(e) => setSettings({ dailyGoal: +e.target.value })}>
                {GOALS.map((g) => <option key={g} value={g}>{tr("stats.minFmt", { m: g })}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="stats-cards">
          <div className="glass stat-card"><Flame size={20} /><strong>{d.streak} {tr(d.streak === 1 ? "stats.diaSing" : "stats.diaPlural")}</strong><span className="muted small">{tr("stats.deSequencia")}</span></div>
          <div className="glass stat-card"><Clock size={20} /><strong>{fmt(d.totalSec)}</strong><span className="muted small">{tr("stats.deLeituraTotal")}</span></div>
          <div className="glass stat-card"><FileText size={20} /><strong>{d.totalPages}</strong><span className="muted small">{tr("stats.paginasViradas")}</span></div>
          <div className="glass stat-card"><BookCheck size={20} /><strong>{finished}</strong><span className="muted small">{tr(finished === 1 ? "stats.livroConcluido" : "stats.livrosConcluidos")}</span></div>
        </section>
      </div>

      <section className="glass stat-card week">
        <h2>{tr("stats.ultimos7dias")}</h2>
        <div className="bars">
          {d.week.map((w, i) => (
            <div key={i} className="bar-col" title={fmt(w.sec)}>
              <div className="bar-track"><i style={{ height: `${(w.sec / max) * 100}%` }} className={w.sec >= goalSec ? "hit" : ""} /></div>
              <span className="small muted">{w.label}</span>
            </div>
          ))}
        </div>
        <p className="muted small">{tr("stats.notaTempo")}</p>
      </section>
    </>
  );
}
