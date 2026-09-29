// chrome.storage ラッパー: 固定設定(sync)と送信履歴(local)を扱う

import type { QueueItem, Settings, SubmittedTweets } from "./types";

const SETTINGS_KEY = "settings";
const SUBMITTED_KEY = "submittedTweets";

export const DEFAULT_SETTINGS: Settings = {
  twitterName: "",
  discordId: "",
  xHandle: "",
  // 申請フォームのURL。ソースコードには含めない(運営からの要望)。
  // 利用者自身が運営から案内されたURLをここに設定する。
  formUrl: "",
  // カンマ区切りの検索キーワード。運営指定タグ等をデフォルトで提案。
  searchKeywords: "星の翼",
  excludeKeywords: "",
  requireWorkSignal: true,
  // 「続き」「本文」などは普段のポストにも頻出して誤検知が多いため入れていない
  novelKeywords: "小説,SS,夢小説,ノベル,短編,掌編,前編,後編",
  // 主な小説投稿・長文テキスト共有サービス。
  // リンクカードはドメインしか表示されないため "pixiv.net/novel" ではなくドメイン単位で指定する
  // （pixivはイラスト投稿の可能性もあるが、どちらにせよ作品なので対象でよい）
  novelDomains:
    "pixiv.net,privatter.net,fusetter.com,poipiku.com,syosetu.org,syosetu.com,kakuyomu.jp,note.com,pictbland.net,estar.jp,archiveofourown.org,tanpen.net,writening.net,telegra.ph",
  minTextLength: 140,
  // キャラクター名 -> 本文にマッチさせるキーワード配列。上から順に判定する。
  // キャラクター一覧は利用者ごとに異なるため、初期状態は空にしておく。
  characterRules: [],
  defaultCharacter: "",
};

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...((stored[SETTINGS_KEY] as Partial<Settings>) || {}) };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
}

export async function getSubmittedTweets(): Promise<SubmittedTweets> {
  const stored = await chrome.storage.local.get(SUBMITTED_KEY);
  return (stored[SUBMITTED_KEY] as SubmittedTweets) || {};
}

export async function markTweetSubmitted(tweetId: string, formData: QueueItem): Promise<void> {
  const submitted = await getSubmittedTweets();
  submitted[tweetId] = { submittedAt: new Date().toISOString(), formData };
  await chrome.storage.local.set({ [SUBMITTED_KEY]: submitted });
}
