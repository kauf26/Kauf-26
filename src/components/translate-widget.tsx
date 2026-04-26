import { useEffect, useRef, useState } from "react";
import { Globe } from "lucide-react";

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: any;
  }
}

// Maps ISO language codes to display names
const LANGUAGE_NAMES: Record<string, string> = {
  af: "Afrikaans", sq: "Shqip", am: "አማርኛ", ar: "العربية", hy: "Հայerен",
  az: "Azərbaycan", eu: "Euskara", be: "Беларуская", bn: "বাংলা", bs: "Bosanski",
  bg: "Български", ca: "Català", ceb: "Cebuano", zh: "中文", "zh-CN": "中文(简体)",
  "zh-TW": "中文(繁體)", co: "Corsu", hr: "Hrvatski", cs: "Čeština", da: "Dansk",
  nl: "Nederlands", en: "English", eo: "Esperanto", et: "Eesti", fi: "Suomi",
  fr: "Français", fy: "Frysk", gl: "Galego", ka: "ქართული", de: "Deutsch",
  el: "Ελληνικά", gu: "ગુજરાતી", ht: "Kreyòl ayisyen", ha: "Hausa", haw: "ʻŌlelo Hawaiʻi",
  he: "עברית", hi: "हिन्दी", hmn: "Hmoob", hu: "Magyar", is: "Íslenska",
  ig: "Igbo", id: "Bahasa Indonesia", ga: "Gaeilge", it: "Italiano", ja: "日本語",
  jv: "Basa Jawa", kn: "ಕನ್ನಡ", kk: "Қазақша", km: "ខ្មែរ", rw: "Kinyarwanda",
  ko: "한국어", ku: "Kurdî", ky: "Кыргызча", lo: "ລາວ", lv: "Latviešu",
  lt: "Lietuvių", lb: "Lëtzebuergesch", mk: "Македонски", mg: "Malagasy",
  ms: "Bahasa Melayu", ml: "മലയാളം", mt: "Malti", mi: "Te Reo Māori",
  mr: "मराठी", mn: "Монгол", my: "မြန်မာ", ne: "नेपाली", no: "Norsk",
  ny: "Chichewa", or: "ଓଡ଼ିଆ", ps: "پښتو", fa: "فارسی", pl: "Polski",
  pt: "Português", pa: "ਪੰਜਾਬੀ", ro: "Română", ru: "Русский", sm: "Samoan",
  gd: "Gàidhlig", sr: "Српски", st: "Sesotho", sn: "Shona", sd: "سنڌي",
  si: "සිංහල", sk: "Slovenčina", sl: "Slovenščina", so: "Soomaali", es: "Español",
  su: "Basa Sunda", sw: "Kiswahili", sv: "Svenska", tl: "Filipino", tg: "Тоҷикӣ",
  ta: "தமிழ்", tt: "Татарча", te: "తెలుగు", th: "ไทย", tr: "Türkçe",
  tk: "Türkmen", uk: "Українська", ur: "اردو", ug: "ئۇيغۇرچە", uz: "O'zbek",
  vi: "Tiếng Việt", cy: "Cymraeg", xh: "isiXhosa", yi: "ייִדיש", yo: "Yorùbá",
  zu: "isiZulu",
};

function detectBrowserLang(): string {
  const raw = navigator.language || "";
  const base = raw.split("-")[0].toLowerCase();
  if (raw === "zh-TW" || raw === "zh-HK") return "zh-TW";
  if (base === "zh") return "zh-CN";
  return base;
}

export default function TranslateWidget() {
  const [lang, setLang] = useState("en");
  const [open, setOpen] = useState(false);
  const [applied, setApplied] = useState("en");
  const initialized = useRef(false);

  useEffect(() => {
    const detected = detectBrowserLang();
    setLang(detected);

    if (detected !== "en") {
      applyTranslation(detected);
    }
  }, []);

  function applyTranslation(targetLang: string) {
    if (targetLang === "en") {
      // Reset: reload without Google Translate cookie
      const cookies = document.cookie.split(";");
      for (const c of cookies) {
        const [name] = c.trim().split("=");
        if (name === "googtrans") {
          document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
          document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=." + window.location.hostname;
        }
      }
      window.location.reload();
      return;
    }

    // Set googtrans cookie and load Google Translate
    const cookieVal = `/en/${targetLang}`;
    document.cookie = `googtrans=${cookieVal}; path=/`;
    document.cookie = `googtrans=${cookieVal}; path=/; domain=.${window.location.hostname}`;

    if (!initialized.current) {
      initialized.current = true;
      window.googleTranslateElementInit = () => {
        if (window.google?.translate) {
          new window.google.translate.TranslateElement(
            { pageLanguage: "en", autoDisplay: true },
            "__gt_container"
          );
        }
      };

      const existing = document.getElementById("__gt_script");
      if (!existing) {
        const s = document.createElement("script");
        s.id = "__gt_script";
        s.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
        s.async = true;
        document.head.appendChild(s);
      }
    } else if (window.google?.translate) {
      window.googleTranslateElementInit?.();
    }

    setApplied(targetLang);
    setOpen(false);
  }

  function handleSelect(targetLang: string) {
    setLang(targetLang);
    applyTranslation(targetLang);
    setOpen(false);
  }

  const displayName = LANGUAGE_NAMES[applied] || applied.toUpperCase();

  return (
    <div className="relative inline-block">
      <div id="__gt_container" className="hidden" aria-hidden="true" />

      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-white/10 rounded-lg px-3 py-1.5 bg-card hover:bg-muted/50"
        data-testid="translate-button"
        aria-label="Change language"
        aria-expanded={open}
      >
        <Globe className="w-3.5 h-3.5" />
        <span>{displayName}</span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-white/10 rounded-xl shadow-xl overflow-hidden w-52 max-h-72 overflow-y-auto">
            <div className="p-2 space-y-0.5">
              {Object.entries(LANGUAGE_NAMES).map(([code, name]) => (
                <button
                  key={code}
                  onClick={() => handleSelect(code)}
                  className={`w-full text-left text-xs px-3 py-2 rounded-lg transition-colors ${
                    lang === code
                      ? "bg-primary/20 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                  data-testid={`lang-option-${code}`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
