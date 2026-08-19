/**
 * 子画面の描画に失敗しても保存データには触れず、再試行できる画面を残します。
 */
import * as React from "react"

import { Button } from "~/ui/primitives"

type AppErrorBoundaryProps = React.PropsWithChildren<{
  onReset?: () => void
}>

type AppErrorBoundaryState = {
  error: Error | null
}

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  // React の Error Boundary は class のライフサイクルで描画エラーを受け取ります。
  // イベント処理や非同期処理のエラーは対象外なので、それぞれの処理側で扱います。
  state: AppErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error }
  }

  private reset = () => {
    this.setState({ error: null })
    this.props.onReset?.()
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <main className="grid min-h-dvh place-items-center bg-bm-accent p-4 text-bm-ink">
        <section
          aria-labelledby="app-error-title"
          className="w-full max-w-xl rounded-bm-dialog border-2 border-bm-border bg-bm-paper p-6 shadow-bm-floating"
          role="alert"
        >
          <p className="m-0 text-xs font-bold uppercase tracking-[0.18em] text-bm-muted-text">
            Bookmation
          </p>
          <h1 className="mb-0 mt-3 text-2xl font-bold" id="app-error-title">
            画面を表示できませんでした
          </h1>
          <p className="mb-0 mt-3 text-sm leading-6 text-bm-muted-text">
            保存済みデータは変更されていません。もう一度画面を読み込んでください。
          </p>
          <Button className="mt-6" onClick={this.reset} variant="solid">
            もう一度試す
          </Button>
        </section>
      </main>
    )
  }
}
