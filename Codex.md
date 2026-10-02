# Codex.md — 画像アセット制作の指示書

このファイルは、学習アプリ『先輩、AWSを教えてください！ 〜SAA-C03 リベンジ・レッスン〜』で使う **画像 41 点**（アプリ用 39 点＋参照シート 2 点）を、**OpenAI Codex または ChatGPT** で作成するための手順書です。

- **Codex で自動化する場合**：このファイルを読ませ、「Codex.md の手順で画像を作って」と指示してください（§5-B のスクリプトを使います）。
- **ChatGPT で手作業する場合**：§5-A の手順に沿って、`assets/image-prompts.json` のプロンプトを1つずつ貼り付けてください。

> BGM と効果音は Claude がコード（Web Audio API）で合成済みです。**音声ファイルは作らないでください。**
> 画像がなくてもアプリは動きます（プレースホルダーを表示）。画像を置くと自動的に差し替わります。

---

## 1. 絶対ルール

1. **触ってよいのは `assets/images/` 配下の画像ファイルだけ**です（必要なら `assets/image-prompts.json` も可）。`index.html`・`js/`・`css/`・`data/`・`docs/`・`tools/` は変更しないでください。
2. **ファイル名・フォルダは `data/assets.js` と完全一致**させてください（例：`assets/images/characters/akari_smile.png`）。拡張子は **`.png` 推奨**です。`.webp` / `.jpg` / `.jpeg` でもアプリが自動検出します（同名で拡張子違いを複数置かない）。
3. 画像に **文字・数字・ロゴ・透かし・署名を入れない**。特に **AWS / Amazon のロゴや商標**は不可。画面やホワイトボードの中身も「判読できない線や図形」にとどめます。
4. **実在の人物に似せない**。登場人物はどちらも **成人（24 歳と 29 歳）** で、**職場にふさわしい服装・健全な表現**にします（露出の多い服装、性的な強調、身体接触の多い構図は不可）。
5. 生成用の API キーは環境変数（`OPENAI_API_KEY`）から読み、**ファイルに書かない・コミットしない**。
6. プロジェクト直下の PDF（受験結果）は開かない・参照しない・アップロードしない。

---

## 2. 作るもの一覧

| 種類 | 保存先 | サイズ | 背景 | 点数 |
|---|---|---|---|---|
| 立ち絵（あかり） | `assets/images/characters/akari_<表情>.png` | 1024×1536 | **透過** | 9 |
| 立ち絵（レン） | `assets/images/characters/ren_<表情>.png` | 1024×1536 | **透過** | 8 |
| 顔アイコン | `assets/images/faces/face_akari.png`, `face_ren.png` | 1024×1024 | 単色 | 2 |
| 背景 | `assets/images/backgrounds/bg_*.png` | 1536×1024 | 不透過 | 10 |
| イベント CG | `assets/images/cg/cg_*.png` | 1536×1024 | 不透過 | 10 |
| 参照シート（アプリでは未使用） | `assets/images/_reference/akari_ref.png`, `ren_ref.png` | 1536×1024 | 不透過 | 2 |

### 2.1 個別アセット（どこで使われるか）

