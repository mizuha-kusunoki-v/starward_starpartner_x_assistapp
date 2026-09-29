import { MSG } from "../lib/messages";
import { getSettings, markTweetSubmitted } from "../lib/storage";
import { delay, waitForTabComplete } from "../lib/tabs";
import type { FillAndSubmitResult, QueueItem } from "../lib/types";

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard/dashboard.html") });
});

async function processQueue(queue: QueueItem[]): Promise<void> {
  const total = queue.length;

  const settings = await getSettings();
  if (!settings.formUrl) {
    chrome.runtime.sendMessage({
      type: MSG.SUBMIT_PROGRESS,
      status: "failed",
      index: 0,
      total,
      error: "申請フォームURLが設定されていません。オプション画面で設定してください。",
    });
    chrome.runtime.sendMessage({ type: MSG.SUBMIT_PROGRESS, status: "done", total });
    return;
  }

  for (let i = 0; i < total; i++) {
    const item = queue[i]!;
    try {
      const tab = await chrome.tabs.create({ url: settings.formUrl, active: true });
      await waitForTabComplete(tab.id!);
      // SPAの初期描画を待つ（formFiller.js側でも要素待機のリトライを行う）
      await delay(1500);

      const response = (await chrome.tabs.sendMessage(tab.id!, {
        type: MSG.FILL_AND_SUBMIT,
        data: item,
      })) as FillAndSubmitResult | undefined;

      if (response?.success) {
        await markTweetSubmitted(item.tweetId, item);
        chrome.runtime.sendMessage({
          type: MSG.SUBMIT_PROGRESS,
          tweetId: item.tweetId,
          status: "success",
          index: i + 1,
          total,
        });
        // 送信完了の見た目が出た直後にタブを閉じると、実際の送信リクエストが
        // まだ完了していない場合に通信ごと打ち切ってしまう恐れがある。
        // 人が手動操作するときに完了を確認してから閉じる程度の間を空けてから閉じる。
        await delay(5000);
        await chrome.tabs.remove(tab.id!);
      } else {
        chrome.runtime.sendMessage({
          type: MSG.SUBMIT_PROGRESS,
          tweetId: item.tweetId,
          status: "failed",
          index: i + 1,
          total,
          error: response?.error || "フォームへの入力/送信に失敗しました",
        });
        // 安全のため無人で連投せず、ここでキューを停止する（タブは手動対応のため開いたまま）
        break;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      chrome.runtime.sendMessage({
        type: MSG.SUBMIT_PROGRESS,
        tweetId: item.tweetId,
        status: "failed",
        index: i + 1,
        total,
        error: message,
      });
      break;
    }
  }

  chrome.runtime.sendMessage({ type: MSG.SUBMIT_PROGRESS, status: "done", total });
}

chrome.runtime.onMessage.addListener((message: { type: string; queue?: QueueItem[] }) => {
  if (message.type === MSG.START_SUBMIT_QUEUE && message.queue) {
    processQueue(message.queue);
  }
});
