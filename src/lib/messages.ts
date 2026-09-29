// background <-> dashboard <-> content script 間で共有するメッセージ種別定数

export const MSG = {
  // dashboard -> background: 選択した投稿の一括送信を開始する
  START_SUBMIT_QUEUE: "START_SUBMIT_QUEUE",
  // background -> dashboard: キューの進捗（1件処理するたびに通知）
  SUBMIT_PROGRESS: "SUBMIT_PROGRESS",
  // background -> content(wj.qq.com): このフォームに入力して送信してほしい
  FILL_AND_SUBMIT: "FILL_AND_SUBMIT",
  // dashboard -> content(x.com): 表示中の検索結果をスクロールしながら投稿を収集してほしい
  COLLECT_TWEETS: "COLLECT_TWEETS",
} as const;

export type MsgType = (typeof MSG)[keyof typeof MSG];