| key | 内容 | 主な使用場面 |
|---|---|---|
| `akari_normal` | 通常（ノートを胸の前で持つ基本ポーズ） | 全章 |
| `akari_smile` | 笑顔 | 全章 |
| `akari_happy` | 大喜び（小さくガッツポーズ） | 正解時・合格 |
| `akari_surprised` | 驚き | 引っかけ問題 |
| `akari_troubled` | 困り顔（汗マーク） | 間違えたとき |
| `akari_thinking` | 考え中（ペンを顎に） | 講義中 |
| `akari_sad` | 落ち込み（涙目） | プロローグ |
| `akari_blush` | 照れ | ほんのりラブコメ場面 |
| `akari_determined` | やる気（拳を握る） | 章の締め |
| `ren_normal` | 通常（片手をポケット） | 全章 |
| `ren_smile` | 微笑み | 全章 |
| `ren_explain` | 解説（マーカーを持ち人差し指を立てる） | 講義・問題の導入 |
| `ren_serious` | 真剣 | 重要ポイント |
| `ren_smirk` | からかい | 軽口 |
| `ren_surprised` | 控えめな驚き | あかりの成長に驚く |
| `ren_impressed` | 感心（腕組み・うなずき） | 正解時 |
| `ren_thinking` | 思案（眼鏡に指） | 問題の読み解き |
| `face_akari` / `face_ren` | 顔アイコン | チャット欄・名前欄 |
| `bg_office_day` | オフィス（昼） | 第5章・最終章 |
| `bg_office_night` | オフィス（夜） | プロローグ・第4章 |
| `bg_meeting_room` | 会議室（ホワイトボード） | 第1〜6章の講義 |
| `bg_lab` | 検証ラボ | ハンズオン |
| `bg_cafe` | 社内カフェラウンジ | 第2章の休憩 |
| `bg_rooftop_evening` | 屋上（夕暮れ） | 第6章 |
| `bg_home_night` | あかりの部屋（夜） | 第2章・リトライエンド |
| `bg_station_morning` | 駅前（朝） | 試験当日 |
| `bg_test_center` | テストセンター前 | 試験当日 |
| `bg_park_autumn` | 紅葉の公園（夕方） | トゥルーエンド |
| `cg_title` | タイトルのキービジュアル（右1/3は文字用に落ち着いた画面） | タイトル画面 |
| `cg_prologue_result` | 不合格通知を見て落ち込むあかり | プロローグ |
| `cg_whiteboard_lecture` | ホワイトボードで講義するレン | 第1章 |
| `cg_late_night_study` | 夜のオフィスで二人で勉強 | 第4章 |
| `cg_rooftop_talk` | 夕焼けの屋上で語り合う | 第6章 |
| `cg_handson_lab` | ラボでハンズオン | 第3章 |
| `cg_exam_morning` | 試験当日の朝、決意のあかり | 最終章 |
| `cg_pass_celebration` | 合格を喜ぶ二人 | 最終章 |
| `cg_ending` | 紅葉の並木道を歩く二人 | トゥルーエンド |
| `cg_retry_end` | 気合を入れ直すあかり | リトライエンド |

全 key の最終プロンプト（英語）は **`assets/image-prompts.json`** にあります（`node tools/build-image-prompts.mjs` で再生成できます）。

---

## 3. アートディレクション

- **画風**：日本のアニメ／ビジュアルノベル（ギャルゲー）風。クリーンな線画、セルシェーディング＋柔らかいグラデーション、秋の柔らかい光。
- **配色**：あかり＝コーラルピンク `#ff8fa3`、レン＝ブルー `#3a7bd5`。UI はクリーム `#f6f3ee` とネイビー `#1f2a44`。
- **背景**：人物なし。目線の高さの広い構図。
- **CG**：二人の「師弟としての信頼」と「ほのかな温かさ」が伝わる構図。距離感は節度を保つ。
- **16:9 の安全領域**：背景・CG は 1536×1024（3:2）で作りますが、アプリでは 16:9 に表示するため **上下それぞれ約 7% が切れます**。顔や重要な要素は中央に置いてください。
- **立ち絵の構図（最重要）**：全差分で **同じポーズ・同じ大きさ・同じ位置**。膝上（頭頂〜膝のすぐ上）、キャンバス中央、頭の上に約 5% の余白、足元側は画像の下端で切れる。透過 PNG、床の影なし。

---

## 4. キャラクターデザイン（固定要素）

すべてのプロンプトに、次の **キャラクターロック** を含めます（`assets/image-prompts.json` には組み込み済み）。

**七瀬 あかり（24 歳・入社2年目のインフラエンジニア）**
> Character "Akari Nanase": an adult Japanese woman, 24 years old, about 160 cm, slim build. Milk-tea brown shoulder-length hair with soft wavy ends and side-swept bangs, a small thin braid on her left side fastened with a small coral-pink hair clip. Large warm amber-brown eyes, gentle round face, light natural makeup. Outfit: white blouse with a soft bow-tie collar, navy blue knit cardigan, beige flared knee-length skirt, black low-heel pumps. Employee ID card on a coral-pink lanyard. Often holds a notebook full of colorful sticky notes. Cheerful, earnest, slightly clumsy junior infrastructure engineer.

