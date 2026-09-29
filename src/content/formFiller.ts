// wj.qq.com「スターパートナー」Twitter絵画投稿/同人小説 申請フォーム専用の
// 自動入力・送信スクリプト。
//
// フォームはTencent問巻(TDesignベースのVue/React SPA)で描画される。
// input要素のid/nameは再読み込みのたびにランダムに振り直されるため、
// 各質問は section.question 内の h2.question-title の「見出し文言」で
// 完全一致マッチさせる（section全体のinnerTextには説明文も含まれ、
// 他設問のラベルが部分文字列として紛れ込むことがあるため、部分一致は不可）。
// (2026-09時点でブラウザ上のDOMを直接調査して確認した構造。YouTube版フォームと
//  同じ部品構成。サイト側のリニューアルで変わる可能性があるため、
//  動かなくなったらここを見直すこと)

import { MSG } from "../lib/messages";
import type { FillAndSubmitResult, QueueItem } from "../lib/types";

function setNativeValue(el: HTMLInputElement, value: string): void {
  const proto = Object.getPrototypeOf(el) as HTMLInputElement;
  const desc = Object.getOwnPropertyDescriptor(proto, "value")!;
  desc.set!.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * 日付ピッカーの入力欄だけは `el.click()`（合成clickイベント1発）では
 * ポップアップが開かない（mousedownで開閉トリガーを拾っているため）ことを
 * 実機検証で確認済み。座標付きでmousedown/mouseup/clickを一式発火させる。
 * それ以外の要素（ボタン・ラジオ・日付セル）は通常の`.click()`で問題ない
 * （むしろこの3イベント発火だと日付セルでは選択が反映されないことがあった）。
 */
function simulateOpenPicker(el: HTMLElement): void {
  const rect = el.getBoundingClientRect();
  const opts: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  };
  el.dispatchEvent(new MouseEvent("mousedown", opts));
  el.dispatchEvent(new MouseEvent("mouseup", opts));
  el.dispatchEvent(new MouseEvent("click", opts));
}

/**
 * 1つ前の日付欄で開いたパネルのDOMノードが、閉じたあともそのまま
 * (表示上は閉じているが要素としては)残り続けることがある。そのため
 * 「表示中(offsetWidth>0)の最初のパネル」を探すと古い(閉じかけの)方を
 * 誤って掴んでしまうことがある。新しく開いた回だけに絞り込むため、
 * 呼び出し前に存在していたパネルの個数を渡し、それより後に増えた
 * ノードの中から表示中のものを返す。
 */
function findNewlyOpenedDatePickerPanel(panelCountBefore: number): HTMLElement | null {
  const panels = [...document.querySelectorAll<HTMLElement>(".t-date-picker__panel-date")];
  if (panels.length <= panelCountBefore) return null;
  const newest = panels[panels.length - 1];
  return newest && newest.offsetWidth > 0 ? newest : null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor<T>(
  conditionFn: () => T | null | undefined | false,
  { timeout = 8000, interval = 200 }: { timeout?: number; interval?: number } = {}
): Promise<T | null> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = conditionFn();
    if (result) return result;
    await delay(interval);
  }
  return null;
}

/** section.question の見出し(h2.question-title)から「NN / * / 必填」を除いたラベル文言を取り出す */
function getQuestionLabel(section: HTMLElement): string {
  const titleEl = section.querySelector<HTMLElement>(".question-title");
  const text = (titleEl ?? section).innerText;
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return lines[lines.length - 1] ?? "";
}

// フォームの設問ラベル（見出し文言そのまま）
const LABELS = {
  TWITTER_NAME: "Twitter名",
  DISCORD_ID: "Discordの個人ID",
  TWEET_LINK: "Twitterの投稿ツイート リンク",
  POST_DATE: "投稿日",
  CHARACTER: "キャラクター（例：「嘆きの魔竜」ライン）",
} as const;

/** ラベル文言の完全一致でsection.questionを探す（部分一致は他設問の説明文と誤マッチする） */
function findQuestion(exactLabel: string): HTMLElement | undefined {
  const sections = [...document.querySelectorAll<HTMLElement>("section.question")];
  return sections.find((s) => getQuestionLabel(s) === exactLabel);
}

