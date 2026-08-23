/**
 * ClassificationJob Domain テスト（policy v2 正本）
 */
import { describe, expect, it } from "vitest"
import {
  assertClassificationPolicyValid,
  DomainErrorCode,
  isPolicyV2,
  policyFromGranularity,
  policyV1FromGranularity,
} from "~/domain"

describe("assertClassificationPolicyValid", () => {
  describe("policy v2", () => {
    for (const g of [0, 1, 2, 3, 4] as const) {
      it(`granularity=${g} v2 snapshot is valid`, () => {
        expect(() =>
          assertClassificationPolicyValid(policyFromGranularity(g)),
        ).not.toThrow()
        expect(isPolicyV2(policyFromGranularity(g))).toBe(true)
      })
    }

    it("rejects mismatched reusePolicy", () => {
      expect(() =>
        assertClassificationPolicyValid({
          policyVersion: 2,
          granularity: 2,
          reusePolicy: "STRONG_REUSE",
          allowedCreateImportance: ["CORE", "MAJOR"],
        } as never),
      ).toThrow(DomainErrorCode.CLASSIFICATION_POLICY_INVALID)
    })
  })

  describe("policy v1 legacy", () => {
    it("accepts historical maxNewTags combos", () => {
      expect(() =>
        assertClassificationPolicyValid(policyV1FromGranularity(3)),
      ).not.toThrow()
    })

    it("rejects invalid v1 combo", () => {
      expect(() =>
        assertClassificationPolicyValid({
          policyVersion: 1,
          granularity: 0,
          maxNewTags: 1,
        } as never),
      ).toThrow(DomainErrorCode.CLASSIFICATION_POLICY_INVALID)
    })
  })
})

describe("policyFromGranularity", () => {
  it("returns v2 without maxNewTags", () => {
    const p = policyFromGranularity(2)
    expect(p.policyVersion).toBe(2)
    expect(p.reusePolicy).toBe("BALANCED")
    expect(p.allowedCreateImportance).toEqual(["CORE", "MAJOR"])
    expect("maxNewTags" in p).toBe(false)
  })

  it("granularity 0 and 1 both allow CORE only", () => {
    expect(policyFromGranularity(0).allowedCreateImportance).toEqual(["CORE"])
    expect(policyFromGranularity(1).allowedCreateImportance).toEqual(["CORE"])
    expect(policyFromGranularity(0).reusePolicy).toBe("STRONG_REUSE")
    expect(policyFromGranularity(1).reusePolicy).toBe("PREFER_REUSE")
  })

  it("granularity 4 allows DETAIL", () => {
    expect(policyFromGranularity(4).allowedCreateImportance).toEqual([
      "CORE",
      "MAJOR",
      "SUPPORTING",
      "DETAIL",
    ])
  })
})
