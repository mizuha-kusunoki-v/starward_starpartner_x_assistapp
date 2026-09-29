// タブ操作の共通ヘルパー（background / dashboard の両方から使う）

/** タブの読み込み完了(status: complete)を待つ。既に完了済みなら即座に解決する */
export function waitForTabComplete(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    function listener(updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
    // リスナー登録前に完了していた場合の取りこぼし対策
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    });
  });
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
