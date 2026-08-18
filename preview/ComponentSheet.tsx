import * as React from "react"

import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Select,
  Slider,
  Switch
} from "~/ui/primitives"

const visitPeriodOptions = [
  { label: "1週間", value: "LAST_7_DAYS" },
  { label: "1ヶ月", value: "LAST_30_DAYS" },
  { label: "1年", value: "LAST_365_DAYS" },
  { disabled: true, label: "カスタム（未対応）", value: "CUSTOM" }
]

const subdivisionDescriptions = [
  "AIによる新規タグ作成なし（既存タグの自動付与は継続）",
  "大まかなタグだけを提案",
  "標準的な細かさでタグを提案",
  "やや細かくタグを提案",
  "最も細かくタグを提案"
]

function SheetSection({
  children,
  description,
  title
}: React.PropsWithChildren<{ description: string; title: string }>) {
  return (
    <section
      aria-labelledby={`sheet-${title}`}
      className="rounded-bm-dialog border-2 border-bm-border bg-bm-paper p-5 sm:p-6"
    >
      <div className="mb-6 max-w-2xl">
        <h2 className="m-0 text-lg font-bold" id={`sheet-${title}`}>
          {title}
        </h2>
        <p className="mb-0 mt-2 text-sm leading-6 text-bm-muted-text">
          {description}
        </p>
      </div>
      {children}
    </section>
  )
}

export function ComponentSheet() {
  const [archiveEnabled, setArchiveEnabled] = React.useState(false)
  const [contextMenuEnabled, setContextMenuEnabled] = React.useState(true)
  const [granularity, setGranularity] = React.useState(2)
  const [visitPeriod, setVisitPeriod] = React.useState("LAST_30_DAYS")

  return (
    <main className="min-h-dvh bg-bm-accent px-4 py-8 text-bm-ink sm:px-8 lg:px-12">
      <div className="mx-auto grid max-w-6xl gap-6">
        <header className="rounded-bm-dialog border-2 border-bm-border bg-bm-paper p-6 shadow-bm-header">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="m-0 text-xs font-bold uppercase tracking-[0.18em] text-bm-muted-text">
                Test preview
              </p>
              <h1 className="mb-0 mt-2 text-2xl font-bold sm:text-3xl">
                Bookmation component-sheet
              </h1>
            </div>
            <span className="rounded-bm-pill bg-bm-panel px-4 py-2 text-xs font-semibold text-bm-on-panel">
              UI-01 / Radix Primitives
            </span>
          </div>
          <p className="mb-0 mt-4 max-w-3xl text-sm leading-6 text-bm-muted-text">
            本番と同じtokenとprimitiveを使う通常Webページです。ここでの操作はfixture内だけに留まり、Bookmationの保存データやChrome権限を変更しません。
          </p>
          <a
            className="mt-4 inline-flex rounded-bm-field font-semibold text-bm-ink underline decoration-2 underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-bm-focus"
            href="?view=app-shell#/home"
          >
            UI-02 App Shellを確認する
          </a>
        </header>

        <SheetSection
          description="Figmaの48px pillを基準に、default／danger／disabled／loadingとasChildを確認します。"
          title="Button"
        >
          <div className="flex flex-wrap items-center gap-4">
            <Button>保存する</Button>
            <Button variant="solid">作成する</Button>
            <Button tone="danger">削除する</Button>
            <Button disabled>無効</Button>
            <Button loading>保存中</Button>
            <Button asChild size="compact" variant="quiet">
              <a href="#dialog">Dialogへ移動</a>
            </Button>
          </div>
        </SheetSection>

        <SheetSection
          description="Portal、scrim、focus trap、Escape、閉じた後のtriggerへのfocus復帰をwrapperで提供します。"
          title="Dialog"
        >
          <div id="dialog">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="solid">編集Dialogを開く</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>ブックマークを編集</DialogTitle>
                  <DialogDescription>
                    UI-01ではDialogの共通挙動だけを確認します。実際の編集フォームはUI-05で実装します。
                  </DialogDescription>
                </DialogHeader>
                <div className="rounded-bm-field border-2 border-dashed border-bm-muted p-5 text-sm leading-6 text-bm-muted-text">
                  Tabキーで操作を移動し、Escapeキーまたは閉じる操作で戻れます。
                </div>
                <div className="mt-5">
                  <Select
                    label="Dialog内のSelect"
                    options={visitPeriodOptions}
                    placeholder="重なり順を確認"
                  />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button>キャンセル</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button variant="solid">保存する</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </SheetSection>

        <SheetSection
          description="checked／unchecked／disabled／pendingを並べ、label操作と実状態を一致させます。"
          title="Switch"
        >
          <div className="grid gap-3">
            <Switch
              checked={contextMenuEnabled}
              description="設定値のfixtureです。Chrome contextMenus APIは呼びません。"
              label="右クリックメニューから保存"
              onCheckedChange={setContextMenuEnabled}
            />
            <Switch
              checked={archiveEnabled}
              description="実装画面ではhistory権限が許可された場合だけONになります。"
              label="自動アーカイブ"
              onCheckedChange={setArchiveEnabled}
            />
            <Switch
              checked
              description="操作できない状態の視覚確認です。"
              disabled
              label="無効な設定"
            />
            <Switch
              checked
              description="保存中は二重操作を受け付けません。"
              label="保存処理中"
              pending
            />
          </div>
        </SheetSection>

        <SheetSection
          description="AI細分化度0〜4を1刻みで変更し、現在値と0の意味を常に表示します。"
          title="Slider"
        >
          <div className="flex flex-col gap-4">
            <Slider
              formatValue={(value) => `${value}`}
              label="AIタグの細分化"
              max={4}
              min={0}
              onValueChange={setGranularity}
              showMarks
              step={1}
              value={granularity}
            />
            <p aria-live="polite" className="m-0 text-sm text-bm-muted-text">
              {subdivisionDescriptions[granularity]}
            </p>
            <Slider
              defaultValue={2}
              disabled
              label="無効な細分化設定"
              max={4}
              min={0}
              showMarks
              step={1}
            />
          </div>
        </SheetSection>

        <SheetSection
          description="Figmaのaccent menuを基準に、placeholder／選択済み／disabled option／disabled triggerを確認します。"
          title="Select"
        >
          <div className="grid gap-6 md:grid-cols-3">
            <Select
              description="選択するとこのfixture内の状態だけを更新します。"
              label="訪問の集計期間"
              onValueChange={setVisitPeriod}
              options={visitPeriodOptions}
              value={visitPeriod}
            />
            <Select
              label="未選択の例"
              options={visitPeriodOptions}
              placeholder="期間を選択"
            />
            <Select
              defaultValue="LAST_7_DAYS"
              disabled
              label="無効な選択"
              options={visitPeriodOptions}
            />
          </div>
        </SheetSection>

        <footer className="rounded-bm-dialog bg-bm-panel p-5 text-sm leading-6 text-bm-on-panel">
          UI-01の対象はprimitive component sheetまでです。App
          Shell、実データ、全画面fixture、Playwright拡張E2Eは後続タスクで扱います。
        </footer>
      </div>
    </main>
  )
}
