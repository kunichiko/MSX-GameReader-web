# MSX Game Reader — Web Dumper

[日本語](#日本語) | [English](#english)

---

## 日本語

Web ブラウザ（WebUSB）から **MSX Game Reader**（ASCII / Sunrise が 2004 年頃に頒布した USB 接続 MSX カートリッジリーダ、VID=`0x1125` / PID=`0xAC01`）を直接操作し、実カートリッジから ROM イメージをダンプする単一ページ Web アプリです。

**ライブ版**: <https://kunichiko.github.io/MSX-GameReader-web/>

### 機能

- 接続したカートリッジのマッパー種別を自動判定（Plain / Konami / Konami SCC / Konami SCC+ / ASCII8 / ASCII16 / ASCII16 SRAM）
- バンク切替を含めた完全 ROM ダンプ
- 末尾の 0xFF パディング除去、2 のべき乗ミラー検出による実 ROM サイズ自動推定
- SHA-1 / SHA-256 計算と openMSX softwaredb との照合（8,000 タイトル以上を識別）
- 一致したタイトル名をファイル名に反映
- セッション内のダンプ履歴と再ダウンロード
- 日本語 / 英語自動切替（ブラウザの言語設定に従う）

### 使い方

1. **Chrome / Edge / Opera など Chromium 系ブラウザ**でライブ版を開く
2. MSX Game Reader を USB で接続
3. （初回 Windows のみ）[WinUSB ドライバを当てる](./install-winusb.html)
4. `[Connect]` ボタン → デバイス選択ダイアログでリーダを選ぶ
5. カートリッジを挿入
6. `[📀 自動マッパー判定 + ダンプ]` ボタン
7. 結果カードの `[↓ Download]` ボタンで `.rom` ファイル取得

### 動作要件

- **ブラウザ**: WebUSB 対応の Chromium 系（Chrome / Edge / Opera）。Safari / Firefox 非対応。
- **Windows**: WinUSB ドライバを当てる必要あり（[ガイド](./install-winusb.html)）。
- **macOS 26 (Tahoe) 以降**: USB スタックの仕様変更により本機の vendor control 転送が timeout する事例を確認。**実機 Windows での利用を推奨**します。macOS 15 (Sequoia) 以前の Intel Mac / 古い macOS では動作実績あり。
- **Linux**: 通常動作（udev ルール設定で root 不要に）。

### 動作実績のあるカートリッジ

- ロードファイター, ツインビー (Konami, Plain ROM, 32KB)
- 激突ペナントレース, Nemesis 2, Salamander (Konami SCC, 128KB)
- ドラゴンクエスト II (Enix, ASCII8, 256KB)
- ハイドライド 3 (T&E SOFT, ASCII16, 512KB)

その他多数のタイトルが理論上動作可能（openMSX で識別される 8,000+ タイトルが照合対象）。

### ライセンス

[MIT License](./LICENSE)。

### 謝辞・出典

- ROM 識別データベース: [openMSX softwaredb.xml](https://github.com/openMSX/openMSX/blob/master/share/softwaredb.xml)
- MSX Game Reader は ASCII Corporation（日本、2004 年）および Sunrise（欧州、2005 年）の製品です。本ツールは本機の所有者向けに、観測された USB 通信に基づいて独立に開発されたユーティリティであり、本機メーカーからは独立しています。

---

## English

A single-page web application that dumps ROM images from real MSX cartridges via the **MSX Game Reader** (a USB MSX cartridge reader distributed by ASCII / Sunrise around 2004, VID=`0x1125` / PID=`0xAC01`), directly from your browser using the WebUSB API.

**Live**: <https://kunichiko.github.io/MSX-GameReader-web/>

### Features

- Automatic mapper detection (Plain / Konami / Konami SCC / Konami SCC+ / ASCII8 / ASCII16 / ASCII16 SRAM)
- Full ROM dump with proper bank switching
- Automatic ROM size estimation via trailing 0xFF stripping and power-of-2 mirror detection
- SHA-1 / SHA-256 computation and cross-referencing with openMSX softwaredb (8,000+ titles identifiable)
- Matched title used in download filename
- Per-session dump history with re-download
- Bilingual UI (Japanese / English), auto-detected from browser locale

### Usage

1. Open the live URL in **Chrome / Edge / Opera** (any Chromium-based browser)
2. Connect the MSX Game Reader via USB
3. (Windows only, first time) [Install WinUSB driver](./install-winusb.html)
4. Click `[Connect]` and pick the reader in the device selector dialog
5. Insert a cartridge
6. Click `[📀 Auto-detect & dump]`
7. Click `[↓ Download]` on the result card to save the `.rom` file

### Requirements

- **Browser**: Chromium-based browser with WebUSB (Chrome / Edge / Opera). Safari / Firefox not supported.
- **Windows**: WinUSB driver must be bound to the device. See the [install guide](./install-winusb.html).
- **macOS 26 (Tahoe) and later**: Known to time out on vendor control transfers due to USB stack changes. **Use a real Windows PC instead**. macOS 15 (Sequoia) and earlier on Intel Macs work.
- **Linux**: Works out of the box (configure udev rules to avoid needing root).

### Tested cartridges

- Road Fighter, Twinbee (Konami, Plain ROM, 32KB)
- Gekitotsu Pennant Race, Nemesis 2, Salamander (Konami SCC, 128KB)
- Dragon Quest II (Enix, ASCII8, 256KB)
- Hydlide 3 (T&E SOFT, ASCII16, 512KB)

Many other titles work in principle (8,000+ titles in the identification database).

### License

[MIT License](./LICENSE).

### Credits

- ROM identification database: [openMSX softwaredb.xml](https://github.com/openMSX/openMSX/blob/master/share/softwaredb.xml)
- MSX Game Reader is a product of ASCII Corporation (Japan, 2004) and Sunrise (Europe, 2005). This tool is an independent utility for owners of the device, developed based on observed USB traffic, and is not affiliated with the device manufacturer.
