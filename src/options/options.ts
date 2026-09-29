import { getSettings, saveSettings } from "../lib/storage";
import { normalizeHandle } from "../lib/xSearch";
import type { CharacterRule, Settings } from "../lib/types";

function requireEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`要素が見つかりません: #${id}`);
  return el as T;
}

const els = {
  formUrl: requireEl<HTMLInputElement>("formUrl"),
  twitterName: requireEl<HTMLInputElement>("twitterName"),
  discordId: requireEl<HTMLInputElement>("discordId"),
  xHandle: requireEl<HTMLInputElement>("xHandle"),
  searchKeywords: requireEl<HTMLInputElement>("searchKeywords"),
  excludeKeywords: requireEl<HTMLInputElement>("excludeKeywords"),
  requireWorkSignal: requireEl<HTMLInputElement>("requireWorkSignal"),
  novelKeywords: requireEl<HTMLInputElement>("novelKeywords"),
  novelDomains: requireEl<HTMLInputElement>("novelDomains"),
  minTextLength: requireEl<HTMLInputElement>("minTextLength"),
  characterRows: requireEl<HTMLTableSectionElement>("characterRows"),
  defaultCharacter: requireEl<HTMLInputElement>("defaultCharacter"),
  status: requireEl<HTMLSpanElement>("status"),
};

function addRuleRow(rule: CharacterRule = { character: "", keywords: [] }): void {
  const tr = document.createElement("tr");

  const characterTd = document.createElement("td");
  const characterInput = document.createElement("input");
  characterInput.type = "text";
  characterInput.className = "rule-character";
  characterInput.value = rule.character;
  characterTd.appendChild(characterInput);

  const keywordsTd = document.createElement("td");
  const keywordsInput = document.createElement("input");
  keywordsInput.type = "text";
  keywordsInput.className = "rule-keywords";
  keywordsInput.value = (rule.keywords || []).join(", ");
  keywordsTd.appendChild(keywordsInput);

  const actionTd = document.createElement("td");
  actionTd.className = "row-actions";
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.textContent = "削除";
  removeBtn.addEventListener("click", () => tr.remove());
  actionTd.appendChild(removeBtn);

  tr.append(characterTd, keywordsTd, actionTd);
  els.characterRows.appendChild(tr);
}

function readRulesFromTable(): CharacterRule[] {
  return [...els.characterRows.querySelectorAll("tr")]
    .map((tr) => {
      const character = tr.querySelector<HTMLInputElement>(".rule-character")!.value.trim();
      const keywords = tr
        .querySelector<HTMLInputElement>(".rule-keywords")!
        .value.split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      return { character, keywords };
    })
    .filter((rule) => rule.character);
}

async function load(): Promise<void> {
  const settings = await getSettings();
  els.formUrl.value = settings.formUrl;
  els.twitterName.value = settings.twitterName;
  els.discordId.value = settings.discordId;
  els.xHandle.value = settings.xHandle;
  els.searchKeywords.value = settings.searchKeywords;
  els.excludeKeywords.value = settings.excludeKeywords;
  els.requireWorkSignal.checked = settings.requireWorkSignal;
  els.novelKeywords.value = settings.novelKeywords;
  els.novelDomains.value = settings.novelDomains;
  els.minTextLength.value = String(settings.minTextLength);
  els.defaultCharacter.value = settings.defaultCharacter;

  els.characterRows.replaceChildren();
  settings.characterRules.forEach(addRuleRow);
  if (!settings.characterRules.length) addRuleRow();
}

async function save(): Promise<void> {
  const settings: Settings = {
    formUrl: els.formUrl.value.trim(),
    twitterName: els.twitterName.value.trim(),
    discordId: els.discordId.value.trim(),
    xHandle: normalizeHandle(els.xHandle.value),
    searchKeywords: els.searchKeywords.value.trim(),
    excludeKeywords: els.excludeKeywords.value.trim(),
    requireWorkSignal: els.requireWorkSignal.checked,
    novelKeywords: els.novelKeywords.value.trim(),
    novelDomains: els.novelDomains.value.trim(),
    minTextLength: Math.max(0, Number(els.minTextLength.value) || 0),
    characterRules: readRulesFromTable(),
    defaultCharacter: els.defaultCharacter.value.trim(),
  };
  await saveSettings(settings);
  els.xHandle.value = settings.xHandle;
  els.status.textContent = "保存しました";
  setTimeout(() => (els.status.textContent = ""), 2000);
}

requireEl<HTMLButtonElement>("addRuleBtn").addEventListener("click", () => addRuleRow());
requireEl<HTMLButtonElement>("saveBtn").addEventListener("click", save);

load();
