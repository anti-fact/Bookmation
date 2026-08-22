/**
 * ClassificationJob domain 単体テスト
 */
import { describe, it, expect } from "vitest"
import {
  assertClassificationPolicyValid,
  assertValidStateTransition,
  policyFromGranularity,
} from "~/domain/classification-job"
import { DomainErrorCode } from "~/domain/errors"

describe("assertClassificationPolicyValid", () => {
  describe("有効な 5 種の組み合わせ", () => {
    it("granularity=0 maxNewTags=0 は有効", () => {
      expect(() => assertClassificationPolicyValid(policyFromGranularity(0))).not.toThrow()
    })
    it("granularity=1 maxNewTags=1 は有効", () => {
      expect(() => assertClassificationPolicyValid(policyFromGranularity(1))).not.toThrow()
    })
    it("granularity=2 maxNewTags=2 は有効", () => {
      expect(() => assertClassificationPolicyValid(policyFromGranularity(2))).not.toThrow()
    })
    it("granularity=3 maxNewTags=4 は有効", () => {
      expect(() => assertClassificationPolicyValid(policyFromGranularity(3))).not.toThrow()
    })
    it("granularity=4 maxNewTags=6 は有効", () => {
      expect(() => assertClassificationPolicyValid(policyFromGranularity(4))).not.toThrow()
    })
  })

  describe("不正な組み合わせ", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bad = (g: number, m: number): any => ({ policyVersion: 1, granularity: g, maxNewTags: m })

    it("granularity=0 maxNewTags=1 は拒否", () => {
      expect(() => assertClassificationPolicyValid(bad(0, 1))).toThrow(DomainErrorCode.CLASSIFICATION_POLICY_INVALID)
    })
    it("granularity=1 maxNewTags=0 は拒否", () => {
      expect(() => assertClassificationPolicyValid(bad(1, 0))).toThrow(DomainErrorCode.CLASSIFICATION_POLICY_INVALID)
    })
    it("granularity=3 maxNewTags=3 は拒否", () => {
      expect(() => assertClassificationPolicyValid(bad(3, 3))).toThrow(DomainErrorCode.CLASSIFICATION_POLICY_INVALID)
    })
    it("granularity=4 maxNewTags=4 は拒否", () => {
      expect(() => assertClassificationPolicyValid(bad(4, 4))).toThrow(DomainErrorCode.CLASSIFICATION_POLICY_INVALID)
    })
    it("policyVersion=2 は拒否", () => {
      expect(() => assertClassificationPolicyValid(bad(0, 0) as never)).not.toThrow()
      expect(() => assertClassificationPolicyValid({ policyVersion: 2, granularity: 0, maxNewTags: 0 } as never)).toThrow(DomainErrorCode.CLASSIFICATION_POLICY_INVALID)
    })
  })
})

describe("policyFromGranularity", () => {
  it("granularity=0 → maxNewTags=0", () => {
    const p = policyFromGranularity(0)
    expect(p.granularity).toBe(0)
    expect(p.maxNewTags).toBe(0)
    expect(p.policyVersion).toBe(1)
  })

  it("granularity=3 → maxNewTags=4", () => {
    const p = policyFromGranularity(3)
    expect(p.granularity).toBe(3)
    expect(p.maxNewTags).toBe(4)
  })

  it("granularity=4 → maxNewTags=6", () => {
    const p = policyFromGranularity(4)
    expect(p.maxNewTags).toBe(6)
  })
})

describe("assertValidStateTransition", () => {
  it("PENDING → RUNNING は有効", () => {
    expect(() => assertValidStateTransition("PENDING", "RUNNING")).not.toThrow()
  })

  it("PENDING → CANCELED は有効", () => {
    expect(() => assertValidStateTransition("PENDING", "CANCELED")).not.toThrow()
  })

  it("RUNNING → SUCCEEDED は有効", () => {
    expect(() => assertValidStateTransition("RUNNING", "SUCCEEDED")).not.toThrow()
  })

  it("RUNNING → FAILED は有効", () => {
    expect(() => assertValidStateTransition("RUNNING", "FAILED")).not.toThrow()
  })

  it("FAILED → PENDING (retry) は有効", () => {
    expect(() => assertValidStateTransition("FAILED", "PENDING")).not.toThrow()
  })

  it("SUCCEEDED → PENDING は拒否 (terminal state)", () => {
    expect(() => assertValidStateTransition("SUCCEEDED", "PENDING")).toThrow(
      DomainErrorCode.BOOKMARK_CLASSIFICATION_STATE_INVALID_TRANSITION,
    )
  })

  it("CANCELED → RUNNING は拒否", () => {
    expect(() => assertValidStateTransition("CANCELED", "RUNNING")).toThrow(
      DomainErrorCode.BOOKMARK_CLASSIFICATION_STATE_INVALID_TRANSITION,
    )
  })
})
