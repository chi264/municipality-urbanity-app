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

## GitHub Pages

リポジトリ直下にこのファイル群を置き、GitHub Pagesの公開元を `main` ブランチのルートに設定すると動きます。サーバー処理は不要です。

## ローカル確認

```sh
python -m http.server 4199 --bind 127.0.0.1
```

ブラウザで `http://127.0.0.1:4199/` を開きます。
