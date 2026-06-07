import type { Locator, Page } from "playwright";
import {
  LOCALE_PATTERNS,
  type LocaleKey,
  type SupportedLocale,
} from "./localeKeys";

export type LocalizedClickOptions = {
  role?: "button" | "link" | "textbox";
  exact?: boolean;
  timeoutMs?: number;
};

/**
 * Finds and interacts with UI elements by semantic key across locales.
 */
export class LocalizationWrapper {
  constructor(
    private readonly page: Page,
    private readonly locale: SupportedLocale = "en"
  ) {}

  patternsFor(key: LocaleKey): string[] {
    const entry = LOCALE_PATTERNS[key];
    return entry[this.locale] ?? entry.en;
  }

  private buildRegex(patterns: string[]): RegExp {
    const escaped = patterns.map((p) =>
      p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    );
    return new RegExp(escaped.join("|"), "i");
  }

  locatorByKey(key: LocaleKey, options: LocalizedClickOptions = {}): Locator {
    const re = this.buildRegex(this.patternsFor(key));
    const { role, exact = false } = options;

    if (role === "textbox") {
      return this.page.getByRole("textbox", { name: re, exact });
    }
    if (role === "link") {
      return this.page.getByRole("link", { name: re, exact });
    }
    if (role === "button") {
      return this.page.getByRole("button", { name: re, exact });
    }

    return this.page.getByRole("button", { name: re, exact }).or(
      this.page.getByRole("link", { name: re, exact })
    );
  }

  async clickByKey(
    key: LocaleKey,
    options: LocalizedClickOptions = {}
  ): Promise<void> {
    const timeout = options.timeoutMs ?? 15_000;
    const locator = this.locatorByKey(key, options);
    await locator.first().click({ timeout });
  }

  async fillByKey(
    key: LocaleKey,
    value: string,
    options: LocalizedClickOptions = {}
  ): Promise<void> {
    const timeout = options.timeoutMs ?? 15_000;
    const locator = this.locatorByKey(key, { ...options, role: "textbox" });
    await locator.first().fill(value, { timeout });
  }

  async fillLabeledField(
    key: LocaleKey,
    value: string,
    options: LocalizedClickOptions = {}
  ): Promise<void> {
    const re = this.buildRegex(this.patternsFor(key));
    const timeout = options.timeoutMs ?? 15_000;
    const byLabel = this.page.getByLabel(re, { exact: options.exact });
    const byPlaceholder = this.page.getByPlaceholder(re, { exact: options.exact });
    const field = byLabel.or(byPlaceholder).or(
      this.locatorByKey(key, { ...options, role: "textbox" })
    );
    await field.first().fill(value, { timeout });
  }
}
