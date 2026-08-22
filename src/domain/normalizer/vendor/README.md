# vendor/

Unicode 15.1.0 データから `scripts/generate-unicode-data.mjs` で自動生成したファイル群。

## 生成ファイル

| ファイル | 内容 |
|---|---|
| `white-space.ts` | `White_Space` property コードポイント範囲 |
| `default-ignorable.ts` | `Default_Ignorable_Code_Point` property 範囲 |
| `general-category.ts` | `Cs` (Surrogate) / `Cc` (Control) コードポイント範囲 |
| `nfkc.ts` | NFKD 分解テーブル / Non-starter 集合 / 正準合成テーブル |
| `case-folding.ts` | CaseFolding.txt status C+F マッピング |
| `asset-sha256.ts` | 全ファイル連結の SHA-256 ハッシュ定数 |

## 更新方法

```bash
node scripts/generate-unicode-data.mjs
```

生成ファイルはリポジトリにコミットし、CI でスクリプトを再実行しない。
Unicode バージョンを変更する際はスクリプトの変数と normalizationVersion を合わせて更新する。

## ICU 依存について

NFKD 分解テーブルの生成のみ Node.js ICU を使用する。
生成された静的テーブルのみを runtime で使用し、Node.js / Chrome の ICU に runtime 依存しない。