**氷室 レン（29 歳・シニアクラウドアーキテクト兼テクニカルインストラクター）**
> Character "Ren Himuro": an adult Japanese man, 29 years old, about 182 cm, slim and tall. Neat black hair with slightly long bangs swept to one side, sharp gray-blue eyes, thin silver square-frame glasses. Outfit: white dress shirt with sleeves rolled up to the elbows, top button open, no tie, dark navy vest (waistcoat), charcoal slacks, silver wristwatch, employee ID card on a navy lanyard. Calm, handsome, mature senior cloud architect and technical instructor; kind eyes behind a cool expression.

**共通スタイル文**
> Japanese anime visual-novel illustration, clean confident lineart, cel shading with soft gradients, warm soft autumn lighting, high detail, polished commercial galge quality, gentle pastel palette with coral pink and blue accents

**共通の禁止事項**
> No text, no letters, no numbers, no logos, no watermark, no signature, no brand marks (especially no AWS or Amazon logos). Do not resemble any real person.

---

## 5. 制作手順

### 5-A. ChatGPT で手作業する場合

1. **参照シートを先に作る**：`assets/image-prompts.json` の `akari_ref` と `ren_ref` のプロンプトで、キャラクター設定画を作ります。気に入るまで作り直し、ダウンロードして `assets/images/_reference/` に保存します。
2. **立ち絵の基本（normal）を作る**：参照シートを添付し、`akari_normal` のプロンプトを貼り付けます。「背景は透過 PNG で」と明記します。
3. **表情差分を作る**：基本の立ち絵と参照シートを添付し、次のように依頼します。
   > 添付の立ち絵と**同一人物・同一衣装・同一画風・同一ポーズ・同一の大きさと位置**のまま、**表情（と記載された手の動きだけ）**を次のとおり変更してください。背景は透過 PNG。<`akari_smile` のプロンプト>
4. **背景・CG**：JSON のプロンプトをそのまま使います。CG は参照シートを添付し「キャラクターは添付の設定画と同一人物」と添えます。
5. ダウンロードした画像を §2 のファイル名で保存し、§6 の後処理と §7 の確認を行います。

### 5-B. Codex で自動化する場合（OpenAI Images API）

前提：Python 3.10+、`pip install openai pillow`、環境変数 `OPENAI_API_KEY`。モデルは環境変数 `OPENAI_IMAGE_MODEL`（既定 `gpt-image-1`。その時点で利用できる最新の画像モデルに置き換えてかまいません）。パラメータ名がモデルにより異なる場合は、OpenAI の公式ドキュメントに合わせて調整してください。

`tools/` には置かず、作業用の一時ファイル（例：`/tmp/gen_images.py`）として実行してください。

```python
# gen_images.py — assets/image-prompts.json を読み、未作成の画像だけ生成する
import base64, json, os, pathlib, sys
from openai import OpenAI

# プロジェクトのルート（index.html がある場所）で実行すること
MODEL = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-1")
client = OpenAI()  # OPENAI_API_KEY を環境変数から読む
items = json.loads(pathlib.Path("assets/image-prompts.json").read_text(encoding="utf-8"))
only = set(sys.argv[1:])  # 引数で key を指定すると、その画像だけ作る

def save(path, b64):
    p = pathlib.Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(base64.b64decode(b64))
    print("saved", p)

# 参照シートを最初に作る
items.sort(key=lambda x: 0 if x["key"].endswith("_ref") else 1)
for it in items:
    if only and it["key"] not in only:
        continue
    out = pathlib.Path(it["path"])
    if out.exists():
        continue
    params = dict(model=MODEL, prompt=it["prompt"], size=it["size"], quality="high", output_format="png")
    if it["background"] == "transparent":
        params["background"] = "transparent"
    refs = [r for r in (it.get("reference") or "").split(",") if r]
    ref_files = [pathlib.Path(f"assets/images/_reference/{r}.png") for r in refs]
    if ref_files and all(f.exists() for f in ref_files):
        # 参照シートを渡して、キャラクターの一貫性を保つ
        with_files = [open(f, "rb") for f in ref_files]
        try:
            res = client.images.edit(image=with_files, **params)
        finally:
            for f in with_files:
                f.close()
    else:
        res = client.images.generate(**params)
    save(out, res.data[0].b64_json)
```

