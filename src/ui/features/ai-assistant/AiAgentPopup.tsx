import {
  Cross2Icon,
  MagicWandIcon,
  PaperPlaneIcon,
  ReloadIcon,
  ResetIcon
} from "@radix-ui/react-icons"
import * as React from "react"

import { Button, IconButton } from "~/ui/primitives"

import type {
  AiAssistantCandidate,
  AiAssistantPort,
  AiAssistantResponse
} from "./ai-assistant-port"

type AssistantState =
  | { status: "idle" }
  | { input: string; status: "processing" | "streaming" }
  | { input: string; response: AiAssistantResponse; status: "ready" }
  | { input: string; status: "error" }

export function AiAgentPopup({
  onLabelSelect,
  onSearch,
  port
}: {
  onLabelSelect: (filter: { id: string; kind: "category" | "tag" }) => void
  onSearch: (query: string) => void
  port: AiAssistantPort
}) {
  const [open, setOpen] = React.useState(false)
  const [input, setInput] = React.useState("")
  const [state, setState] = React.useState<AssistantState>({ status: "idle" })
  const request = React.useRef(0)
  const controller = React.useRef<AbortController | null>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)

  React.useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  React.useEffect(
    () => () => {
      controller.current?.abort()
    },
    []
  )

  const close = () => {
    setOpen(false)
    window.setTimeout(() => triggerRef.current?.focus(), 0)
  }
  const submit = async (nextInput = input) => {
    const value = nextInput.trim()
    if (!value) return
    controller.current?.abort()
    const current = ++request.current
    const abortController = new AbortController()
    controller.current = abortController
    setState({ input: value, status: "processing" })
    try {
      const response = await port.ask(value, {
        onProgress: (phase) => {
          if (request.current === current)
            setState({ input: value, status: phase })
        },
        signal: abortController.signal
      })
      if (request.current === current)
        setState({ input: value, response, status: "ready" })
    } catch (error) {
      if (
        request.current === current &&
        !(error instanceof DOMException && error.name === "AbortError")
      )
        setState({ input: value, status: "error" })
    }
  }
  const reset = () => {
    controller.current?.abort()
    request.current += 1
    setInput("")
    setState({ status: "idle" })
    inputRef.current?.focus()
  }
  const selectCandidate = (candidate: AiAssistantCandidate) => {
    if (candidate.entityType !== "LABEL") return
    onLabelSelect({
      id: candidate.id,
      kind: candidate.kind === "CATEGORY" ? "category" : "tag"
    })
    close()
  }
  const labels =
    state.status === "ready"
      ? state.response.candidates.filter(
          (candidate) => candidate.entityType === "LABEL"
        )
      : []
  const bookmarks =
    state.status === "ready"
      ? state.response.candidates.filter(
          (candidate) => candidate.entityType === "BOOKMARK"
        )
      : []

  return (
    <>
      <button
        aria-label="AIアシスタントを開く"
        className="fixed bottom-24 right-5 z-bm-floating inline-flex size-[3.125rem] items-center justify-center rounded-bm-pill border-2 border-bm-ink bg-bm-paper text-bm-ink shadow-bm-floating outline-none hover:bg-bm-ink hover:text-bm-paper focus-visible:ring-2 focus-visible:ring-bm-focus focus-visible:ring-offset-2 sm:right-8"
        onClick={() => setOpen(true)}
        ref={triggerRef}
        type="button"
      >
        <MagicWandIcon aria-hidden="true" className="size-5" />
      </button>

      {open ? (
        <section
          aria-label="AIアシスタント"
          aria-modal="false"
          className="fixed bottom-4 right-4 z-bm-dialog flex h-[min(42rem,calc(100dvh-2rem))] w-[min(28rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-bm-dialog border-2 border-bm-border bg-bm-paper text-bm-ink shadow-bm-floating max-sm:inset-0 max-sm:h-dvh max-sm:w-screen max-sm:rounded-none"
          onKeyDown={(event) => {
            if (event.key === "Escape") close()
          }}
          role="dialog"
        >
          <header className="flex items-center justify-between border-b-2 border-bm-border bg-bm-accent px-5 py-4">
            <div>
              <h2 className="m-0 text-lg font-bold">AIアシスタント</h2>
              <p className="m-0 mt-1 text-xs">
                保存済み項目の検索とBookmationの使い方案内
              </p>
            </div>
            <IconButton label="AIアシスタントを閉じる" onClick={close}>
              <Cross2Icon className="size-5" />
            </IconButton>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {state.status === "idle" ? (
              <p className="m-0 text-sm leading-6 text-bm-muted-text">
                例: 「Reactの資料を探して」「共有機能の使い方を教えて」
              </p>
            ) : null}
            {state.status === "processing" || state.status === "streaming" ? (
              <p className="m-0 text-sm" role="status">
                {state.status === "processing"
                  ? "内容を確認しています…"
                  : "応答を生成しています…"}
              </p>
            ) : null}
            {state.status === "error" ? (
              <div role="alert">
                <p className="mt-0">応答を取得できませんでした。</p>
                <Button onClick={() => void submit(state.input)} size="compact">
                  <ReloadIcon className="size-4" />
                  再試行
                </Button>
              </div>
            ) : null}
            {state.status === "ready" ? (
              <div className="space-y-6">
                <div aria-live="polite">
                  <p className="m-0 text-sm leading-6">
                    {state.response.answerText}
                  </p>
                  {!state.response.aiAvailable ? (
                    <p className="mb-0 mt-3 rounded-bm-field border border-bm-border bg-bm-panel p-3 text-xs text-bm-on-panel">
                      AIを利用できないため、字句検索または静的ヘルプで回答しています。
                    </p>
                  ) : null}
                </div>
                {labels.length ? (
                  <section aria-labelledby="ai-label-results">
                    <h3 className="text-sm" id="ai-label-results">
                      カテゴリ・タグ
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {labels.map((candidate) =>
                        candidate.entityType === "LABEL" ? (
                          <button
                            className="rounded-bm-chip border-2 border-bm-border px-3 py-2 text-sm hover:bg-bm-ink hover:text-bm-paper"
                            key={candidate.id}
                            onClick={() => selectCandidate(candidate)}
                            type="button"
                          >
                            #{candidate.name}
                          </button>
                        ) : null
                      )}
                    </div>
                  </section>
                ) : null}
                {bookmarks.length ? (
                  <section aria-labelledby="ai-bookmark-results">
                    <h3 className="text-sm" id="ai-bookmark-results">
                      ブックマーク
                    </h3>
                    <ul className="m-0 grid list-none gap-2 p-0">
                      {bookmarks.map((candidate) =>
                        candidate.entityType === "BOOKMARK" ? (
                          <li
                            className="rounded-bm-field border-2 border-bm-border p-3"
                            key={candidate.id}
                          >
                            <a
                              className="font-semibold text-bm-ink"
                              href={candidate.normalizedUrl}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {candidate.title}
                            </a>
                          </li>
                        ) : null
                      )}
                    </ul>
                  </section>
                ) : null}
                {state.response.query ? (
                  <Button
                    onClick={() => {
                      onSearch(state.response.query ?? "")
                      close()
                    }}
                    size="compact"
                    variant="outline"
                  >
                    全画面検索で開く
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          <form
            className="border-t-2 border-bm-border p-4"
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            <label className="text-sm font-bold" htmlFor="ai-assistant-input">
              質問または検索内容
            </label>
            <textarea
              className="mt-2 min-h-20 w-full resize-none rounded-bm-field border-2 border-bm-border bg-bm-paper p-3 outline-none focus-visible:ring-2 focus-visible:ring-bm-focus"
              disabled={
                state.status === "processing" || state.status === "streaming"
              }
              id="ai-assistant-input"
              maxLength={500}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Bookmationについて質問する"
              ref={inputRef}
              value={input}
            />
            <div className="mt-3 flex justify-between gap-3">
              <Button
                onClick={reset}
                size="compact"
                type="button"
                variant="quiet"
              >
                <ResetIcon className="size-4" />
                リセット
              </Button>
              <Button
                disabled={
                  !input.trim() ||
                  state.status === "processing" ||
                  state.status === "streaming"
                }
                size="compact"
                type="submit"
              >
                <PaperPlaneIcon className="size-4" />
                送信
              </Button>
            </div>
          </form>
        </section>
      ) : null}
    </>
  )
}
