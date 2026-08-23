/**
 * 初回オンボーディングの「あなたにあったカテゴリを選ぶ」で提示する候補です。
 * 表示するだけでは Label を作らず、利用者が保存したものだけを作成対象にします。
 *
 * ISSUE-022 のうち候補名と set 構成は 2026-08-23 の利用者提示で確定しました。
 * 初期選択・skip・名前編集・再表示位置は未決のため、ここへ足してはいけません。
 * BE-19 の `~/catalogs/category-templates` は Category だけを持つ別 catalog です。
 *
 * Category 名と Tag 名はそれぞれの namespace 内で正規化後に global unique である
 * 必要があるため（[domain/label.ts](../domain/label.ts) の不変条件）、提示された
 * 一覧で重複した名前だけを所属が分かる形へ改名しています。
 */

/**
 * カテゴリに添える図形の意味だけをここで決め、実際の描画は
 * [category-preset-icons.tsx](../ui/features/onboarding/category-preset-icons.tsx) が持ちます。
 * 同じ set の中では重複させず、横に並んだときに見分けられるようにします。
 */
export type CategoryPresetIcon =
  | "archive"
  | "avatar"
  | "backpack"
  | "badge"
  | "bell"
  | "bolt"
  | "bookmark"
  | "calendar"
  | "card"
  | "chart"
  | "chat"
  | "code"
  | "container"
  | "dashboard"
  | "document"
  | "envelope"
  | "food"
  | "gear"
  | "globe"
  | "heart"
  | "layers"
  | "lock"
  | "magic"
  | "mixer"
  | "music"
  | "note"
  | "palette"
  | "pencil"
  | "person"
  | "play"
  | "quote"
  | "reader"
  | "repository"
  | "rocket"
  | "ruler"
  | "search"
  | "star"
  | "video"
  | "warning"

export type CategoryPreset = Readonly<{
  id: string
  name: string
  icon: CategoryPresetIcon
  tags: readonly string[]
}>

export type CategoryPresetSet = Readonly<{
  id: string
  /** 一覧の区切り見出しに出す日本語名。 */
  name: string
  /** 見出しに併記する英語名。 */
  englishName: string
  categories: readonly CategoryPreset[]
}>

export type CategoryPresetCatalog = Readonly<{
  version: string
  locale: "ja"
  sets: readonly CategoryPresetSet[]
}>

