import { en, type MessageKey } from "./en";

/**
 * A deliberately small i18n layer (#409): a typed dictionary per locale and a
 * `t()` lookup with `{name}` interpolation. No i18n library is a dependency yet,
 * and the app ships English only, so this keeps the extraction work moving
 * without adding a dependency; swapping in `next-intl` later only changes this
 * file, because every call site already goes through `t()` with stable keys.
 */
const dictionaries = { en } as const;

export type Locale = keyof typeof dictionaries;
export type { MessageKey };

export const DEFAULT_UI_LOCALE: Locale = "en";

export function t(
  key: MessageKey,
  params: Record<string, string | number> = {},
  locale: Locale = DEFAULT_UI_LOCALE,
): string {
  const template: string = dictionaries[locale][key] ?? en[key];
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
