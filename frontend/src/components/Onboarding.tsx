import clsx from "clsx";
import { GraduationCap, MapPin, Send, Upload, Volleyball, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Key } from "../lib/i18n";
import { usePrefs, useT } from "../prefs";
import { Button, IconButton } from "./ui";

const SLIDES: { icon: ReactNode; text: Key; title: Key }[] = [
  { icon: <Upload />, title: "guide.step1", text: "onb.s1" },
  { icon: <GraduationCap />, title: "guide.step2", text: "onb.s2" },
  { icon: <Volleyball />, title: "guide.step3", text: "onb.s3" },
  { icon: <MapPin />, title: "guide.step4", text: "onb.s4" },
  { icon: <Send />, title: "guide.step5", text: "onb.s5" },
];

/** Présentation du parcours à la première visite (réouvrable via « Guide »). */
export function Onboarding() {
  const t = useT();
  const { onboardingOpen, closeOnboarding } = usePrefs();
  const [i, setI] = useState(0);
  if (!onboardingOpen) return null;
  const close = () => {
    setI(0);
    closeOnboarding();
  };
  const last = i === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="onb-title">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="relative bg-gradient-to-br from-indigo-600 to-violet-600 px-8 pb-8 pt-7 text-on">
          <IconButton label={t("common.close")} onClick={close} className="absolute right-4 top-4 text-on/80 hover:bg-white/10 hover:text-on">
            <X size={18} />
          </IconButton>
          <h2 id="onb-title" className="text-2xl font-bold">{t("onb.title")}</h2>
          <p className="mt-1 text-sm text-on/80">{t("onb.intro")}</p>
        </div>
        <div className="px-8 py-6">
          <ol className="space-y-2">
            {SLIDES.map((s, k) => (
              <li key={s.title}>
                <button
                  onClick={() => setI(k)}
                  className={clsx(
                    "flex w-full items-start gap-4 rounded-2xl p-3 text-left transition",
                    k === i ? "bg-indigo-50" : "hover:bg-slate-50",
                  )}
                >
                  <span
                    className={clsx(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      k === i ? "bg-indigo-600 text-on" : k < i ? "bg-emerald-500 text-on" : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {s.icon}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">
                      {k + 1}. {t(s.title)}
                    </span>
                    {k === i && <span className="mt-0.5 block text-sm text-slate-600">{t(s.text)}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">{t("onb.tip")}</p>
          <div className="mt-6 flex justify-between">
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
    </div>
  );
}
