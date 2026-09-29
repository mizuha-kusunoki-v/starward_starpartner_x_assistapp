import { getSettings, getSubmittedTweets } from "../lib/storage";
import { evaluateTweet, inferCharacter, type TweetEvaluation } from "../lib/classify";
import { MSG } from "../lib/messages";
import { toJstDateString } from "../lib/date";
import { buildMonthlySearchUrl, normalizeHandle } from "../lib/xSearch";
import { waitForTabComplete } from "../lib/tabs";
import type {
  CollectedTweet,
  CollectTweetsResult,
  QueueItem,
  Settings,
  SubmittedTweets,
} from "../lib/types";

interface RowState {
  tweetId: string;
  text: string;
  postDate: string;
  link: string;
  character: string;
  selected: boolean;
  submitted: boolean;
  /** 自動判定で対象外になった投稿（「対象外も表示」のときだけ見え、手動で選択できる） */
  excluded: boolean;
  status: string;
}

interface SubmitProgressMessage {
  type: typeof MSG.SUBMIT_PROGRESS;
  tweetId?: string;
  status: "success" | "failed" | "done";
  index?: number;
  total: number;
  error?: string;
}

function requireEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`要素が見つかりません: #${id}`);
  return el as T;
}

const els = {
  settingsWarning: requireEl<HTMLDivElement>("settingsWarning"),
  monthInput: requireEl<HTMLInputElement>("monthInput"),
  fetchBtn: requireEl<HTMLButtonElement>("fetchBtn"),
  fetchStatus: requireEl<HTMLSpanElement>("fetchStatus"),
  selectAll: requireEl<HTMLInputElement>("selectAll"),
  showExcluded: requireEl<HTMLInputElement>("showExcluded"),
  submitBtn: requireEl<HTMLButtonElement>("submitBtn"),
  submitStatus: requireEl<HTMLSpanElement>("submitStatus"),
  tweetRows: requireEl<HTMLTableSectionElement>("tweetRows"),
  characterList: requireEl<HTMLDataListElement>("characterList"),
};

let settings: Settings | null = null;
let submittedTweets: SubmittedTweets = {};
const rows = new Map<string, RowState>();

function defaultMonthValue(): string {
  // 対象年月ピッカーの初期値。JST基準の「当月」。
  return toJstDateString().slice(0, 7); // YYYY-MM
}

function settingsAreComplete(s: Settings): boolean {
  return Boolean(s.formUrl && s.twitterName && s.discordId && s.xHandle);
}

function renderCharacterList(): void {
  els.characterList.replaceChildren(
    ...settings!.characterRules.map((rule) => {
      const option = document.createElement("option");
      option.value = rule.character;
      return option;
    })
  );
}

function td(...children: (Node | string)[]): HTMLTableCellElement {
  const cell = document.createElement("td");
  cell.append(...children);
  return cell;
}

function textInput(value: string, className: string): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.className = className;
  input.value = value;
  return input;
}

function reasonsCell(evaluation: TweetEvaluation): HTMLTableCellElement {
  const cell = td();
  cell.className = "reasons";
  for (const reason of evaluation.reasons) {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = reason;
    cell.append(tag);
  }
  if (evaluation.rejectReason) {
    const reject = document.createElement("div");
    reject.className = "reject";
    reject.textContent = `対象外: ${evaluation.rejectReason}`;
    cell.append(reject);
  }
  return cell;
}

