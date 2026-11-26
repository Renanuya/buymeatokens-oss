import Markdown from "react-markdown";

/** Shared by the editor preview and the public page. Raw HTML is never rendered. */
export function ProfileMarkdown({ children }: { children: string }) {
  return (
    <div className="profile-markdown min-w-0 break-words leading-relaxed text-ink/75 [overflow-wrap:anywhere]">
      <Markdown
        skipHtml
        components={{
          h1: ({ children }) => <h2>{children}</h2>,
          h2: ({ children }) => <h3>{children}</h3>,
          h3: ({ children }) => <h4>{children}</h4>,
          a: ({ href, children }) => href
            ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
            : <span>{children}</span>,
          img: ({ alt }) => <span>{alt}</span>,
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}
