import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const mdComponents: Components = {
  p: ({ children }) => (
    <p className="mb-2 text-xs leading-relaxed last:mb-0 text-slate-800 dark:text-zinc-100">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0 text-xs text-slate-800 dark:text-zinc-100">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 list-decimal space-y-1 pl-4 last:mb-0 text-xs text-slate-800 dark:text-zinc-100">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-slate-900 dark:text-zinc-50">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="font-medium text-wellness-700 underline underline-offset-2 hover:text-wellness-900 dark:text-wellness-400 dark:hover:text-wellness-200"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  h1: ({ children }) => (
    <h3 className="mb-1 mt-3 text-sm font-bold first:mt-0 text-slate-900 dark:text-zinc-50">{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className="mb-1 mt-3 text-sm font-bold first:mt-0 text-slate-900 dark:text-zinc-50">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="mb-1 mt-2 text-xs font-bold uppercase tracking-wide text-slate-800 first:mt-0 dark:text-zinc-200">
      {children}
    </h4>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-wellness-500/50 pl-2 text-xs text-zinc-600 dark:text-zinc-400">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-zinc-200 dark:border-zinc-600" />,
  table: ({ children }) => (
    <div className="my-2 max-w-full overflow-x-auto">
      <table className="w-full border-collapse border border-zinc-200 text-[11px] dark:border-zinc-600">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-zinc-100 dark:bg-zinc-800">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-zinc-200 px-2 py-1 text-left font-semibold dark:border-zinc-600">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border border-zinc-200 px-2 py-1 dark:border-zinc-600">{children}</td>
  ),
  code: ({ className, children, ...props }) => {
    const inline = !className
    if (inline) {
      return (
        <code
          className="rounded bg-zinc-200/90 px-1 py-px font-mono text-[11px] text-slate-900 dark:bg-zinc-700/90 dark:text-zinc-100"
          {...props}
        >
          {children}
        </code>
      )
    }
    return (
      <code className={`font-mono text-[11px] text-zinc-100 ${className ?? ''}`} {...props}>
        {children}
      </code>
    )
  },
  pre: ({ children }) => (
    <pre className="mb-2 max-h-52 overflow-auto rounded-lg border border-zinc-700 bg-zinc-900 p-2 last:mb-0 dark:border-zinc-600">
      {children}
    </pre>
  ),
}

type AssistantMarkdownProps = {
  content: string
  className?: string
}

export const AssistantMarkdown = ({ content, className }: AssistantMarkdownProps) => (
  <div className={className}>
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
      {content}
    </ReactMarkdown>
  </div>
)
