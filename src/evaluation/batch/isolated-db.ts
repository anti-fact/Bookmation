/**
 * 評価 run 用の隔離 DB 復元契約。
 * 各 run は fixture initialState + baseInput から開始し、先行 run を持ち越さない。
 */
import type { ClassificationEvaluationFixtureV3, Granularity } from "../types"
import { buildPromptInput } from "../prompt-input"
import { canonicalizeUnknown } from "../canonical-json"

export interface IsolatedEvalDbSnapshot {
  bookmarkId: string
  bookmarkRevision: number
  activeTagIds: string[]
  reservedTagTombstoneNormalizedNames: string[]
  categories: ClassificationEvaluationFixtureV3["baseInput"]["categories"]
  existingTags: ClassificationEvaluationFixtureV3["baseInput"]["existingTags"]
  granularity: Granularity
  destroyed: boolean
}

export interface IsolatedEvalDb {
  snapshot: IsolatedEvalDbSnapshot
  /** all-active-labels-v1 入力が fixture baseInput と一致するか */
  assertMatchesBaseInput(): void
  destroy(): void
}

export function restoreIsolatedEvalDb(
  fixture: ClassificationEvaluationFixtureV3,
  granularity: Granularity,
): IsolatedEvalDb {
  const snapshot: IsolatedEvalDbSnapshot = {
    bookmarkId: fixture.initialState.bookmarkId,
    bookmarkRevision: fixture.initialState.bookmarkRevision,
    activeTagIds: [...fixture.initialState.activeTagIds],
    reservedTagTombstoneNormalizedNames: [
      ...fixture.initialState.reservedTagTombstoneNormalizedNames,
    ],
    categories: fixture.baseInput.categories.map((c) => ({ ...c })),
    existingTags: fixture.baseInput.existingTags.map((t) => ({ ...t })),
    granularity,
    destroyed: false,
  }

  return {
    snapshot,
    assertMatchesBaseInput() {
      if (snapshot.destroyed) {
        throw new Error("isolated DB already destroyed")
      }
      const rebuilt = {
        categories: snapshot.categories,
        existingTags: snapshot.existingTags,
        bookmark: fixture.baseInput.bookmark,
      }
      const expected = {
        categories: fixture.baseInput.categories,
        existingTags: fixture.baseInput.existingTags,
        bookmark: fixture.baseInput.bookmark,
      }
      if (
        canonicalizeUnknown(rebuilt) !== canonicalizeUnknown(expected)
      ) {
        throw new Error(
          "isolated DB all-active-labels snapshot does not match fixture baseInput",
        )
      }
      // prompt 注入後の完全入力も構築可能であること
      buildPromptInput(fixture, granularity, null)
    },
    destroy() {
      snapshot.destroyed = true
      snapshot.activeTagIds = []
      snapshot.existingTags = []
      snapshot.categories = []
    },
  }
}
