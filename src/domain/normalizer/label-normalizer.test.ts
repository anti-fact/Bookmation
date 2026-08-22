/**
 * LabelNormalizer v1 単体テスト
 *
 * DB-SCHEMA.md §Label名正規化v1 仕様の固定 fixture 8 件と追加ケースを検証する。
 */
import { describe, it, expect } from "vitest"
import { normalizeLabelName } from "~/domain/normalizer/label-normalizer"
import { DomainErrorCode } from "~/domain/errors"

describe("LabelNormalizer v1", () => {
  describe("fixed fixtures (DB-SCHEMA.md 仕様)", () => {
    it("全角文字・IDEOGRAPHIC SPACE を正規化する", () => {
      // '  Ｐｙｔｈｏｎ　入門 ' → 'python 入門'
      const result = normalizeLabelName("  \uFF30\uFF59\uFF54\uFF48\uFF4F\uFF4E\u3000\u5165\u9580 ")
      expect(result.normalized).toBe("python 入門")
      expect(result.normalizationVersion).toBe(1)
    })

    it("TAB・LF を空白に変換して collapse する", () => {
      // 'A\t\nB' → 'a b'
      const result = normalizeLabelName("A\t\nB")
      expect(result.normalized).toBe("a b")
    })

    it("ß を ss に展開する (Full case fold, status F)", () => {
      // 'Straße' → 'strasse'
      const result = normalizeLabelName("Stra\u00DFe")
      expect(result.normalized).toBe("strasse")
    })

    it("ZERO WIDTH SPACE (U+200B) を拒否する", () => {
      expect(() => normalizeLabelName("ab\u200Bcd")).toThrow(DomainErrorCode.LABEL_NAME_REJECTED_CHARACTER)
    })

    it("RTL OVERRIDE (U+202E) を拒否する", () => {
      expect(() => normalizeLabelName("ab\u202Ecd")).toThrow(DomainErrorCode.LABEL_NAME_REJECTED_CHARACTER)
    })

    it("NULL (U+0000, Cc) を拒否する", () => {
      expect(() => normalizeLabelName("a\u0000b")).toThrow(DomainErrorCode.LABEL_NAME_REJECTED_CHARACTER)
    })

    it("ZERO WIDTH JOINER (U+200D) を拒否する", () => {
      expect(() => normalizeLabelName("a\u200Db")).toThrow(DomainErrorCode.LABEL_NAME_REJECTED_CHARACTER)
    })

    it("VARIATION SELECTOR-16 (U+FE0F) を拒否する", () => {
      expect(() => normalizeLabelName("text\uFE0F")).toThrow(DomainErrorCode.LABEL_NAME_REJECTED_CHARACTER)
    })
  })

  describe("基本ケース", () => {
    it("ASCII 小文字はそのまま", () => {
      expect(normalizeLabelName("hello world").normalized).toBe("hello world")
    })

    it("ASCII 大文字は小文字に", () => {
      expect(normalizeLabelName("Hello World").normalized).toBe("hello world")
    })

    it("先頭末尾の ASCII 空白を trim する", () => {
      expect(normalizeLabelName("  hello  ").normalized).toBe("hello")
    })

    it("複数の空白を 1 つに collapse する", () => {
      expect(normalizeLabelName("a   b   c").normalized).toBe("a b c")
    })

    it("CJK 文字はそのまま保持する", () => {
      expect(normalizeLabelName("東京タワー").normalized).toBe("東京タワー")
    })
  })

  describe("エラーケース", () => {
    it("空文字列を拒否する (LABEL_NAME_EMPTY)", () => {
      expect(() => normalizeLabelName("")).toThrow(DomainErrorCode.LABEL_NAME_EMPTY)
    })

    it("空白のみを拒否する (LABEL_NAME_EMPTY)", () => {
      expect(() => normalizeLabelName("   ")).toThrow(DomainErrorCode.LABEL_NAME_EMPTY)
    })

    it("SOFT HYPHEN (U+00AD, Default_Ignorable) を拒否する", () => {
      // U+00AD は Default_Ignorable_Code_Point (NFKC 後も残る)
      // NFKC でも変換されないため post-NFKC 検証で拒否
      expect(() => normalizeLabelName("a\u00ADb")).toThrow(DomainErrorCode.LABEL_NAME_REJECTED_CHARACTER)
    })

    it("BOM (U+FEFF) を拒否する", () => {
      expect(() => normalizeLabelName("\uFEFFhello")).toThrow(DomainErrorCode.LABEL_NAME_REJECTED_CHARACTER)
    })
  })

  describe("正規化バージョン", () => {
    it("normalizationVersion は 1 を返す", () => {
      const result = normalizeLabelName("test")
      expect(result.normalizationVersion).toBe(1)
    })
  })
})
