import { ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { api, AuthError } from "../lib/api";
import type { Key } from "../lib/i18n";
import { useT } from "../prefs";
import { LoadingScreen, OrqeaButton, Screen } from "./Access";

const CODES = ["SSO_INVALID", "SSO_EXPIRED", "SSO_REPLAYED", "SSO_DISABLED", "SSO_MISSING"];

/** Lit le jeton dans le fragment (#sso=…) ; ne le met jamais dans localStorage/sessionStorage. */
export function readToken(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return params.get("sso") || null;
}

/** Le refus SSO ne renvoie que {code} : l'URL d'Orqea configurée vient du 401 de /api/me. */
async function learnOrqeaUrl() {
  try {
    await api.me();
  } catch (e) {
    if (e instanceof AuthError) useAuth.setState({ orqeaUrl: e.orqeaUrl });
  }
}

/** /sso#sso=<jeton> : efface le fragment AVANT l'appel réseau, échange le jeton, puis va sur « / ». */
export function SsoPage() {
  const t = useT();
  const navigate = useNavigate();
  const orqeaUrl = useAuth((s) => s.orqeaUrl);
  const [code, setCode] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = readToken(window.location.hash);
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    if (!token) {
      setCode("SSO_MISSING");
      void learnOrqeaUrl();
      return;
    }
    api
      .sso(token)
      .then(async () => {
        await useAuth.getState().check();
        navigate("/", { replace: true });
      })
      .catch((e: unknown) => {
        setCode(e instanceof AuthError && CODES.includes(e.code) ? e.code : "SSO_INVALID");
        void learnOrqeaUrl();
      });
  }, [navigate]);

  if (!code) return <LoadingScreen />;
  return (
    <Screen icon={<ShieldAlert />} title={t("sso.failed")} text={t(`sso.error.${code}` as Key)}>
      <OrqeaButton href={orqeaUrl} label={t("sso.back")} />
    </Screen>
  );
}
