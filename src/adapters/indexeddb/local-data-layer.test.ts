import "fake-indexeddb/auto"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { STORES } from "~/adapters/indexeddb/stores"
import { LocalDataLayer } from "~/adapters/indexeddb/local-data-layer"
import { DomainErrorCode } from "~/domain"

function uuid(): string {
  return crypto.randomUUID()
}

function testDbName(): string {
  return `bookmation-test-${uuid()}`
}

describe("LocalDataLayer", () => {
  let dbName: string
  let layer: LocalDataLayer

  beforeEach(async () => {
    dbName = testDbName()
    layer = await LocalDataLayer.open(dbName)
  })

  afterEach(async () => {
    await layer.close()
    indexedDB.deleteDatabase(dbName)
  })

  describe("M1: Bookmark persistence", () => {
    it("saves bookmark and survives reopen", async () => {
      const id = uuid()
      const creationRequestId = uuid()
      const jobId = uuid()

      const { bookmark } = await layer.saveBookmarkWithJob({
        id,
        rawUrl: "https://example.com/page",
        title: "Example",
        creationRequestId,
        jobId,
        now: 1000,
      })

      expect(bookmark.normalizedUrl).toBe("https://example.com/page")
      expect(bookmark.classificationState).toBe("PENDING")
      await layer.close()

      const reopened = await LocalDataLayer.open(dbName)
      const loaded = await reopened.getBookmark(id)
      await reopened.close()

      expect(loaded?.title).toBe("Example")
      expect(loaded?.revision).toBe(1)
    })

    it("validates schemaVersion through repository helpers", async () => {
      const { assertPersistableDocument } = await import("./document-validation")
      expect(() =>
        assertPersistableDocument(STORES.bookmarks, {
          schemaVersion: 999,
          id: uuid(),
          title: "x",
        }),
      ).toThrow(DomainErrorCode.INVALID_JSON_VALUE)
    })
  })

  describe("M2: Label unique names and tombstone reservation", () => {
    it("normalizes category name on create", async () => {
      const cat = await layer.createCategory({
        id: uuid(),
        name: "  Ｐｙｔｈｏｎ　入門 ",
        creationRequestId: uuid(),
      })
      expect(cat.normalizedName).toBe("python 入門")
      expect(cat.categoryUniqueName).toBe("python 入門")
    })

    it("rejects duplicate name while tombstone exists", async () => {
      const catId = uuid()
      const cat = await layer.createCategory({
        id: catId,
        name: "Python",
        creationRequestId: uuid(),
      })
      const tx = layer.rawDb.transaction(STORES.labels, "readwrite")
      await tx.store.put({
        ...cat,
        deletedAt: Date.now(),
        revision: cat.revision + 1,
        updatedAt: Date.now(),
      })
      await tx.done

      await expect(
        layer.createCategory({
          id: uuid(),
          name: "Python",
          creationRequestId: uuid(),
        }),
      ).rejects.toThrow(DomainErrorCode.DUPLICATE_NORMALIZED_NAME)
    })

    it("requires active parent for tag create", async () => {
      const cat = await layer.createCategory({
        id: uuid(),
        name: "Lang",
        creationRequestId: uuid(),
      })

      const tag = await layer.createTag({
        id: uuid(),
        name: "Django",
        parentCategoryId: cat.id,
        expectedParentRevision: cat.revision,
        creationRequestId: uuid(),
      })
      expect(tag.parentCategoryId).toBe(cat.id)
    })
  })

  describe("M3: edge idempotency and bookmark+job transaction", () => {
    it("reuses same job on creationRequestId retry", async () => {
      const id = uuid()
      const creationRequestId = uuid()
      const jobId = uuid()

      const first = await layer.saveBookmarkWithJob({
        id,
        rawUrl: "https://a.example/",
        title: "A",
        creationRequestId,
        jobId,
      })
      const second = await layer.saveBookmarkWithJob({
        id: uuid(),
        rawUrl: "https://b.example/",
        title: "B",
        creationRequestId,
        jobId: uuid(),
      })

      expect(second.job.id).toBe(first.job.id)
      expect(second.bookmark.id).toBe(first.bookmark.id)

      const jobs = await layer.rawDb.getAll(STORES.classificationJobs)
      expect(jobs).toHaveLength(1)
    })

    it("assignTagEdge is idempotent for same pair", async () => {
      const bookmarkId = uuid()
      await layer.saveBookmarkWithJob({
        id: bookmarkId,
        rawUrl: "https://example.com/",
        title: "T",
        creationRequestId: uuid(),
        jobId: uuid(),
      })
      const cat = await layer.createCategory({
        id: uuid(),
        name: "Cat",
        creationRequestId: uuid(),
      })
      const tag = await layer.createTag({
        id: uuid(),
        name: "Tag1",
        parentCategoryId: cat.id,
        expectedParentRevision: cat.revision,
        creationRequestId: uuid(),
      })

      const bm = (await layer.getBookmark(bookmarkId))!
      const e1 = await layer.assignTagEdge({
        bookmarkId,
        tagId: tag.id,
        expectedBookmarkRevision: bm.revision,
      })
      const bm2 = (await layer.getBookmark(bookmarkId))!
      const e2 = await layer.assignTagEdge({
        bookmarkId,
        tagId: tag.id,
        expectedBookmarkRevision: bm2.revision,
      })
      expect(e2.id).toBe(e1.id)

      const edges = await layer.rawDb.getAll(STORES.bookmarkLabels)
      expect(edges.filter((e) => e.deletedAt === null)).toHaveLength(2)
    })
  })

  describe("M4: UpdateTag", () => {
    async function seedTagGraph() {
      const bookmarkId = uuid()
      await layer.saveBookmarkWithJob({
        id: bookmarkId,
        rawUrl: "https://example.com/x",
        title: "X",
        creationRequestId: uuid(),
        jobId: uuid(),
      })
      const cat1 = await layer.createCategory({
        id: uuid(),
        name: "Cat1",
        creationRequestId: uuid(),
      })
      const cat2 = await layer.createCategory({
        id: uuid(),
        name: "Cat2",
        creationRequestId: uuid(),
      })
      const tag = await layer.createTag({
        id: uuid(),
        name: "MyTag",
        parentCategoryId: cat1.id,
        expectedParentRevision: cat1.revision,
        creationRequestId: uuid(),
      })
      const bm = (await layer.getBookmark(bookmarkId))!
      await layer.assignTagEdge({
        bookmarkId,
        tagId: tag.id,
        expectedBookmarkRevision: bm.revision,
      })
      return { bookmarkId, cat1, cat2, tag }
    }

    it("updates tag parent and fan-out bookmark category edges", async () => {
      const { cat2, tag } = await seedTagGraph()
      const freshTag = (await layer.getLabel(tag.id))!

      const result = await layer.updateTag({
        tagId: tag.id,
        expectedTagRevision: freshTag.revision,
        name: "MyTag",
        parentCategoryId: cat2.id,
        expectedParentRevision: cat2.revision,
        requestId: `tag-update:${uuid()}`,
      })

      expect(result.affectedBookmarkCount).toBe(1)
      expect(result.resultTagRevision).toBe(freshTag.revision + 1)
    })

    it("returns same UpdateTagResult on request retry", async () => {
      const { cat2, tag } = await seedTagGraph()
      const freshTag = (await layer.getLabel(tag.id))!
      const requestId = `tag-update:${uuid()}` as const
      const command = {
        tagId: tag.id,
        expectedTagRevision: freshTag.revision,
        name: "Renamed",
        parentCategoryId: cat2.id,
        expectedParentRevision: cat2.revision,
        requestId,
      }

      const r1 = await layer.updateTag(command)
      const r2 = await layer.updateTag(command)
      expect(r2).toEqual(r1)

      const jobs = await layer.rawDb.getAll(STORES.classificationJobs)
      const cascadeJobs = jobs.filter((j) => j.reason === "CATEGORY_CASCADE_DELETE")
      expect(cascadeJobs).toHaveLength(0)
    })

    it("rejects requestId reuse with different payload", async () => {
      const { cat2, tag } = await seedTagGraph()
      const freshTag = (await layer.getLabel(tag.id))!
      const requestId = `tag-update:${uuid()}` as const

      await layer.updateTag({
        tagId: tag.id,
        expectedTagRevision: freshTag.revision,
        name: "A",
        parentCategoryId: cat2.id,
        expectedParentRevision: cat2.revision,
        requestId,
      })

      await expect(
        layer.updateTag({
          tagId: tag.id,
          expectedTagRevision: freshTag.revision + 1,
          name: "B",
          parentCategoryId: cat2.id,
          expectedParentRevision: cat2.revision,
          requestId,
        }),
      ).rejects.toThrow(DomainErrorCode.REQUEST_ID_REUSED)
    })
  })

  describe("M5: Category cascade delete", () => {
    it("cascade soft-deletes and creates pending reclassification jobs", async () => {
      const bookmarkId = uuid()
      await layer.saveBookmarkWithJob({
        id: bookmarkId,
        rawUrl: "https://example.com/y",
        title: "Y",
        creationRequestId: uuid(),
        jobId: uuid(),
      })
      const cat = await layer.createCategory({
        id: uuid(),
        name: "ToDelete",
        creationRequestId: uuid(),
      })
      const tag = await layer.createTag({
        id: uuid(),
        name: "Child",
        parentCategoryId: cat.id,
        expectedParentRevision: cat.revision,
        creationRequestId: uuid(),
      })
      const bm = (await layer.getBookmark(bookmarkId))!
      await layer.assignTagEdge({
        bookmarkId,
        tagId: tag.id,
        expectedBookmarkRevision: bm.revision,
      })

      const detail = await layer.getCategoryEditDetail(cat.id)
      const command = {
        categoryId: cat.id,
        expectedCategoryRevision: cat.revision,
        expectedImpactFingerprint: detail.impactFingerprint,
        requestId: `category-delete:${uuid()}` as const,
        warningAcknowledged: true as const,
      }

      const result = await layer.deleteCategoryCascade(command)
      expect(result.alreadyCompleted).toBe(false)
      expect(result.affectedBookmarkCount).toBe(1)
      expect(result.jobsCreated).toBe(1)

      const stillThere = await layer.getBookmark(bookmarkId)
      expect(stillThere?.deletedAt).toBeNull()
      expect(stillThere?.classificationState).toBe("PENDING")

      const deletedCat = await layer.getLabel(cat.id)
      expect(deletedCat?.deletedAt).not.toBeNull()
    })

    it("rejects stale fingerprint", async () => {
      const cat = await layer.createCategory({
        id: uuid(),
        name: "Stale",
        creationRequestId: uuid(),
      })

      await expect(
        layer.deleteCategoryCascade({
          categoryId: cat.id,
          expectedCategoryRevision: cat.revision,
          expectedImpactFingerprint: "deadbeef",
          requestId: `category-delete:${uuid()}`,
          warningAcknowledged: true,
        }),
      ).rejects.toThrow(DomainErrorCode.CATEGORY_DELETE_PREVIEW_STALE)
    })

    it("is no-op when same completed request is retried", async () => {
      const bookmarkId = uuid()
      await layer.saveBookmarkWithJob({
        id: bookmarkId,
        rawUrl: "https://example.com/z",
        title: "Z",
        creationRequestId: uuid(),
        jobId: uuid(),
      })
      const cat = await layer.createCategory({
        id: uuid(),
        name: "Once",
        creationRequestId: uuid(),
      })
      const tag = await layer.createTag({
        id: uuid(),
        name: "T",
        parentCategoryId: cat.id,
        expectedParentRevision: cat.revision,
        creationRequestId: uuid(),
      })
      const bm = (await layer.getBookmark(bookmarkId))!
      await layer.assignTagEdge({
        bookmarkId,
        tagId: tag.id,
        expectedBookmarkRevision: bm.revision,
      })

      const detail = await layer.getCategoryEditDetail(cat.id)
      const requestId = `category-delete:${uuid()}` as const
      const command = {
        categoryId: cat.id,
        expectedCategoryRevision: cat.revision,
        expectedImpactFingerprint: detail.impactFingerprint,
        requestId,
        warningAcknowledged: true as const,
      }

      await layer.deleteCategoryCascade(command)
      const retry = await layer.deleteCategoryCascade(command)
      expect(retry.alreadyCompleted).toBe(true)
    })
  })

  describe("M6: cursor list, search docs, migration", () => {
    it("lists bookmarks by savedAt desc with stable cursor tie-break", async () => {
      const t = 5000
      await layer.saveBookmarkWithJob({
        id: uuid(),
        rawUrl: "https://a.example/",
        title: "A",
        creationRequestId: uuid(),
        jobId: uuid(),
        now: t,
      })
      const idB = uuid()
      await layer.saveBookmarkWithJob({
        id: idB,
        rawUrl: "https://b.example/",
        title: "B",
        creationRequestId: uuid(),
        jobId: uuid(),
        now: t,
      })
      await layer.saveBookmarkWithJob({
        id: uuid(),
        rawUrl: "https://c.example/",
        title: "C",
        creationRequestId: uuid(),
        jobId: uuid(),
        now: t + 1,
      })

      const page1 = await layer.listRecentBookmarks(null, 2)
      expect(page1.items).toHaveLength(2)
      expect(page1.nextCursor).not.toBeNull()

      const page2 = await layer.listRecentBookmarks(page1.nextCursor, 2)
      expect(page2.items.length).toBeGreaterThanOrEqual(1)
    })

    it("creates search documents for bookmark save", async () => {
      const id = uuid()
      await layer.saveBookmarkWithJob({
        id,
        rawUrl: "https://search.example/",
        title: "SearchMe",
        creationRequestId: uuid(),
        jobId: uuid(),
      })
      const docs = await layer.rawDb.getAll(STORES.searchDocuments)
      expect(docs.some((d) => d.entityId === id && d.entityType === "BOOKMARK")).toBe(true)
    })

    it("recovers migration from FAILED to IDLE", async () => {
      await layer.setMigrationFailed()
      let meta = await layer.getSchemaMeta()
      expect(meta.migrationState).toBe("FAILED")

      await layer.recoverMigrationFromFailed()
      meta = await layer.getSchemaMeta()
      expect(meta.migrationState).toBe("IDLE")
    })
  })

  describe("tombstone name reuse after physical GC", () => {
    it("allows same name after physical GC", async () => {
      const catId = uuid()
      const cat = await layer.createCategory({
        id: catId,
        name: "ReuseMe",
        creationRequestId: uuid(),
      })

      const tx = layer.rawDb.transaction(STORES.labels, "readwrite")
      await tx.store.put({
        ...cat,
        deletedAt: Date.now(),
        revision: cat.revision + 1,
        updatedAt: Date.now(),
      })
      await tx.done

      await layer.physicalGcLabel(catId)

      const recreated = await layer.createCategory({
        id: uuid(),
        name: "ReuseMe",
        creationRequestId: uuid(),
      })
      expect(recreated.normalizedName).toBe("reuseme")
    })
  })
})
