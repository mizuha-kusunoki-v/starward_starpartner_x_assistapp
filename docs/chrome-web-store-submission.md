# Chrome ウェブストア 申請ガイド

上から順に進めれば申請まで到達できる手順書です。

公開ページ（GitHub Pages）:

- トップ: https://mizuha-kusunoki-v.github.io/starward_starpartner_x_assistapp/
- 使い方ガイド: https://mizuha-kusunoki-v.github.io/starward_starpartner_x_assistapp/user-guide.html
- プライバシーポリシー: https://mizuha-kusunoki-v.github.io/starward_starpartner_x_assistapp/privacy-policy.html

## 0. 事前準備チェックリスト

- [ ] アイコン画像（`icons/` に16/48/128px。現在は仮の★アイコンなので、必要なら差し替え）
- [ ] スクリーンショット 1枚以上（1280x800 または 640x400。ダッシュボードで投稿を取得した画面・設定画面など）
  - 他人の投稿や自分のDiscord ID等が写り込まないよう注意
- [ ] プライバシーポリシーを公開済み（GitHub Pages。手順1）
- [ ] Googleデベロッパー登録（YouTube版で登録済みなら不要）
- [ ] `dist`フォルダのzip（手順3）

---

## 1. GitHub Pages の公開

`docs/` フォルダを GitHub Pages で公開しています（Settings → Pages → Source: Deploy from a branch / Branch: `main` / フォルダ: `/docs`）。
`docs/` 以下を更新して `main` にpushすると、数分で公開ページにも反映されます。

---

## 2. Chromeウェブストア デベロッパー登録

1. [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole/) を開く
2. Googleアカウントでログイン
3. 初回のみ $5 の登録料を支払う（YouTube版で登録済みの同じアカウントなら不要）

---

## 3. 拡張機能パッケージ(zip)の用意

### 自動ビルド(推奨)
タグをpushすると、GitHub Actions（`.github/workflows/release.yml`）が型チェック・ビルド・zip化し、Releasesに公開します。

```bash
git tag v0.1.0
git push origin v0.1.0
```

数分後、リポジトリの「Releases」に `starpartner-x-assistant-v0.1.0.zip` が生成されます。

### 手動ビルド
```bash
npm ci
npm run build
```
生成された `dist` フォルダの**中身**（`dist`フォルダ自体ではなく中のファイル群）をzip圧縮します。

---

## 4. ストアへの新規アイテム登録

1. Developer Dashboardの「新しいアイテムを追加」
2. 手順3のzipをアップロード
3. 以下の項目を入力

### ストア掲載情報（コピーして使える文面案）

**タイトル**
```
星の翼 スターパートナー X投稿申請アシスト
```

**簡単な説明（132文字以内）**
```
自分のX（Twitter）のイラスト・小説投稿を集め、スターパートナー申請フォームへの入力・送信作業を半自動化します。
```

**詳細な説明**
```
「スターパートナー」プログラムに参加しているイラスト・小説クリエイター向けの補助ツールです。

【できること】
・自分のX（Twitter）の投稿を月単位で読み取り、申請対象の作品投稿を自動で判定
・画像付きの投稿だけでなく、小説サイトへのリンク・小説を示す言葉・長文などから小説の投稿も判定
・対象外になった投稿も理由付きで確認でき、手動で申請対象に加えられます
・投稿本文からキャラクター欄を自動推測
・一覧画面で内容を確認・修正してから、選択した投稿をまとめて申請フォームへ送信

【安全設計について】
・全自動の無人連続送信は行いません。必ず一覧で内容を確認し、ユーザー自身が送信を実行します
・送信に失敗した場合は自動で停止し、該当ページを開いたまま手動対応を促します
・送信済みの投稿は記録され、重複送信を防ぎます
・Xのパスワードやログイン情報は扱いません。ログイン済みの画面に表示された自分の投稿を読み取るだけです

【必要なもの】
・Chromeでログイン済みのXアカウント
・運営から個別に案内される申請フォームURL
（APIキー等の準備は不要です）

このツールは開発者が運営するサーバーを一切持たず、すべての処理はお使いのブラウザ内で
完結します。読み取ったデータや入力内容が外部のサーバーへ送信されることはありません。
詳細はプライバシーポリシーをご確認ください。

使い方・初期設定の詳しい手順はこちら:
https://mizuha-kusunoki-v.github.io/starward_starpartner_x_assistapp/user-guide.html
```

**カテゴリ**: 仕事効率化（Productivity）

**言語**: 日本語

### プライバシー関連（「プライバシー プラクティス」タブ）

**単一の目的の説明 (Single purpose description)**
```
This extension helps an illustrator or fiction writer collect their own posts on
X (Twitter) and semi-automatically transcribe the post details (link, date,
character) into a specific web form (the official "Star Partner" artwork/fiction
application form hosted on wj.qq.com) that the creator already fills out manually
as part of a game's creator reward program. The user always reviews the list and
explicitly triggers the submission.
```

**権限の正当化 (Permission justifications)**

| 権限 | 正当化文（コピー用） |
|---|---|
| `storage` | Used to store the user's own settings (registered nickname, Discord ID, X username, keyword rules) and a local history of already-submitted posts, entirely on the user's device, to prevent duplicate submissions. |
| `tabs` | Used to open the user's own X search results page and the target application form in new tabs, and to detect when each page has finished loading. |
| `scripting` | Used to inject the post-reading script into the X search results page only when the user clicks "fetch posts" in the dashboard, and to auto-fill the application form with data the user already reviewed. |
| host permission: `https://x.com/*` | Required to read the user's own posts (link, date, text, whether media is attached) from the X search results page that the extension opens in the user's logged-in browser at the user's request. No credentials are read and nothing is sent to any server. |
| host permission: `https://wj.qq.com/*` | Required to fill in and submit the specific "Star Partner" application form hosted on this domain, only for posts the user explicitly selected. |

**リモートコードの使用**: 「いいえ、リモートコードを使用していません」（全コードを同梱）

**データの使用（収集するユーザーデータ）**

本拡張機能は開発者のサーバーへ何も送信しませんが、端末内に保存・処理するデータについて、審査で不整合を指摘されないよう保守的に申告しておくのが無難です。

- [x] 個人を特定できる情報（Twitter名・Discord ID。フォーム転記用に端末内へ保存）
- [x] ウェブサイトのコンテンツ（自分のXの投稿内容。判定のため端末内で処理）
- それ以外（健康・金融・認証情報・位置情報・ウェブ履歴・ユーザーアクティビティ等）はチェックしない

開示事項の3項目（第三者への販売・譲渡をしない／単一目的と無関係な用途に使わない／信用力判断や融資目的に使わない）はすべてチェックします。

**プライバシーポリシーURL**
```
https://mizuha-kusunoki-v.github.io/starward_starpartner_x_assistapp/privacy-policy.html
```

---

## 5. 審査への提出

1. すべての項目を入力後、「審査のために送信」をクリック
2. 審査には数日〜1週間程度かかることがあります
3. 却下された場合は理由がメールで届くので、該当箇所を修正して再提出します
   - 典型的な却下理由: 権限の説明が曖昧、プライバシーポリシーと実際の動作の不一致、スクリーンショット不足
   - x.com への権限は審査で詳しく見られやすいので、「ユーザー自身の投稿を、ユーザーの操作時にのみ読み取る」点を明確にしておく

---

## 6. 公開後の更新

新バージョンを出すときは、`manifest.json`と`package.json`の`version`を上げてから
同じ手順でzipを作り直し、Developer Dashboardの既存アイテムから「パッケージをアップロード」
すれば差し替えられます（審査は毎回入ります）。
