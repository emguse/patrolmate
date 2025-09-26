# Codex Export

`ledger.codex.json` は、PatrolMate プロトタイプで利用している巡回台帳を外部の自動化ツールや Codex ワークフローに取り込むための JSON 形式です。

## 構成

- `schemaVersion`: ファイル構造のバージョン。
- `generatedAt`: エクスポート日時 (UTC)。
- `app`: アプリの概要情報。
- `sessionFields`: 巡回を開始する際に必要な入力項目。`type` は `text` / `date` / `option` を想定しています。
- `checklists`: 巡回属性ごとの点検項目と読み取りコード。
  - `summary`: 巡回の背景メモ。
  - `items[*].scanCode`: 現地で読み取るコード値。

## 利用例

- 外部システムで巡回計画を自動生成する際のテンプレートとして読み込む。
- Codex ワークフローやスクリプトで `sessionFields` をフォーム化し、`checklists` のタスクを端末に配信する。
- 新しい巡回カテゴリを追加したい場合は、同じ構造で `checklists` にエントリを追加し、`sessionFields[attributeId].options` を更新します。

本ファイルはアプリと同様に `localStorage` キャッシュと独立しており、PWA の静的アセットとして配布するだけで参照できます。
