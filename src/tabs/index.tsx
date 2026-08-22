import "../style.css"

function DashboardPage() {
  return (
    <main className="min-h-screen bg-bm-paper p-6 text-bm-ink">
      <h1 className="text-lg font-semibold">Bookmation</h1>
      <p className="mt-2 max-w-xl text-sm text-bm-muted-text">
        Dashboard bootstrap（TASK-002）。ブックマーク一覧と route
        は後続タスクで追加します。
      </p>
      <p className="mt-4 text-xs text-bm-control-muted">
        予定 route: #/welcome, #/home, #/search, #/labels, #/settings/*
      </p>
    </main>
  )
}

export default DashboardPage
