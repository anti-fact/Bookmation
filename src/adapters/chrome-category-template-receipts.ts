import type {
  CategoryTemplateApplyReceipt,
  CategoryTemplateReceiptStore,
} from "~/application/category-templates"

const STORAGE_KEY = "bookmation_category_template_apply_receipts"

type StorageLocal = {
  get(key: string): Promise<Record<string, unknown>>
  set(items: Record<string, unknown>): Promise<void>
}

function isReceipt(value: unknown): value is CategoryTemplateApplyReceipt {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { requestId?: unknown }).requestId === "string" &&
    typeof (value as { requestFingerprint?: unknown }).requestFingerprint === "string" &&
    Array.isArray((value as { results?: unknown }).results)
  )
}

/** category template 適用だけの冪等 receipt。catalog本体や設定は保存しない。 */
export class ChromeCategoryTemplateReceiptStore implements CategoryTemplateReceiptStore {
  constructor(private readonly storage: StorageLocal = chrome.storage.local) {}

  private async all(): Promise<Record<string, CategoryTemplateApplyReceipt>> {
    const result = await this.storage.get(STORAGE_KEY)
    const raw = result[STORAGE_KEY]
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return {}
    const receipts: Record<string, CategoryTemplateApplyReceipt> = {}
    for (const [requestId, value] of Object.entries(raw as Record<string, unknown>)) {
      if (isReceipt(value)) receipts[requestId] = value
    }
    return receipts
  }

  async get(requestId: string): Promise<CategoryTemplateApplyReceipt | undefined> {
    return (await this.all())[requestId]
  }

  async put(receipt: CategoryTemplateApplyReceipt): Promise<void> {
    const receipts = await this.all()
    await this.storage.set({ [STORAGE_KEY]: { ...receipts, [receipt.requestId]: receipt } })
  }
}
