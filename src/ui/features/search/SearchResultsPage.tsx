import * as React from "react"
import type { SearchPort } from "./search-port"

export function SearchResultsPage({
  onLabelSelect,
  port,
  query
}: {
  onLabelSelect: (filter: { id: string; kind: "category" | "tag" }) => void
  port: SearchPort
  query: string
}) {
  const [state, setState] = React.useState<
    | { status: "loading" }
    | { status: "error" }
    | { status: "ready"; result: Awaited<ReturnType<SearchPort["search"]>> }
  >({ status: "loading" })
  React.useEffect(() => {
    let active = true
    setState({ status: "loading" })
    void port
      .search(query)
      .then((result) => {
        if (active) setState({ result, status: "ready" })
      })
      .catch(() => {
        if (active) setState({ status: "error" })
      })
    return () => {
      active = false
    }
  }, [port, query])
  if (state.status === "loading")
    return <p aria-live="polite">検索しています</p>
  if (state.status === "error")
    return <p role="alert">検索結果を取得できませんでした</p>
  const { result } = state
  return (
    <div className="space-y-10">
      <section aria-labelledby="search-labels">
        <h2 id="search-labels">カテゴリ・タグ</h2>
        {result.labels.length ? (
          <div className="flex flex-wrap gap-3">
            {result.labels.map((item) => (
              <button
                className="rounded-bm-chip border-2 border-bm-border px-4 py-2 hover:bg-bm-ink hover:text-bm-paper"
                key={item.id}
                onClick={() =>
                  onLabelSelect({
                    id: item.id,
                    kind: item.kind === "CATEGORY" ? "category" : "tag"
                  })
                }
                type="button"
              >
                #{item.name}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-bm-muted-text">
            該当するカテゴリ・タグはありません
          </p>
        )}
      </section>
      <section aria-labelledby="search-bookmarks">
        <h2 id="search-bookmarks">ブックマーク</h2>
        {result.bookmarks.length ? (
          <ul className="grid list-none gap-3 p-0">
            {result.bookmarks.map((item) => (
              <li
                className="rounded-bm-field border-2 border-bm-border bg-bm-paper p-4"
                key={item.id}
              >
                <a
                  className="font-semibold text-bm-ink"
                  href={item.normalizedUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  {item.title}
                </a>
                <p className="mb-0 mt-2 truncate text-xs text-bm-muted-text">
                  {item.normalizedUrl}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-bm-muted-text">該当するブックマークはありません</p>
        )}
      </section>
      <p className="text-xs text-bm-muted-text">
        検索方法: {result.source === "AI" ? "AI" : "キーワード"}
      </p>
    </div>
  )
}
