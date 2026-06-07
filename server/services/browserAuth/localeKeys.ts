/**
 * Semantic UI keys mapped to locale-specific label patterns.
 * Used by LocalizationWrapper to find controls regardless of site language.
 */
export const LocaleKey = {
  SIGN_IN: "SIGN_IN",
  EMAIL: "EMAIL",
  USERNAME: "USERNAME",
  PASSWORD: "PASSWORD",
  SUBMIT: "SUBMIT",
  CONTINUE: "CONTINUE",
  VERIFY_CODE: "VERIFY_CODE",
  STAY_SIGNED_IN: "STAY_SIGNED_IN",
} as const;

export type LocaleKey = (typeof LocaleKey)[keyof typeof LocaleKey];

/** ISO 639-1 language codes supported out of the box. */
export type SupportedLocale = "en" | "pl" | "nl" | "de" | "fr";

type PatternSet = string[];

export const LOCALE_PATTERNS: Record<
  LocaleKey,
  Partial<Record<SupportedLocale, PatternSet>> & { en: PatternSet }
> = {
  [LocaleKey.SIGN_IN]: {
    en: ["sign in", "log in", "login"],
    pl: ["zaloguj", "logowanie", "zaloguj się"],
    nl: ["inloggen", "aanmelden", "log in"],
    de: ["anmelden", "einloggen"],
    fr: ["connexion", "se connecter"],
  },
  [LocaleKey.EMAIL]: {
    en: ["email", "e-mail"],
    pl: ["e-mail", "adres e-mail"],
    nl: ["e-mail", "e-mailadres"],
    de: ["e-mail"],
    fr: ["e-mail", "adresse e-mail"],
  },
  [LocaleKey.USERNAME]: {
    en: ["username", "user name", "user id"],
    pl: ["nazwa użytkownika", "login"],
    nl: ["gebruikersnaam"],
    de: ["benutzername"],
    fr: ["nom d'utilisateur"],
  },
  [LocaleKey.PASSWORD]: {
    en: ["password"],
    pl: ["hasło"],
    nl: ["wachtwoord"],
    de: ["passwort"],
    fr: ["mot de passe"],
  },
  [LocaleKey.SUBMIT]: {
    en: ["sign in", "log in", "submit", "continue"],
    pl: ["zaloguj", "dalej", "kontynuuj"],
    nl: ["inloggen", "doorgaan", "verzenden"],
    de: ["anmelden", "weiter"],
    fr: ["connexion", "continuer"],
  },
  [LocaleKey.CONTINUE]: {
    en: ["continue", "next"],
    pl: ["dalej", "kontynuuj"],
    nl: ["doorgaan", "volgende"],
    de: ["weiter"],
    fr: ["continuer", "suivant"],
  },
  [LocaleKey.VERIFY_CODE]: {
    en: ["verification code", "security code", "enter code", "otp"],
    pl: ["kod weryfikacyjny", "kod bezpieczeństwa"],
    nl: ["verificatiecode", "beveiligingscode"],
    de: ["bestätigungscode", "sicherheitscode"],
    fr: ["code de vérification"],
  },
  [LocaleKey.STAY_SIGNED_IN]: {
    en: ["stay signed in", "keep me signed in", "remember me"],
    pl: ["pozostań zalogowany"],
    nl: ["ingelogd blijven"],
    de: ["angemeldet bleiben"],
    fr: ["rester connecté"],
  },
};
