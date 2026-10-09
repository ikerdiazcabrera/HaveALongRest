/* eslint-disable @next/next/no-img-element -- imágenes de usuario con URLs arbitrarias */
import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { splitDmBlocks } from "@/lib/markdown";

// Sin rehype-raw: el HTML que escriban los usuarios se muestra como texto (evita XSS).
const components: Components = {
  a({ href, children }) {
    if (href?.startsWith("/")) {
      const missing = href.includes("/nueva?titulo=");
      return (
        <Link
          href={href}
          className={missing ? "missing" : undefined}
          title={missing ? "Esta página aún no existe: pulsa para crearla" : undefined}
        >
          {children}
        </Link>
      );
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer nofollow">
        {children}
      </a>
    );
  },
  img({ src, alt }) {
    return <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} loading="lazy" />;
  },
  table({ children }) {
    return (
      <div className="table-wrap">
        <table>{children}</table>
      </div>
    );
  },
};

function Md({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSlug]} components={components}>
      {text}
    </ReactMarkdown>
  );
}

/**
 * Renderiza Markdown ya procesado (wikilinks resueltos). Los bloques `:::dm` solo se
 * muestran con `showDm`; aun así, para lectores normales el servidor ya los habrá quitado.
 */
export function MarkdownView({ content, showDm = false }: { content: string; showDm?: boolean }) {
  return (
    <div className="markdown">
      {splitDmBlocks(content).map((segment, i) =>
        segment.dm ? (
          showDm && (
            <aside key={i} className="dm-block">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold tracking-wider text-red-300 uppercase">
                🔒 Solo máster
              </div>
              <Md text={segment.text} />
            </aside>
          )
        ) : (
          <Md key={i} text={segment.text} />
        ),
      )}
    </div>
  );
}
