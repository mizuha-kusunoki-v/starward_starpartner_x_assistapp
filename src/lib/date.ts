// 日付は必ず日本標準時(JST, UTC+9)基準で扱う。
// Date.toISOString()はUTC基準になるため、JST深夜帯(00:00〜08:59)で
// 日付が1日ずれる不具合を避けるためIntl.DateTimeFormatでJSTに変換する。

const JST_TIME_ZONE = "Asia/Tokyo";

/** 指定日時(省略時は現在時刻)をJST基準の "YYYY-MM-DD" 文字列に変換する */
export function toJstDateString(input: Date | string = new Date()): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: JST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
