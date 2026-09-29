// 拡張機能内で共有する型定義

export interface CharacterRule {
  character: string;
  keywords: string[];
}

export interface Settings {
  /** フォームの「Twitter名」に転記する登録用ニックネーム */
  twitterName: string;
  discordId: string;
  /** 収集対象の自分のXアカウント（@なしのユーザー名） */
  xHandle: string;
  /** 申請フォームのURL。ソースコードには含めず、運営から個別に案内された値をユーザー自身が設定する */
  formUrl: string;
  /** カンマ区切りの対象キーワード（いずれかを本文・リンクに含む投稿を対象にする。空なら全件） */
  searchKeywords: string;
  /** カンマ区切りの除外キーワード（1つでも含む投稿は対象外） */
  excludeKeywords: string;
  /** 「作品らしさ」の手がかり（画像・小説語・小説リンク・長文）が1つもない投稿を対象外にするか */
  requireWorkSignal: boolean;
  /** カンマ区切りの「小説を示す語」 */
  novelKeywords: string;
  /** カンマ区切りの小説投稿サイトのドメイン（リンク先・カード表示と部分一致） */
  novelDomains: string;
  /** 本文がこの文字数以上なら長文（小説）の手がかりとみなす。0で無効 */
  minTextLength: number;
  characterRules: CharacterRule[];
  /** どのルールにもマッチしなかった場合のキャラクター欄の初期値（空なら手入力必須） */
  defaultCharacter: string;
}

/** Xの検索結果ページから収集した1投稿分のデータ */
export interface CollectedTweet {
  tweetId: string;
  /** https://x.com/{handle}/status/{id} */
  url: string;
  /** ISO 8601 (UTC) */
  datetime: string;
  text: string;
  /** 1枚目の画像/動画サムネイルURL（なければ空） */
  thumbnail: string;
  hasMedia: boolean;
  /** 本文中リンクの展開後URL表示・リンクカードのドメイン表示など（小説サイト判定用） */
  links: string[];
  /** 「さらに表示」が付く長文ポスト（X Premium）か */
  isLongPost: boolean;
}

export interface CollectTweetsResult {
  success: boolean;
  tweets?: CollectedTweet[];
  error?: string;
}

/** フォームへ1件分転記する投稿データ */
export interface QueueItem {
  tweetId: string;
  twitterName: string;
  discordId: string;
  tweetLink: string;
  /** YYYY-MM-DD */
  postDate: string;
  character: string;
}

export interface SubmittedRecord {
  submittedAt: string;
  formData: QueueItem;
}

export type SubmittedTweets = Record<string, SubmittedRecord>;

export interface FillAndSubmitResult {
  success: boolean;
  error?: string;
}