function setTextField(exactLabel: string, value: string): void {
  const question = findQuestion(exactLabel);
  if (!question) throw new Error(`項目「${exactLabel}」が見つかりません`);
  const input = question.querySelector<HTMLInputElement>("input.inputs-input, textarea");
  if (!input) throw new Error(`項目「${exactLabel}」の入力欄が見つかりません`);
  setNativeValue(input, value);
}

/**
 * 日付欄はテキストとして直接値を書き込んでも見た目は反映されるが、
 * バリデーション上は「未入力」のまま扱われ提交できない（実機で確認済み）。
 * 実際のカレンダーUIを開いて年月を移動し、日を1つクリックして選択する
 * ことでしか正しく確定できないため、この手順を踏む。
 */
async function setDateField(exactLabel: string, isoDate: string): Promise<void> {
  const question = findQuestion(exactLabel);
  if (!question) throw new Error(`項目「${exactLabel}」が見つかりません`);
  const input = question.querySelector<HTMLInputElement>("input.t-input__inner");
  if (!input) throw new Error(`項目「${exactLabel}」の日付欄が見つかりません`);

  const [year, month, day] = isoDate.split("-").map(Number) as [number, number, number];

  const panelCountBefore = document.querySelectorAll(".t-date-picker__panel-date").length;
  simulateOpenPicker(input);
  const panel = await waitFor(() => findNewlyOpenedDatePickerPanel(panelCountBefore), {
    timeout: 3000,
    interval: 100,
  });
  if (!panel) throw new Error(`項目「${exactLabel}」のカレンダーが開きませんでした`);

  await navigateCalendarToMonth(panel, year, month, exactLabel);

  const dayCell = [...panel.querySelectorAll<HTMLElement>(".t-date-picker__cell")].find(
    (c) =>
      !c.classList.contains("t-date-picker__cell--additional") &&
      c.querySelector(".t-date-picker__cell-inner")?.textContent?.trim() === String(day)
  );
  if (!dayCell) throw new Error(`項目「${exactLabel}」のカレンダーに${day}日のセルが見つかりません`);
  const inner = dayCell.querySelector<HTMLElement>(".t-date-picker__cell-inner");
  if (!inner) throw new Error(`項目「${exactLabel}」の日付セルの内部要素が見つかりません`);
  inner.click();

  // 選択が確定すると、この入力欄のDOMノード自体が新しいものに差し替わる
  // (Vueが再描画で要素を作り直す)ことがあるため、最初に取得した`input`変数を
  // 使い回さず、都度section内から入力欄を再取得して値を確認する。
  // (差し替え後の新ノードを見ずに古い参照のままだと、実際は正しく設定できて
  //  いてもここが「空のまま」と誤判定してしまう)
  const committed = await waitFor(
    () => {
      const currentInput = findQuestion(exactLabel)?.querySelector<HTMLInputElement>(
        "input.t-input__inner"
      );
      return currentInput && currentInput.value === isoDate ? currentInput : null;
    },
    { timeout: 5000, interval: 150 }
  );
  if (!committed) {
    const currentInput = findQuestion(exactLabel)?.querySelector<HTMLInputElement>(
      "input.t-input__inner"
    );
    throw new Error(
      `項目「${exactLabel}」の日付が正しく設定されませんでした(期待値:${isoDate}, 実際:${
        currentInput?.value || "空"
      })`
    );
  }
}

function readCalendarHeaderMonthYear(panel: HTMLElement): { month: number; year: number } {
  const monthInput = panel.querySelector<HTMLInputElement>(
    ".t-date-picker__header-controller-month input"
  );
  const yearInput = panel.querySelector<HTMLInputElement>(
    ".t-date-picker__header-controller-year input"
  );
  return {
    month: parseInt(monthInput?.value ?? "", 10),
    year: parseInt(yearInput?.value ?? "", 10),
  };
}