実行例：`python gen_images.py`（全部）／`python gen_images.py akari_smile akari_happy`（指定分のみ）。
生成後に §6 の後処理、§7 の確認を行ってください。気に入らない画像はファイルを削除して再実行すれば作り直せます。

---

## 6. 後処理

1. **透過の確認**：立ち絵 17 点はアルファチャンネル付き PNG であること。背景が残っている場合は、単色背景（例：純緑 `#00FF00`）で作り直してからクロマキーで抜くか、背景除去ツールを使います。
2. **立ち絵の位置合わせ**：全差分で頭・肩の位置が揃うよう、1024×1536 のキャンバスに **下端揃え・左右中央** で配置します。
3. **容量**：1 枚あたり約 1.5 MB 以下を目安に（任意で `pngquant` / `oxipng`）。

チェック＆整形スクリプト例（Pillow）：

```python
# check_images.py — サイズ・透過を検査し、立ち絵は下端揃えで 1024x1536 に整える
import json, pathlib
from PIL import Image

items = json.loads(pathlib.Path("assets/image-prompts.json").read_text(encoding="utf-8"))
for it in items:
    p = pathlib.Path(it["path"])
    if not p.exists():
        print("MISSING ", it["key"]); continue
    im = Image.open(p)
    w, h = map(int, it["size"].split("x"))
    if it["background"] == "transparent":
        im = im.convert("RGBA")
        bbox = im.getchannel("A").getbbox()
        if not bbox or im.getchannel("A").getextrema()[0] == 255:
            print("NO-ALPHA", it["key"]); continue
        fig = im.crop(bbox)
        scale = min((w * 0.96) / fig.width, (h * 0.95) / fig.height)
        fig = fig.resize((round(fig.width * scale), round(fig.height * scale)), Image.LANCZOS)
        canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        canvas.paste(fig, ((w - fig.width) // 2, h - fig.height), fig)  # 下端揃え・中央
        canvas.save(p, optimize=True)
        print("SPRITE  ", it["key"], "->", canvas.size)
    elif im.size != (w, h):
        im = im.convert("RGB").resize((w, h), Image.LANCZOS)
        im.save(p, optimize=True)
        print("RESIZED ", it["key"])
    else:
        print("OK      ", it["key"])
```

---

## 7. 確認

1. `index.html` をブラウザで開き、**設定 → 画像アセット確認**（または `index.html#assets`）で全項目が「✓ 見つかりました」になっていること。「⚠ サイズ違い」は縦横比を確認してください。
2. ターミナルで `node tools/validate.mjs` を実行し、最後の `images: N present` が 39 になっていること。
3. **はじめから**でプロローグを少し再生し、立ち絵の位置・大きさが表情差分で揃っているか、背景・CG の上下が不自然に切れていないかを確認します。
4. タイトル画面で `cg_title` の右側に文字が重なっても読みやすいかを確認します。

---

## 8. よくある問題と対処

| 症状 | 対処 |
|---|---|
| 表情差分でキャラクターの顔・髪型・服が変わる | 参照シートと基本立ち絵を毎回添付し、「同一人物・同一衣装・表情だけ変更」と明記する。キャラクターロック文は省略しない。 |
| 背景が透過されない | プロンプト末尾に「transparent background PNG」を再度明記。ダメなら純緑背景で作り、クロマキーで抜く。 |
| 画像に文字やロゴが入る | 禁止事項の文を必ず含める。ホワイトボードやモニターは「boxes and arrows only, nothing readable」と指定する。 |
| 手や指が崩れる | 手のポーズを単純にする（ノートを両手で持つ、ポケットに入れる等）。崩れた差分だけ作り直す。 |
| 16:9 表示で頭が切れる | 「faces inside the central 16:9 safe area」を強調し、人物を少し小さめ・中央寄りに。 |
| 立ち絵の大きさが差分ごとに違う | §6 のスクリプトで下端揃え・同スケールに整える。 |
| 年齢が若く見えすぎる | 「adult, 24 years old / 29 years old, professional office worker」を強調し、制服風の服装を避ける。 |
