// x.com の検索結果ページから自分の投稿を収集するスクリプト。
// ダッシュボードが chrome.scripting.executeScript で必要なときだけ注入する
// （普段のX閲覧中には読み込まれない）。
//
// X公式APIは読み取りが有料のため、ユーザー自身がログイン済みのブラウザで
// 表示した検索結果のDOMを読み取る方式にしている。
// Xのタイムラインは仮想スクロールで、画面外に出た投稿はDOMから削除されるため、
// 少しずつスクロールしながらその都度読み取って蓄積する。
// セレクタは data-testid 属性を使う（class名は難読化されビルドごとに変わるため）。
// (2026-09時点の構造。X側の変更で動かなくなったらここを見直すこと)

import { MSG } from "../lib/messages";
import type { CollectedTweet, CollectTweetsResult } from "../lib/types";

declare global {
  interface Window {
    __starpartnerXCollectorLoaded?: boolean;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor<T>(
  conditionFn: () => T | null | undefined | false,
  { timeout = 15000, interval = 300 }: { timeout?: number; interval?: number } = {}
): Promise<T | null> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = conditionFn();
    if (result) return result;
    await delay(interval);
  }
  return null;
}

function isLoginPage(): boolean {
  return /^\/(i\/flow\/login|login)/.test(location.pathname);
}

/**
 * article要素1件から投稿データを取り出す。
 * 引用ポストの場合、article内に引用元の投稿も含まれるが、引用元の日時は
 * リンク(a)で囲まれていないため「a[href*=/status/] 内の最初のtime」が
 * その投稿自身のパーマリンクになる。
 */
function parseArticle(article: HTMLElement, handle: string): CollectedTweet | null {
  const time = article.querySelector<HTMLTimeElement>('a[href*="/status/"] time');
  const permalink = time?.closest<HTMLAnchorElement>("a");
  if (!time || !permalink) return null;

  const match = /^\/([A-Za-z0-9_]+)\/status\/(\d+)/.exec(new URL(permalink.href).pathname);
  if (!match) return null;
  const [, author, tweetId] = match as unknown as [string, string, string];
  // リポストや他人の投稿は対象外（from:検索でも混ざることがあるため念のため除外）
  if (author.toLowerCase() !== handle.toLowerCase()) return null;

  const textEl = article.querySelector<HTMLElement>('[data-testid="tweetText"]');
  const text = textEl?.innerText ?? "";
  const photo = article.querySelector<HTMLImageElement>('[data-testid="tweetPhoto"] img');
  const video = article.querySelector<HTMLVideoElement>("video");
  const thumbnail = photo?.src || video?.poster || "";

  return {
    tweetId,
    url: `https://x.com/${author}/status/${tweetId}`,
    datetime: time.dateTime,
    text,
    thumbnail,
    hasMedia: Boolean(photo || video || article.querySelector('[data-testid="videoPlayer"]')),
    links: extractLinks(article, textEl),
    isLongPost: Boolean(article.querySelector('[data-testid="tweet-text-show-more-link"]')),
  };
}

/**
 * 小説サイト判定用に、リンク先を表す文字列を集める。
 * hrefはすべて t.co の短縮URLになっているため使えない。
 * - 本文中のリンク: 表示上は省略されているが、非表示のspanに残りの部分が入っているため
 *   textContent で展開後URLに近い文字列が得られる（title属性があればそちらを優先）
 * - リンクカード: ドメイン名（例: "pixiv.net"）がカード内に表示される
 */
function extractLinks(article: HTMLElement, textEl: HTMLElement | null): string[] {
  const links: string[] = [];
  for (const a of textEl?.querySelectorAll<HTMLAnchorElement>('a[href^="https://t.co/"]') ?? []) {
    links.push(a.title || a.textContent || "");
  }
  for (const card of article.querySelectorAll<HTMLElement>('[data-testid="card.wrapper"]')) {
    links.push(card.textContent || "");
  }
  return links.map((l) => l.trim()).filter(Boolean);
}

function collectVisible(handle: string, into: Map<string, CollectedTweet>): number {
  let added = 0;
  for (const article of document.querySelectorAll<HTMLElement>('article[data-testid="tweet"]')) {
    const tweet = parseArticle(article, handle);
    if (tweet && !into.has(tweet.tweetId)) {
      into.set(tweet.tweetId, tweet);
      added++;
    }
  }
  return added;
}

async function collectTweets(handle: string): Promise<CollectedTweet[]> {
  if (isLoginPage()) throw new Error("Xにログインしていません。x.comにログインしてから再度お試しください");

  // 検索結果（投稿 or 「結果なし」表示）が描画されるまで待つ
  const loaded = await waitFor(
    () =>
      isLoginPage() ||
      document.querySelector('article[data-testid="tweet"]') ||
      document.querySelector('[data-testid="emptyState"]')
  );
  if (isLoginPage()) throw new Error("Xにログインしていません。x.comにログインしてから再度お試しください");
  if (!loaded) throw new Error("Xの検索結果の読み込みがタイムアウトしました");
  if (!document.querySelector('article[data-testid="tweet"]')) return [];

  const tweets = new Map<string, CollectedTweet>();
  // 新しい投稿が連続で見つからなくなったら末尾に達したとみなす。
  // 読み込みが遅いと途中で打ち切られるため、猶予は長めにとる。
  let idleRounds = 0;
  for (let i = 0; i < 300 && idleRounds < 6; i++) {
    const added = collectVisible(handle, tweets);
    idleRounds = added ? 0 : idleRounds + 1;
    window.scrollBy(0, Math.round(window.innerHeight * 0.8));
    await delay(1200);
  }
  collectVisible(handle, tweets);

  return [...tweets.values()];
}

if (!window.__starpartnerXCollectorLoaded) {
  window.__starpartnerXCollectorLoaded = true;

  chrome.runtime.onMessage.addListener(
    (message: { type: string; handle?: string }, _sender, sendResponse) => {
      if (message.type !== MSG.COLLECT_TWEETS || !message.handle) return undefined;

      collectTweets(message.handle)
        .then((tweets): CollectTweetsResult => ({ success: true, tweets }))
        .catch((err: unknown): CollectTweetsResult => ({
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }))
        .then((result) => sendResponse(result));

      return true; // 非同期でsendResponseを呼ぶことを示す
    }
  );
}
