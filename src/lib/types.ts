export type Action = "explain" | "research" | "translate" | "simplify" | "examples" | "ask";
export type Source = { title: string; url: string; excerpt: string; kind: "reference" | "paper" | "official"; year?: number };
export type Selection = { text: string; context: string; title: string; url: string };
export type Insight = {
  id: string; selection: Selection; action: Action; answer: string; sources: Source[];
  createdAt: string; collectionId: string | null; note: string; provider: string;
};
export type Collection = { id: string; name: string; color: string; createdAt: string };
export type Reading = { title: string; subtitle: string; text: string; url: string; kind: string };
