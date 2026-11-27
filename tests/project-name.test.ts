import { describe, expect, it } from "vitest";
import { resolveProjectName, validateProjectName } from "../src/lib/profile";

const ACCEPTED = [
  "Scunthorpe Tools", "Essex Maps", "Assassin's Grid", "class-validator", "Analytics", "cockpit", "Cockroach DB",
  "Dickens", "pussycat-dolls-api", "Hancock", "sextant", "Sussex", "Middlesex Hospital API", "shitake", "Matsushita",
  "Arsenal", "bass", "grape", "therapist finder", "MongoDB", "nginx", "kill-port", "git-blame", "Hell's Kitchen Menu",
  "Damn Small Linux", "badass-cli", "snigger", "fagot", "Niggard Budget", "popcorn", "Rapeseed Co", "tiny-llm",
  "web3-kit", "k8s-lens", "Proyecto Árbol", "Café Ünder", "日本語ツール", "Scunthorpe.io", "a b c", "",
  "Brainfuck Interpreter", "brainfuck-rs", "A* Pathfinding", "*nix tools", "glob **/*.ts", "My **** Project", "C* Compiler",
  "f***", "**bold** notes", "Moby-Duck", "Cook Book", "Dock Manager", "print-server", "Spice Rack", "Tit for Tat",
  "Moby Dick Reader", "Philip K. Dick Bibliography", "Dick Tracy Fan Wiki",
];

const REJECTED = [
  "fuck", "FUCK", "Fuck Tools", "fuuuuck", "f u c k", "f.u.c.k", "f_u-c*k", "f​u​c​k", "fück",
  "fuсk" /* Cyrillic с */, "ｆｕｃｋ" /* fullwidth */, "motherfucker", "fuck3r",
  "cunt", "c u n t", "cunt!", "cuuunt", "CUNT-api", "p0rn", "porn hub", "pornography", "PORN",
  "pu55y", "pussy", "c0ck", "tits", "t1ts", "b00bs", "wh0re", "sluts", "n1gg3r",
  "nigg@", "nigger", "n i g g e r", "niggerlover", "faggot", "f4gg0t", "fag", "retard", "tranny", "orospu", "siktir",
  "Αρχηγός fuck", "hentai-archive", "blowjob", "handjob", "pedo", "pedophile", "wanker", "putain", "hurensohn",
  "ASSIST fuck", "my_fuck_project", "f*ck", "f**k", "F**K Tools", "c*nt", "p*rn", "p**n hub", "n*gger", "c*ck pics",
  "brainfuck fuck", "what the f*ck",
];

describe("validateProjectName", () => {
  it.each(ACCEPTED)("accepts %j", (name) => {
    expect(validateProjectName(name)).toBeNull();
  });

  it.each(REJECTED)("rejects %j without echoing it", (name) => {
    const error = validateProjectName(name);
    expect(error).toBe("Please choose a project name without explicit or offensive language.");
    expect(error).not.toContain(name.trim().toLowerCase());
  });
});

describe("resolveProjectName", () => {
  it("keeps a good typed name, trimmed and cut to the limit", () => {
    expect(resolveProjectName("  Tiny LLM ", "https://github.com/me/tool")).toEqual({ name: "Tiny LLM" });
    expect(resolveProjectName("x".repeat(100), "https://github.com/me/tool")).toEqual({ name: "x".repeat(80) });
  });

  it("rejects a bad typed name", () => {
    expect(resolveProjectName("f.u.c.k", "https://github.com/me/tool")).toHaveProperty("error");
  });

  it("derives a name from the link when none is typed, and drops a derived name that fails the check", () => {
    expect(resolveProjectName("", "https://github.com/me/tool")).toEqual({ name: "tool" });
    expect(resolveProjectName("  ", "https://github.com/me/fuck-tool")).toEqual({ name: null });
    expect(resolveProjectName("", "https://porn.example.com")).toEqual({ name: null });
  });
});
