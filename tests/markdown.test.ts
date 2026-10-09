import { describe, expect, it } from "vitest";
import { firstImage, resolveWikilinks, splitDmBlocks, stripDmBlocks } from "../lib/markdown";
import { slugify, uniqueSlug } from "../lib/slug";

describe("bloques de máster", () => {
  const md = "Intro\n:::dm\nEl traidor es Kaiana\n:::\nFinal";

  it("separa tramos normales y de máster", () => {
    expect(splitDmBlocks(md)).toEqual([
      { dm: false, text: "Intro\n" },
      { dm: true, text: "El traidor es Kaiana\n" },
      { dm: false, text: "Final\n" },
    ]);
  });

  it("elimina el contenido secreto", () => {
    const out = stripDmBlocks(md);
    expect(out).not.toContain("Kaiana");
    expect(out).toContain("Intro");
    expect(out).toContain("Final");
  });

  it("un bloque sin cerrar oculta todo lo que sigue", () => {
    expect(stripDmBlocks("Visible\n:::dm\nsecreto\nmás secreto")).not.toContain("secreto");
  });

  it("acepta título y mayúsculas en la apertura", () => {
    expect(stripDmBlocks(":::DM Notas\nsecreto\n:::\nok")).toBe("ok\n");
  });
});

describe("wikilinks", () => {
  const pages = [
    { slug: "kaiana", title: "Kaiana" },
    { slug: "vigilantes-de-la-verdad", title: "Vigilantes de la Verdad" },
  ];

  it("enlaza por título, alias y ancla", () => {
    expect(resolveWikilinks("[[Kaiana]]", pages, "camp")).toBe("[Kaiana](/c/camp/p/kaiana)");
    expect(resolveWikilinks("[[kaiana|la espía]]", pages, "camp")).toBe("[la espía](/c/camp/p/kaiana)");
    expect(resolveWikilinks("[[Vigilantes de la Verdad#Iluminados|V]]", pages, "camp")).toBe(
      "[V](/c/camp/p/vigilantes-de-la-verdad#iluminados)",
    );
  });

  it("resuelve rutas estilo Obsidian por su último tramo", () => {
    expect(resolveWikilinks("[[Repo/Personajes/Kaiana]]", pages, "c")).toBe("[Kaiana](/c/c/p/kaiana)");
  });

  it("deja como texto las páginas que el lector no puede ver", () => {
    expect(resolveWikilinks("Habla con [[Ylt|el monje]].", pages, "c")).toBe("Habla con el monje.");
  });

  it("ofrece crear la página al máster", () => {
    expect(resolveWikilinks("[[Ylt]]", pages, "c", (t) => `/nueva?titulo=${t}`)).toBe("[Ylt](/nueva?titulo=Ylt)");
  });

  it("no toca los embeds de imagen", () => {
    expect(resolveWikilinks("![[mapa.png]]", pages, "c")).toBe("![[mapa.png]]");
  });
});

describe("utilidades", () => {
  it("slugify quita acentos y símbolos", () => {
    expect(slugify("Día 4: Tras la Pista de Doliente")).toBe("dia-4-tras-la-pista-de-doliente");
    expect(slugify("¿?")).toBe("pagina");
  });

  it("uniqueSlug numera duplicados", () => {
    expect(uniqueSlug("ylt", new Set(["ylt", "ylt-2"]))).toBe("ylt-3");
  });

  it("firstImage admite rutas entre <>", () => {
    expect(firstImage("hola ![](</img/a b.png>) y ![](/c.png)")).toBe("/img/a b.png");
    expect(firstImage("![x](/img/a%20b.png)")).toBe("/img/a%20b.png");
  });
});
