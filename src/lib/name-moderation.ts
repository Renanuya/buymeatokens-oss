// A local, deterministic check for explicit or offensive words in a project name.
//
// Rule: the name is normalised (NFKC, lower case, no diacritics or zero-width characters, Cyrillic/Greek
// look-alikes and leetspeak mapped to letters, apostrophes dropped) and split into tokens. A listed term must
// match a whole token; repeated letters are allowed ("fuuuck"). Runs of three or more single characters
// ("f u c k", "f.u.c.k") are joined into one token. Only the SUBSTRING terms may also match inside a longer
// token, because they are not parts of ordinary words. Symbols such as "!" and "@" are read both as letters
// and as separators, so "cunt!" and "c@nt" are both caught.
//
// This is a word list, not understanding. It does not cover other languages, images, context, spellings it
// does not map ("fu ck" split in the middle) or names made of innocent words. Mild profanity (shit, ass, damn,
// hell, bitch) is allowed on purpose: it is common in real project names.

/** Whole tokens only, so "Scunthorpe", "cockpit", "Hancock" and "Dickens" pass. */
const TOKEN_TERMS = [
  // sexual
  "cunt", "cock", "dick", "pussy", "twat", "wank", "wanker", "jizz", "slut", "whore", "tits", "boobs", "dildo",
  "milf", "porno", "pedo", "incest", "shemale", "fuk", "fck",
  // slurs
  "nigga", "fag", "tranny", "retard", "retarded", "spic", "chink", "gook", "wetback",
  // Turkish, Spanish, German, French, Portuguese
  "orospu", "siktir", "yarrak", "amcik", "pezevenk", "puta", "pendejo", "arschloch", "fotze", "hurensohn",
  "wichser", "putain", "encule", "connard", "salope", "caralho", "buceta",
];

/** Safe to match inside longer words ("motherfucker", "pornography"). */
const SUBSTRING_TERMS = ["fuck", "porn", "nigger", "faggot", "hentai", "blowjob", "handjob", "cumshot", "bukkake", "pedophil", "paedophil"];

const LOOKALIKES: Record<string, string> = {
  а: "a", в: "b", е: "e", к: "k", м: "m", н: "h", о: "o", р: "p", с: "c", т: "t", у: "y", х: "x", і: "i", ѕ: "s", ј: "j",
  α: "a", β: "b", ε: "e", ι: "i", κ: "k", ν: "v", ο: "o", ρ: "p", τ: "t", υ: "u", χ: "x",
  ı: "i", ø: "o", đ: "d", ł: "l", ß: "ss", æ: "ae", œ: "oe",
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "9": "g",
};
const SYMBOLS: Record<string, string> = { "@": "a", $: "s", "!": "i", "|": "i" };

// Every letter may repeat; two letters in a row in a term need two in the name, so "fagot" is not "faggot".
const spell = (term: string) => [...term].map((c) => `${c}+`).join("");
const WHOLE = new RegExp(`^(?:${[...TOKEN_TERMS, ...SUBSTRING_TERMS].map(spell).join("|")})s*$`);
const INSIDE = new RegExp(SUBSTRING_TERMS.map(spell).join("|"));

function tokens(text: string, symbolsAreLetters: boolean): string[] {
  const map = (c: string) => LOOKALIKES[c] ?? (symbolsAreLetters ? SYMBOLS[c] : undefined) ?? c;
  const plain = text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\p{Cf}/gu, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  const words = [...plain].map(map).join("").replace(/['’`]/g, "").split(/[^a-z0-9]+/);
  const out: string[] = [];
  let run = "";
  for (const word of [...words, ""]) {
    if (word.length === 1) {
      run += word;
      continue;
    }
    if (run.length >= 3) out.push(run);
    run = "";
    if (word) out.push(word);
  }
  return out;
}

export function hasOffensiveLanguage(name: string): boolean {
  return [true, false].some((symbolsAreLetters) =>
    tokens(name, symbolsAreLetters).some((token) => {
      // "snigger" is an ordinary word that contains a slur.
      const t = token.replace(/snigg(?:er|ers|ering|ered)/g, "");
      return WHOLE.test(t) || INSIDE.test(t);
    }),
  );
}