// 投稿本文はユーザー入力由来なので、innerHTMLは使わずDOM APIで組み立てる
function renderRow(tweet: CollectedTweet, evaluation: TweetEvaluation): void {
  const postDate = toJstDateString(tweet.datetime);
  const character = inferCharacter(tweet.text, settings!.characterRules, settings!.defaultCharacter);
  const alreadySubmitted = Boolean(submittedTweets[tweet.tweetId]);
  const excluded = !evaluation.included;

  const state: RowState = {
    tweetId: tweet.tweetId,
    text: tweet.text,
    postDate,
    link: tweet.url,
    character,
    selected: !alreadySubmitted && !excluded,
    submitted: alreadySubmitted,
    excluded,
    status: alreadySubmitted ? "送信済み" : "",
  };
  rows.set(tweet.tweetId, state);

  const tr = document.createElement("tr");
  tr.dataset.tweetId = tweet.tweetId;
  if (alreadySubmitted) tr.classList.add("submitted");
  if (excluded) tr.classList.add("excluded");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "row-select";
  checkbox.checked = state.selected;
  checkbox.disabled = alreadySubmitted;

  const thumbCell = td();
  if (tweet.thumbnail) {
    const img = document.createElement("img");
    img.className = "thumb";
    img.src = tweet.thumbnail;
    img.alt = "";
    thumbCell.append(img);
  }

  const anchor = document.createElement("a");
  anchor.href = tweet.url;
  anchor.target = "_blank";
  anchor.textContent = "Xで開く";
  const body = document.createElement("div");
  body.className = "tweet-text";
  body.textContent = tweet.text || "(本文なし)";

  const linkInput = textInput(state.link, "row-link");
  const characterInput = textInput(state.character, "row-character");
  characterInput.setAttribute("list", "characterList");
  characterInput.placeholder = "要入力";
  characterInput.classList.toggle("missing", !state.character);

  const statusCell = td(state.status);
  statusCell.className = "status-cell";

  tr.append(
    td(checkbox),
    thumbCell,
    td(anchor, body),
    td(postDate),
    reasonsCell(evaluation),
    td(linkInput),
    td(characterInput),
    statusCell
  );

  checkbox.addEventListener("change", () => {
    state.selected = checkbox.checked;
    updateSubmitButton();
  });
  linkInput.addEventListener("input", () => {
    state.link = linkInput.value;
  });
  characterInput.addEventListener("input", () => {
    state.character = characterInput.value;
    characterInput.classList.toggle("missing", !state.character.trim());
    updateSubmitButton();
  });

  els.tweetRows.appendChild(tr);
}

function updateSubmitButton(): void {
  const targets = [...rows.values()].filter((r) => r.selected && !r.submitted);
  const missing = targets.filter((r) => !r.character.trim()).length;
  els.submitBtn.disabled = !targets.length || missing > 0;
  els.submitStatus.textContent = missing
    ? `キャラクター未入力の投稿が${missing}件あります`
    : "";
}

/**
 * Xの検索結果タブを開き、収集スクリプトを注入して投稿を読み取る。
 * 仮想スクロールの描画はタブが非表示だと止まることがあるため、
 * 収集中はXのタブを前面に出し、終わったらダッシュボードに戻す。
 */
async function collectFromX(handle: string, year: number, month: number): Promise<CollectedTweet[]> {
  const dashboardTab = await chrome.tabs.getCurrent();
  const tab = await chrome.tabs.create({ url: buildMonthlySearchUrl(handle, year, month), active: true });
  const tabId = tab.id!;
  await waitForTabComplete(tabId);
  await chrome.scripting.executeScript({ target: { tabId }, files: ["content/xCollector.js"] });

  const result = (await chrome.tabs.sendMessage(tabId, {
    type: MSG.COLLECT_TWEETS,
    handle,
  })) as CollectTweetsResult | undefined;

  if (!result?.success) {
    // ログインが必要な場合などにユーザーがそのまま対応できるよう、タブは開いたままにする
    throw new Error(result?.error || "Xからの取得に失敗しました");
  }
  await chrome.tabs.remove(tabId);
  if (dashboardTab?.id) await chrome.tabs.update(dashboardTab.id, { active: true });
  return result.tweets || [];
}

async function handleFetch(): Promise<void> {
  settings = await getSettings();
  if (!settingsAreComplete(settings)) {
    els.settingsWarning.hidden = false;
    return;
  }
  els.settingsWarning.hidden = true;
  renderCharacterList();

  const monthValue = els.monthInput.value;
  const [year, month] = monthValue.split("-").map(Number) as [number, number];

  els.fetchBtn.disabled = true;
  els.fetchStatus.textContent = "取得中...（Xのタブで自動スクロール中）";
  els.tweetRows.replaceChildren();
  rows.clear();

  try {
    submittedTweets = await getSubmittedTweets();
    const collected = await collectFromX(normalizeHandle(settings.xHandle), year, month);
    // 検索は前後1日広めに行っているので、JST暦日で対象月に厳密に絞り込む
    const inMonth = collected
      .filter((t) => toJstDateString(t.datetime).startsWith(monthValue))
      .sort((a, b) => a.datetime.localeCompare(b.datetime));
    // 対象外と判定した投稿も捨てずに描画しておき、判定漏れ（画像なしの小説など）を手動で拾えるようにする
    let includedCount = 0;
    for (const tweet of inMonth) {
      const evaluation = evaluateTweet(tweet, settings);
      if (evaluation.included) includedCount++;
      renderRow(tweet, evaluation);
    }
    els.fetchStatus.textContent = `対象${includedCount}件 / 対象外${inMonth.length - includedCount}件（対象月の投稿${inMonth.length}件を判定）`;
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : String(err);
    els.fetchStatus.textContent = `取得に失敗しました: ${message}`;
  } finally {
    els.fetchBtn.disabled = false;
    updateSubmitButton();
  }
}

