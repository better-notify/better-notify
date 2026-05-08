export const CodeEditor = ({ html, filename }: { html: string; filename?: string }) => (
  <div className="overflow-hidden rounded-lg border border-border">
    <div className="flex items-center gap-2 border-b border-border bg-fd-muted px-3 py-2">
      <div className="flex gap-1.5">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
      </div>
      {filename && <span className="text-muted-foreground ml-1 text-xs">{filename}</span>}
    </div>
    <div
      className="not-fumadocs-codeblock overflow-x-auto text-sm leading-relaxed [&_pre]:m-0 [&_pre]:overflow-x-auto [&_pre]:px-3 [&_pre]:py-3 [&_code]:p-0"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  </div>
);
