import type { Reading } from "./types";
export const sample: Reading = {
  title: "When AI starts using tools",
  subtitle: "A short reading to explore with Margin",
  kind: "Sample reading",
  url: "",
  text: `A language model can produce a convincing answer, but useful work often depends on information outside the conversation. An assistant helping with a research project might need to search a collection of papers, inspect a dataset, or look up the latest version of a technical specification.

This is where MCP enters the picture. The Model Context Protocol gives AI applications a shared way to connect to external tools and information. Instead of writing a different integration for every combination of application and data source, developers can build a client and connect it to compatible servers.

Consider an assistant reading a paper about climate change. A tool could retrieve a related dataset, while another searches a research library. The language model can use the returned information to develop an answer. The protocol provides the connection; the quality of the sources still matters.

Another approach you may encounter is retrieval-augmented generation, often abbreviated to RAG. A retrieval system finds relevant material and supplies it to a model as context. That material can help ground an answer in specific documents, although it does not automatically make every generated statement correct.

The distinction is useful: MCP describes how an application can connect to external capabilities, while RAG describes a pattern for retrieving information to support generation. An application can use both. It can also use either without the other.

When reading about unfamiliar systems, it helps to pause on the terms that connect the ideas. Ask what a term means in this paragraph, look for a primary source, and keep a note of the explanation that helped. A small question can open up an entirely new direction.`,
};
