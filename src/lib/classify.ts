// 投稿の対象判定・キャラクター欄の自動推測ロジック（純粋関数）

import type { CharacterRule, CollectedTweet, Settings } from "./types";

/** カンマ区切り文字列を空要素なしの配列にする（全角カンマ・読点区切りも許容） */
export function parseList(value: string): string[] {
  return value
    .split(/[,，、]/)
    .map((k) => k.trim())
    .filter(Boolean);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * haystack に含まれる最初のキーワードを返す（大文字小文字は区別しない）。
 * 英数字だけのキーワード（例: "SS"）は単純な部分一致だと "class" や "boss" にも
 * ヒットしてしまうため、前後が英数字でない場合のみ一致とみなす。
 * 日本語やハッシュタグは部分一致（"#星の翼" は "#星の翼SS" にも一致する）。
 */
export function findKeyword(haystack: string, keywords: string[]): string | undefined {
  const lower = haystack.toLowerCase();
  return keywords.find((keyword) => {
    const k = keyword.toLowerCase();
    if (!k) return false;
    if (/^[a-z0-9]+$/.test(k)) {
      return new RegExp(`(?<![a-z0-9])${escapeRegExp(k)}(?![a-z0-9])`).test(lower);
    }
    return lower.includes(k);
  });
}

/**
 * 投稿本文とキャラクター推測ルールから「キャラクター」欄の値を推測する。
 * ルールは上から順に評価し、最初にマッチしたキャラクターを返す。
 * どれにもマッチしなければ fallback（設定の既定値。空なら手入力が必要）。
 */
export function inferCharacter(
  text: string | undefined,
  characterRules: CharacterRule[],
  fallback: string
): string {
  for (const rule of characterRules || []) {
    if (findKeyword(text || "", rule.keywords || [])) return rule.character;
  }
  return fallback;
}

export interface TweetEvaluation {
  included: boolean;
  /** 対象と判定した根拠（一覧に表示する） */
  reasons: string[];
  /** 対象外と判定した理由（対象の場合は undefined） */
  rejectReason?: string;
}

/**
 * 投稿が申請対象かを判定する。判定は次の順:
 *   1. 除外キーワードを含む → 対象外
 *   2. 対象キーワード（いずれか）を含まない → 対象外（未設定なら全件通過）
 *   3. 「作品らしさ」の手がかりが1つもない → 対象外（設定でOFFにできる）
 *      手がかり: 画像/動画・小説を示す語・小説投稿サイトへのリンク・長文
 *
 * 小説は画像なしで投稿されることが多いため、画像以外の手がかりでも拾えるようにしている。
 * キーワードやリンクはカードのドメイン表示も含めて照合する。
 */
export function evaluateTweet(tweet: CollectedTweet, settings: Settings): TweetEvaluation {
  const haystack = [tweet.text, ...tweet.links].join("\n");
  const reasons: string[] = [];

  const excluded = findKeyword(haystack, parseList(settings.excludeKeywords));
  if (excluded) return { included: false, reasons, rejectReason: `除外語「${excluded}」` };

  const keywords = parseList(settings.searchKeywords);
  if (keywords.length) {
    const hit = findKeyword(haystack, keywords);
    if (!hit) return { included: false, reasons, rejectReason: "対象キーワードなし" };
    reasons.push(`キーワード「${hit}」`);
  }

  if (tweet.hasMedia) reasons.push("画像/動画");
  // リンクカードのタイトル（例: pixivの「〇〇」/「作者」の小説）にも出ることがあるので haystack で見る
  const novelWord = findKeyword(haystack, parseList(settings.novelKeywords));
  if (novelWord) reasons.push(`小説語「${novelWord}」`);
  const novelLink = parseList(settings.novelDomains).find((domain) =>
    tweet.links.some((link) => link.toLowerCase().includes(domain.toLowerCase()))
  );
  if (novelLink) reasons.push(`小説リンク(${novelLink})`);
  if (tweet.isLongPost || (settings.minTextLength > 0 && [...tweet.text].length >= settings.minTextLength)) {
    reasons.push("長文");
  }

  const hasWorkSignal = reasons.some((r) => !r.startsWith("キーワード"));
  if (settings.requireWorkSignal && !hasWorkSignal) {
    return { included: false, reasons, rejectReason: "作品の手がかりなし（画像・小説語・小説リンク・長文のいずれもなし）" };
  }
  return { included: true, reasons };
}
