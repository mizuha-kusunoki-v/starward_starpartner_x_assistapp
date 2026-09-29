// X（Twitter）の検索URL組み立て

/** "@foo" や "https://x.com/foo" 形式でも受け付けて、ユーザー名部分だけを返す */
export function normalizeHandle(input: string): string {
  const trimmed = input.trim();
  const fromUrl = /(?:twitter\.com|x\.com)\/([A-Za-z0-9_]+)/.exec(trimmed);
  return (fromUrl ? fromUrl[1]! : trimmed).replace(/^@/, "");
}

function utcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * 対象年月(year, month: 1-12)の自分の投稿を検索するURLを返す。
 *
 * Xの since:/until: はUTC日付で解釈されるため、JSTの月初(前月末15:00 UTC)を
 * 取りこぼさないよう前後1日ずつ広めに検索し、JST暦日での厳密な絞り込みは
 * 収集後にダッシュボード側で行う。
 * キーワードは検索クエリに含めず本文で絞り込む（ハッシュタグ・表記ゆれで
 * 検索側のマッチ判定が読めないため。YouTube版でタイトルのみ厳密判定したのと同じ考え方）。
 */
export function buildMonthlySearchUrl(handle: string, year: number, month: number): string {
  const since = new Date(Date.UTC(year, month - 1, 1) - 24 * 3600 * 1000);
  const until = new Date(Date.UTC(year, month, 1) + 24 * 3600 * 1000);
  const query = `from:${handle} since:${utcDateString(since)} until:${utcDateString(until)} -filter:replies`;
  const url = new URL("https://x.com/search");
  url.searchParams.set("q", query);
  url.searchParams.set("src", "typed_query");
  url.searchParams.set("f", "live");
  return url.toString();
}
