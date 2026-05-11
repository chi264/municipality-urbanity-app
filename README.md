# 市町村都会度分析 MVP

スマホ利用を前提にした、GitHub Pages配信可能な静的PWAです。

## 構成

- `index.html`: アプリ本体
- `styles.css`: モバイル優先UI
- `app.js`: 画面描画、都会度計算、localStorage保存
- `data/municipalities.json`: 市町村データ
- `data/travel_times.json`: 主要中心地からの所要時間データ
- `manifest.webmanifest`: PWA manifest
- `service-worker.js`: オフラインキャッシュ
- `assets/icon-192.png`, `assets/icon-512.png`: ホーム画面用アイコン

## データ追加

`data/municipalities.json` に以下の形で追加します。

```json
{
  "id": "prefecture-city",
  "prefecture": "都道府県名",
  "name": "市町村名",
  "type": "市",
  "population": 100000,
  "area": 123.45,
  "populationDensity": 810.0,
  "region": "所属地域",
  "center": {
    "name": "代表駅・市役所周辺",
    "lat": 35.0,
    "lng": 139.0
  },
  "scores": {
    "transport": 60,
    "commerce": 55,
    "administration": 50
  },
  "notes": "任意メモ"
}
```

人口・面積などが未調査の自治体は、まず `prefecture`、`name`、`type`、`id` だけ入れておき、後から項目を足せます。未入力値は画面上で `未入力` または低い仮スコアとして扱われます。

## 北海道データ

北海道179市町村は、北海道オープンデータポータルの `2025(R7)道内市町村の行政概要` から、住民基本台帳人口、面積、人口密度を反映しています。

- 人口: 2025-01-01 時点
- 面積: 2025-04-01 時点
- 元Excel: `sources/hokkaido_municipalities_2025.xlsx`
- 再生成スクリプト: `scripts/import_hokkaido.py`

中心地座標、交通スコア、商業スコア、行政スコアは未入力です。詳細データを足す場合は、各自治体の `center.lat`、`center.lng`、`scores.transport`、`scores.commerce`、`scores.administration` を追記します。

## 中心地と経路検索

詳細画面の「中心地編集」から、中心地名、緯度、経度を端末内の `localStorage` に保存できます。確定した中心地は、あとから `data/municipalities.json` の `center` に反映してください。

中心地までの時間欄には、主要駅からGoogle Mapsの公共交通検索を開くリンクを表示します。GitHub Pages単体ではGoogle Mapsの所要時間を自動取得・保存するAPIキーを安全に隠せないため、所要時間の自動計算は将来的に小さなAPIサーバーやサーバーレス関数を追加して対応します。

## 中心地座標検索ツール

`center-finder.html` は別アプリとして使える中心地座標検索ツールです。駅名や市役所名などを検索し、候補の緯度・経度と `center` 用JSONを表示します。検索にはOpenStreetMap Nominatimを利用します。

## GitHub Pages

リポジトリ直下にこのファイル群を置き、GitHub Pagesの公開元を `main` ブランチのルートに設定すると動きます。サーバー処理は不要です。

## ローカル確認

```sh
python -m http.server 4199 --bind 127.0.0.1
```

ブラウザで `http://127.0.0.1:4199/` を開きます。
