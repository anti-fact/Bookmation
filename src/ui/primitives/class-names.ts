// 条件付きの Tailwind クラスを、空の値を除いて安全に連結する小さな補助関数です。
export function joinClassNames(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(" ")
}
