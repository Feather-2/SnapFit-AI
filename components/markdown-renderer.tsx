"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import { cn } from "@/lib/utils"
import "katex/dist/katex.min.css"

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={cn("prose prose-sm max-w-none dark:prose-invert break-words overflow-wrap-anywhere word-break-break-all hyphens-auto w-full overflow-hidden", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // 自定义组件样式
          h1: ({ children }) => <h1 className="text-lg font-bold mb-2 mt-4 first:mt-0 break-words word-break-break-all">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-bold mb-2 mt-3 first:mt-0 break-words word-break-break-all">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-bold mb-1 mt-2 first:mt-0 break-words word-break-break-all">{children}</h3>,
          p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed break-words word-break-break-all overflow-wrap-anywhere">{children}</p>,
          strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-muted-foreground pl-4 italic my-2">{children}</blockquote>
          ),
          code: ({ inline, children }) =>
            inline ? (
              <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono break-words word-break-break-all">{children}</code>
            ) : (
              <pre className="bg-muted p-3 rounded-md overflow-x-auto my-2 max-w-full w-full">
                <code className="text-sm font-mono whitespace-pre-wrap break-words word-break-break-all block w-full">{children}</code>
              </pre>
            ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full border-collapse border border-border">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border px-2 py-1 bg-muted font-semibold text-left">{children}</th>
          ),
          td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
          a: ({ href, children }) => (
            <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          // 处理换行
          br: () => <br />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
