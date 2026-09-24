import clsx from "clsx";
import { GraduationCap, MapPin, RotateCcw, Send, Upload, Volleyball, X } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";
import type { Key } from "../lib/i18n";
import { usePrefs, useT } from "../prefs";
import { TourDemo } from "./TourDemo";
import { Button, IconButton } from "./ui";

const SLIDES: { icon: ReactNode; text: Key; title: Key }[] = [
  { icon: <Upload size={18} />, title: "guide.step1", text: "onb.s1" },
  { icon: <GraduationCap size={18} />, title: "guide.step2", text: "onb.s2" },
  { icon: <Volleyball size={18} />, title: "guide.step3", text: "onb.s3" },
  { icon: <MapPin size={18} />, title: "guide.step4", text: "onb.s4" },
  { icon: <Send size={18} />, title: "guide.step5", text: "onb.s5" },
];

/** Présentation animée du parcours à la première visite (réouvrable via « Guide »). */
export function Onboarding() {
  const t = useT();
  const { onboardingOpen, closeOnboarding } = usePrefs();
  const [i, setI] = useState(0);
  const [run, setRun] = useState(0);
  // enchaîne automatiquement les scènes ; la dernière reste affichée
  const next = useCallback(() => setI((k) => Math.min(k + 1, SLIDES.length - 1)), []);
  if (!onboardingOpen) return null;
  const close = () => {
    setI(0);
    closeOnboarding();
  };
  const last = i === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="onb-title">
      <div className="w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="relative bg-gradient-to-br from-indigo-600 to-violet-600 px-8 pb-6 pt-6 text-on">
          <IconButton label={t("common.close")} onClick={close} className="absolute right-4 top-4 text-on/80 hover:bg-white/10 hover:text-on">
            <X size={18} />
          </IconButton>
          <h2 id="onb-title" className="text-2xl font-bold">{t("onb.title")}</h2>
          <p className="mt-1 text-sm text-on/80">{t("onb.intro")}</p>
          <div className="mt-4 flex gap-1.5">
            {SLIDES.map((s, k) => (
              <span key={s.title} className={clsx("h-1 flex-1 rounded-full transition", k <= i ? "bg-on" : "bg-on/30")} />
            ))}
          </div>
        </div>
        <div className="grid gap-6 px-8 py-6 md:grid-cols-[16rem_1fr]">
          <ol className="space-y-1.5">
            {SLIDES.map((s, k) => (
              <li key={s.title}>
                <button
                  onClick={() => setI(k)}
                  aria-current={k === i ? "step" : undefined}
                  className={clsx("flex w-full items-start gap-3 rounded-2xl p-2.5 text-left transition", k === i ? "bg-indigo-50" : "hover:bg-slate-50")}
                >
                  <span
                    className={clsx(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                      k === i ? "bg-indigo-600 text-on" : k < i ? "bg-emerald-500 text-on" : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {s.icon}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">
                      {k + 1}. {t(s.title)}
                    </span>
                    {k === i && <span className="mt-0.5 block text-xs text-slate-600">{t(s.text)}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div className="flex flex-col gap-3">
            <TourDemo key={`${i}-${run}`} scene={i} onSceneEnd={next} />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">{t("onb.tip")}</p>
              <Button size="sm" variant="ghost" className="shrink-0 whitespace-nowrap" onClick={() => setRun((r) => r + 1)}>
                <RotateCcw size={14} /> {t("onb.replay")}
              </Button>
            </div>
          </div>
        </div>
        <div className="flex justify-between border-t border-slate-100 px-8 py-4">
          <Button variant="ghost" onClick={() => setI(i - 1)} disabled={i === 0}>
            {t("onb.prev")}
          </Button>
          {last ? (
            <Button variant="primary" onClick={close}>{t("onb.start")}</Button>
          ) : (
            <Button variant="primary" onClick={() => setI(i + 1)}>{t("onb.next")}</Button>
          )}
        </div>
      </div>
    </div>
  );
}
