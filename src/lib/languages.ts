const tags: Record<string, string> = { Vietnamese: "vi", English: "en", Spanish: "es", Korean: "ko", Japanese: "ja", French: "fr", German: "de", Chinese: "zh" };
export function languageTag(language?: string) { return language ? tags[language] : undefined; }