async function navigateCalendarToMonth(
  panel: HTMLElement,
  targetYear: number,
  targetMonth: number,
  exactLabel: string
): Promise<void> {
  // パネル表示直後はヘッダの年月がまだ描画されていないことがあるため、
  // 有効な数値になるまで待ってから移動を開始する
  const headerReady = await waitFor(
    () => {
      const h = readCalendarHeaderMonthYear(panel);
      return Number.isFinite(h.month) && Number.isFinite(h.year) ? h : null;
    },
    { timeout: 2000, interval: 100 }
  );
  if (!headerReady) throw new Error(`項目「${exactLabel}」のカレンダーの年月表示が読み取れませんでした`);

  // 5年分を上限に「前月/翌月」ボタンを押し続けて目的の年月まで移動する
  for (let i = 0; i < 60; i++) {
    const current = readCalendarHeaderMonthYear(panel);
    const diff = targetYear * 12 + targetMonth - (current.year * 12 + current.month);
    if (diff === 0) return;
    const button = panel.querySelector<HTMLButtonElement>(
      diff > 0 ? ".t-pagination-mini__next" : ".t-pagination-mini__prev"
    );
    if (!button) throw new Error(`項目「${exactLabel}」のカレンダー月移動ボタンが見つかりません`);
    button.click();
    await delay(200);
  }
  throw new Error(`項目「${exactLabel}」のカレンダーを目的の年月まで移動できませんでした`);
}

function findSubmitButton(): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.innerText.trim() === "提交"
  );
}

/**
 * このフォームは前回の入力途中を検知すると「継続填写(継続)/重新填写(最初から)」の
 * 確認ダイアログを表示し、section.questionが一切描画されない状態になる。
 * 自動入力の前に必ず「重新填写」を選び、まっさらな状態から入力する。
 */
async function dismissResumeDialogIfPresent(): Promise<void> {
  const restartButton = await waitFor(
    () =>
      [...document.querySelectorAll<HTMLButtonElement>("button")].find(
        (b) => b.innerText.trim() === "重新填写"
      ),
    { timeout: 1500, interval: 150 }
  );
  if (!restartButton) return;
  restartButton.click();
  await delay(500);
}

async function fillForm(data: QueueItem): Promise<void> {
  await dismissResumeDialogIfPresent();

  const ready = await waitFor(() => document.querySelectorAll("section.question").length >= 5);
  if (!ready) throw new Error("フォームの読み込みがタイムアウトしました");

  setTextField(LABELS.TWITTER_NAME, data.twitterName);
  setTextField(LABELS.DISCORD_ID, data.discordId);
  setTextField(LABELS.TWEET_LINK, data.tweetLink);
  setTextField(LABELS.CHARACTER, data.character);
  await delay(150);

  await setDateField(LABELS.POST_DATE, data.postDate);
  await delay(150);
}

async function submitForm(): Promise<FillAndSubmitResult> {
  const submitBtn = findSubmitButton();
  if (!submitBtn) throw new Error("提交ボタンが見つかりません");

  submitBtn.click();

  // 送信後、質問セクションが消える(サンクス画面へ遷移)なら成功、
  // バリデーションエラーで質問セクションが残ったままなら失敗とみなす。
  const disappeared = await waitFor(
    () => document.querySelectorAll("section.question").length === 0,
    { timeout: 6000, interval: 300 }
  );
  if (disappeared) return { success: true };

  const errorEl = [...document.querySelectorAll<HTMLElement>('[class*="error"]')].find(
    (e) => e.innerText && e.innerText.trim()
  );
  return {
    success: false,
    error: errorEl
      ? errorEl.innerText.trim()
      : "送信結果を確認できませんでした（未入力項目が残っている可能性があります）",
  };
}

async function fillAndSubmit(data: QueueItem): Promise<FillAndSubmitResult> {
  await fillForm(data);
  return submitForm();
}

chrome.runtime.onMessage.addListener(
  (message: { type: string; data?: QueueItem }, _sender, sendResponse) => {
    if (message.type !== MSG.FILL_AND_SUBMIT || !message.data) return undefined;

    fillAndSubmit(message.data)
      .then((result) => sendResponse(result))
      .catch((err: unknown) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        sendResponse({ success: false, error: errorMessage });
      });

    return true; // 非同期でsendResponseを呼ぶことを示す
  }
);