export const CATEGORY_PRESET_CATALOG: CategoryPresetCatalog = {
  version: "2026-08-23",
  locale: "ja",
  sets: [
    {
      id: "study",
      name: "学習・研究",
      englishName: "Study & Research",
      categories: [
        {
          id: "study.lecture",
          name: "授業・講義",
          icon: "backpack",
          tags: ["授業ページ", "資料", "課題", "LMS・大学サービス"]
        },
        {
          id: "study.learning",
          name: "学習",
          icon: "pencil",
          tags: ["チュートリアル", "解説記事", "教材", "問題集", "あとで学ぶ"]
        },
        {
          id: "study.documentation",
          name: "ドキュメント",
          icon: "document",
          tags: ["公式ドキュメント", "リファレンス", "マニュアル"]
        },
        {
          id: "study.research",
          name: "論文・研究",
          icon: "quote",
          tags: [
            "論文",
            "データセット",
            "研究機関",
            "学術データベース",
            "引用・参考文献"
          ]
        },
        {
          id: "study.search",
          name: "検索・辞書",
          icon: "search",
          tags: ["検索エンジン", "辞書", "翻訳", "用語集"]
        },
        {
          id: "study.tools",
          name: "学習ツール",
          icon: "ruler",
          tags: ["ノート", "暗記", "計算", "作図", "AI"]
        },
        {
          id: "study.certification",
          name: "資格・試験",
          icon: "badge",
          tags: ["公式情報", "試験教材", "過去問", "模擬試験"]
        },
        {
          id: "study.read-later",
          name: "あとで読む",
          icon: "bookmark",
          tags: ["優先", "通常"]
        },
        {
          id: "study.archive",
          name: "アーカイブ",
          icon: "archive",
          tags: ["終了した授業", "過去の資料"]
        }
      ]
    },
    {
      id: "development",
      name: "開発・IT",
      englishName: "Development",
      categories: [
        {
          id: "development.official-docs",
          name: "公式ドキュメント",
          icon: "reader",
          tags: [
            "言語",
            "フレームワーク",
            "ライブラリ",
            "API",
            "OS",
            "データベース"
          ]
        },
        {
          id: "development.tools",
          name: "開発ツール",
          icon: "gear",
          tags: [
            "IDE・エディタ",
            "Git",
            "CI・CD",
            "テスト",
            "デバッグ",
            "パッケージ管理"
          ]
        },
        {
          id: "development.repository",
          name: "リポジトリ",
          icon: "repository",
          tags: ["GitHub", "GitLab", "自分のリポジトリ", "参考リポジトリ"]
        },
        {
          id: "development.web",
          name: "Web開発",
          icon: "globe",
          tags: ["フロントエンド", "バックエンド", "CSS・UI", "Web API"]
        },
        {
          id: "development.infrastructure",
          name: "インフラ",
          icon: "container",
          tags: [
            "Linux",
            "Docker・コンテナ",
            "仮想化",
            "クラウド",
            "サーバ",
            "ネットワーク"
          ]
        },
        {
          id: "development.ai-data",
          name: "AI・データ",
          icon: "magic",
          tags: [
            "AIサービス",
            "LLM",
            "機械学習",
            "データ分析",
            "学習用データセット",
            "モデル"
          ]
        },
        {
          id: "development.security",
          name: "セキュリティ",
          icon: "lock",
          tags: [
            "セキュリティ情報",
            "脆弱性情報",
            "認証",
            "ネットワークセキュリティ"
          ]
        },
        {
          id: "development.reference",
          name: "リファレンス",
          icon: "code",
          tags: [
            "コマンド",
            "チートシート",
            "設計パターン",
            "アルゴリズム",
            "サンプルコード"
          ]
        },
        {
          id: "development.articles",
          name: "技術記事",
          icon: "document",
          tags: ["あとで読む記事", "解決済み", "保存版"]
        },
        {
          id: "development.troubleshooting",
          name: "トラブルシューティング",
          icon: "warning",
          tags: ["OSの不具合", "ネットワークの不具合", "開発環境", "エラー解決"]
        },
        {
          id: "development.community",
          name: "コミュニティ",
          icon: "chat",
          tags: ["Stack Overflow", "Reddit", "Discord・Forum", "Q&A"]
        },
        {
          id: "development.project",
          name: "プロジェクト",
          icon: "layers",
          tags: ["進行中", "保留", "完了"]
        }
      ]
    },
    {
      id: "work",
      name: "仕事・ビジネス",
      englishName: "Work & Business",
      categories: [
        {
          id: "work.dashboard",
          name: "ダッシュボード",
          icon: "dashboard",
          tags: ["社内ポータル", "勤怠", "経費", "業務システム"]
        },
        {
          id: "work.project",
          name: "案件",
          icon: "layers",
          tags: ["進行中の案件", "保留中の案件", "完了した案件"]
        },
        {
          id: "work.communication",
          name: "コミュニケーション",
          icon: "chat",
          tags: ["メール", "チャット", "Web会議", "社内SNS"]
        },
        {
          id: "work.documents",
          name: "業務ドキュメント",
          icon: "document",
          tags: [
            "ドキュメント",
            "スプレッドシート",
            "プレゼンテーション",
            "ファイル共有"
          ]
        },
        {
          id: "work.tasks",
          name: "タスク・予定",
          icon: "calendar",
          tags: ["タスク管理", "カレンダー", "スケジュール"]
        },
        {
          id: "work.internal-tools",
          name: "社内ツール",
          icon: "mixer",
          tags: [
            "管理ツール",
            "社内開発ツール",
            "分析ツール",
            "その他の社内ツール"
          ]
        },
        {
          id: "work.clients",
          name: "顧客・取引先",
          icon: "person",
          tags: ["顧客", "パートナー", "ベンダー"]
        },
        {
          id: "work.research",
          name: "調査",
          icon: "chart",
          tags: ["市場調査", "競合", "業界情報", "統計"]
        },
        {
          id: "work.reference",
          name: "参考資料",
          icon: "reader",
          tags: ["業務マニュアル", "ガイドライン", "テンプレート", "ナレッジ"]
        },
        {
          id: "work.review-later",
          name: "あとで確認",
          icon: "bookmark",
          tags: ["優先の確認", "通常の確認"]
        },
        {
          id: "work.archive",
          name: "業務アーカイブ",
          icon: "archive",
          tags: ["完了案件", "過去資料"]
        }
      ]
    },
    {
      id: "information",
      name: "情報収集",
      englishName: "Information & Reading",
      categories: [
        {
          id: "information.inbox",
          name: "受信箱",
          icon: "envelope",
          tags: ["未整理", "一時保存"]
        },
        {
          id: "information.read-later",
          name: "あとで読む記事",
          icon: "bookmark",
          tags: ["優先で読む", "通常で読む", "長文"]
        },
        {
          id: "information.news",
          name: "ニュース",
          icon: "reader",
          tags: [
            "国内",
            "海外",
            "IT・テクノロジー",
            "経済",
            "科学",
            "その他のニュース"
          ]
        },
        {
          id: "information.blog",
          name: "ブログ",
          icon: "note",
          tags: ["個人ブログ", "技術ブログ", "企業ブログ"]
        },
        {
          id: "information.media",
          name: "専門メディア",
          icon: "document",
          tags: [
            "ITメディア",
            "ビジネスメディア",
            "科学メディア",
            "その他のメディア"
          ]
        },
        {
          id: "information.community",
          name: "情報コミュニティ",
          icon: "chat",
          tags: ["Redditの話題", "掲示板", "SNS", "フォーラム"]
        },
        {
          id: "information.video-podcast",
          name: "動画・ポッドキャスト",
          icon: "video",
          tags: ["動画", "ポッドキャスト", "配信"]
        },
        {
          id: "information.reference",
          name: "情報リファレンス",
          icon: "chart",
          tags: ["情報の保存版", "データ", "統計データ", "解説"]
        },
        {
          id: "information.inspiration",
          name: "アイデア・インスピレーション",
          icon: "bolt",
          tags: [
            "デザインのアイデア",
            "技術のアイデア",
            "プロジェクトのアイデア",
            "その他のアイデア"
          ]
        },
        {
          id: "information.subscription",
          name: "定期購読",
          icon: "bell",
          tags: ["毎日", "毎週", "不定期"]
        },
        {
          id: "information.archive",
          name: "情報アーカイブ",
          icon: "archive",
          tags: ["読了", "古い情報"]
        }
      ]
    },
    {
      id: "hobby",
      name: "趣味・エンタメ",
      englishName: "Hobby & Entertainment",
      categories: [
        {
          id: "hobby.video",
          name: "動画",
          icon: "video",
          tags: ["YouTube", "配信サービス", "あとで見る動画", "お気に入りの動画"]
        },
        {
          id: "hobby.music",
          name: "音楽",
          icon: "music",
          tags: ["ストリーミング", "アーティスト", "プレイリスト", "ライブ"]
        },
        {
          id: "hobby.game",
          name: "ゲーム",
          icon: "rocket",
          tags: [
            "ストア",
            "攻略",
            "Wiki",
            "MOD",
            "ゲームコミュニティ",
            "セール・情報"
          ]
        },
        {
          id: "hobby.books",
          name: "本・漫画",
          icon: "reader",
          tags: ["電子書籍", "書店", "読みたい", "本のレビュー"]
        },
        {
          id: "hobby.movies",
          name: "映画・アニメ",
          icon: "play",
          tags: ["映像配信", "作品情報", "見たい作品", "作品のレビュー"]
        },
        {
          id: "hobby.creative",
          name: "クリエイティブ",
          icon: "palette",
          tags: ["イラスト", "写真", "音楽制作", "動画制作", "デザイン"]
        },
        {
          id: "hobby.community",
          name: "趣味コミュニティ",
          icon: "chat",
          tags: ["趣味のSNS", "Discord", "Forum", "ファンサイト"]
        },
        {
          id: "hobby.event",
          name: "イベント",
          icon: "calendar",
          tags: ["イベント情報", "チケット", "会場", "過去イベント"]
        },
        {
          id: "hobby.favorites",
          name: "お気に入り",
          icon: "star",
          tags: ["作品", "人物", "サイト"]
        },
        {
          id: "hobby.watch-later",
          name: "あとで見る",
          icon: "bookmark",
          tags: ["未分類"]
        }
      ]
    },
    {
      id: "life",
      name: "買い物・生活",
      englishName: "Shopping & Life",
      categories: [
        {
          id: "life.shopping",
          name: "ショッピング",
          icon: "backpack",
          tags: [
            "総合通販",
            "PC・家電",
            "ファッション",
            "家具・生活用品",
            "食品",
            "その他の買い物"
          ]
        },
        {
          id: "life.wishlist",
          name: "欲しいもの",
          icon: "star",
          tags: ["優先で買う", "比較中", "いつか買う"]
        },
        {
          id: "life.price-comparison",
          name: "価格比較",
          icon: "chart",
          tags: ["価格比較サイト", "セール", "クーポン"]
        },
        {
          id: "life.finance",
          name: "金融",
          icon: "card",
          tags: ["銀行", "クレジットカード", "電子決済", "家計管理"]
        },
        {
          id: "life.public-services",
          name: "公共サービス",
          icon: "document",
          tags: ["行政", "税金", "年金", "公共料金"]
        },
        {
          id: "life.utilities",
          name: "契約・インフラ",
          icon: "bolt",
          tags: ["電気", "ガス", "水道", "インターネット", "携帯電話"]
        },
        {
          id: "life.travel",
          name: "旅行",
          icon: "globe",
          tags: ["交通", "ホテル", "観光", "地図", "旅行の予約"]
        },
        {
          id: "life.food",
          name: "食事",
          icon: "food",
          tags: ["レストラン", "レシピ", "デリバリー", "飲食店の予約"]
        },
        {
          id: "life.health",
          name: "健康・生活",
          icon: "heart",
          tags: ["病院検索", "運動", "生活情報"]
        },
        {
          id: "life.reservation",
          name: "各種予約",
          icon: "calendar",
          tags: ["店舗", "施設", "チケット予約", "その他の予約"]
        },
        {
          id: "life.account",
          name: "アカウント",
          icon: "avatar",
          tags: ["会員サービス", "ポイント", "サブスクリプション"]
        }
      ]
    }
  ]
}
