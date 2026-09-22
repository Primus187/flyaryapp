import i18n, { type BackendModule } from "i18next";
import { initReactI18next } from "react-i18next";
const languages = {
  de: () => import("./locales/de.json"),
  fr: () => import("./locales/fr.json"),
  en: () => import("./locales/en.json"),
};
const backend: BackendModule = {
  type: "backend",
  init() {},
  read(language, _namespace, callback) {
    const load = languages[language as keyof typeof languages] || languages.de;
    load().then((module) => callback(null, module.default)).catch((error) => callback(error, false));
  },
};

const savedLang = localStorage.getItem("flyary-language") || "de";

export const i18nReady = i18n.use(backend).use(initReactI18next).init({
  lng: savedLang,
  fallbackLng: "de",
  supportedLngs: ["de", "fr", "en"],
  load: "languageOnly",
  interpolation: { escapeValue: false },
});

export default i18n;