function setRowSelected(tr: HTMLTableRowElement, state: RowState, checked: boolean): void {
  state.selected = checked;
  tr.querySelector<HTMLInputElement>(".row-select")!.checked = checked;
}

/** 全選択は画面に見えている行だけが対象（非表示の対象外投稿まで選ばないように） */
function handleSelectAll(): void {
  const checked = els.selectAll.checked;
  for (const tr of els.tweetRows.querySelectorAll<HTMLTableRowElement>("tr")) {
    const state = rows.get(tr.dataset.tweetId!)!;
    if (state.submitted || (state.excluded && !els.showExcluded.checked)) continue;
    setRowSelected(tr, state, checked);
  }
  updateSubmitButton();
}

/** 対象外の行を隠すときは選択も外す（見えない投稿が送信されないように） */
function handleShowExcluded(): void {
  const show = els.showExcluded.checked;
  els.tweetRows.classList.toggle("show-excluded", show);
  if (!show) {
    for (const tr of els.tweetRows.querySelectorAll<HTMLTableRowElement>("tr.excluded")) {
      setRowSelected(tr, rows.get(tr.dataset.tweetId!)!, false);
    }
  }
  updateSubmitButton();
}

function setRowStatus(tweetId: string, text: string, cls?: string): void {
  const tr = els.tweetRows.querySelector<HTMLTableRowElement>(`tr[data-tweet-id="${tweetId}"]`);
  if (!tr) return;
  tr.querySelector<HTMLTableCellElement>(".status-cell")!.textContent = text;
  if (cls) tr.classList.add(cls);
}

function handleSubmit(): void {
  const queue: QueueItem[] = [...rows.values()]
    .filter((r) => r.selected && !r.submitted)
    .map((r) => ({
      tweetId: r.tweetId,
      twitterName: settings!.twitterName,
      discordId: settings!.discordId,
      tweetLink: r.link.trim(),
      postDate: r.postDate,
      character: r.character.trim(),
    }));

  if (!queue.length) return;

  els.submitBtn.disabled = true;
  els.submitStatus.textContent = `送信中... (0/${queue.length})`;

  chrome.runtime.sendMessage({ type: MSG.START_SUBMIT_QUEUE, queue });
}

chrome.runtime.onMessage.addListener((message: SubmitProgressMessage) => {
  if (message.type !== MSG.SUBMIT_PROGRESS) return;
  const { tweetId, status, index, total, error } = message;
  els.submitStatus.textContent = `送信中... (${index ?? 0}/${total})`;

  if (status === "success" && tweetId) {
    const state = rows.get(tweetId);
    if (state) state.submitted = true;
    setRowStatus(tweetId, "送信完了", "submitted");
  } else if (status === "failed" && tweetId) {
    setRowStatus(tweetId, `失敗: ${error || ""}`, "failed");
  } else if (status === "failed" && !tweetId) {
    els.submitStatus.textContent = `送信できませんでした: ${error || ""}`;
    updateSubmitButton();
  } else if (status === "done") {
    updateSubmitButton();
    els.submitStatus.textContent = `完了 (${total}件処理)`;
  }
});

els.fetchBtn.addEventListener("click", handleFetch);
els.selectAll.addEventListener("change", handleSelectAll);
els.showExcluded.addEventListener("change", handleShowExcluded);
els.submitBtn.addEventListener("click", handleSubmit);

(async function init() {
  els.monthInput.value = defaultMonthValue();
  settings = await getSettings();
  if (!settingsAreComplete(settings)) {
    els.settingsWarning.hidden = false;
  }
})();
