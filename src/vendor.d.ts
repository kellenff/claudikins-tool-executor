declare module "wink-bm25-text-search" {
  export default function bm25(): unknown;
}

declare module "wink-nlp-utils" {
  const nlp: {
    string: {
      lowerCase: unknown;
      tokenize0: unknown;
    };
    tokens: {
      removeWords: unknown;
      stem: unknown;
    };
  };
  export default nlp;
}
