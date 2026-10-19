# Piggy Buddy — 叻豬 AI 助教 V0.1

2026-10-19。無付費 API、無後端、無 API Key。以 GitHub Pages 原始檔交付；未代用戶發佈至 GitHub。

## 開啟及部署

不要用 file:// 開啟 ES modules。Mac 終端機進入本資料夾執行 `python3 -m http.server 8080`，電腦瀏覽 http://localhost:8080。手機經 HTTP 區域網絡預覽時咪高峰及 WebGPU 可能不可用，請使用 HTTPS GitHub Pages。

1. 建立 GitHub repository `Piggy-Buddy`。
2. 將本資料夾**內的檔案**上載到 main 根目錄，index.html 必須位於根目錄。
3. Settings → Pages → Deploy from a branch → main / root → Save。
4. 開啟 https://icqm-ip.github.io/Piggy-Buddy/ 。本包全部路徑為相對路徑。
5. 不要上載數 GB 模型到 Git；模型由教師本機選取。

## 已實作

WORKING：Canvas 像素叻豬／九表情、文字介面、教師對話框、緊急停止、清除對話、效能 JSON 匯出、網絡介面狀態、無持久對話保存。
SIMULATION：教師明確選擇後使用固定文字，所有回應標示。模擬機械人無實體網絡，PING 回覆不算硬件成功。
EXPERIMENTAL：官方 Engine.create / createConversation / sendMessageStreaming 整合；真實語音辨識、TTS、咪高峰 RMS、WSS PONG。須在目標裝置實測。SDK 及模型未隨包提供，未完成真正 Gemma 推理驗證。
NOT IMPLEMENTED：iPad 原生推理、離線保證的廣東話 ASR、ESP32 韌體、二進制音訊收送／解碼／播放、裝置認證、硬件、外殼、經驗證的內容安全分類器及聲學延遲測量。

## Gemma 的真實限制

官方 Web API 列出 Gemma 4 E2B `gemma-4-E2B-it-gpu.litertlm`，以 @litert-lm/core 的 Engine 載入。WebGPU 存在不代表整套 runtime 相容。官方 GitHub issue #2616 記錄 Web runtime 使用 JSPI，iOS Safari 沒有 WebAssembly.Suspending/promising。本程式會檢查兩項及 GPU adapter，不符合就拒絕載入，不會假稱成功，也不聲稱 WASM 可以解決 JSPI。

測試替代：在具 WebGPU、JSPI 的 Mac Chrome 開啟同一網站。從官方模型連結接受授權及下載指定 GPU .litertlm，教師設定選取檔案 → 載入模型 → TEST AI。選到其他 litertlm 並不能保證模型身份，本版無模型 hash 白名單。SDK 從官方文件提供的 jsDelivr 路徑按需載入；該路徑未鎖版，生產前須鎖定驗證過版本並自託管 JS/WASM。SDK 供應鏈可接觸頁面記憶體，學校審批時須涵蓋此項。

不會自動下載數 GB 模型。不將模型複製入 Cache Storage，避免 Safari 同時保存檔案、Blob、權重導致記憶體壓力。重新整理須重新選檔。模型於頁面存活期間保留；每題 conversation 於 finally delete，沒有跨題記憶。Safari 分頁被系統終止無法保證捕捉錯誤。儲存 quota 由能力檢查顯示，quota 不是可用 RAM，12GB 實體 RAM 不代表分頁可用 12GB。完全離線需另行自託管／打包 SDK 及其所有 WASM 資源，現版沒有 service worker，未宣稱離線啟動。

## 語音與私隱

WebKit 公布 Safari 語音辨識使用 Siri 語音引擎，並非 zh-HK 一定離線的保證。本版須教師勾選才啟動 SpeechRecognition，要求 zh-HK 不保證實際語種或可用性。聲音可能交由系統／網絡服務。辨識後先讓教師核對文字，不會自動送出。

TTS 只列出 zh-HK 或 yue 聲線，沒有就報錯，不偷偷轉普通話。localService 僅為瀏覽器報告；需要在飛行模式、下載聲線後實測。TTS 可能需要新一次觸控才能在 iOS 播放；自動朗讀若失敗可用 TEST SPEAKER 檢查。咪高峰測試透過 Web Audio 本機量度 RMS 兩秒，不錄音、不上傳，finally 釋放資源。

本程式不寫 localStorage、IndexedDB 或聊天日誌。畫面最多保留 16 訊息；模型上下文每題釋放。緊急停止會停止語音、取消生成並忽略過期回應。教師設定非密碼保護，不應當成身份驗證。清除資料會刪本網站 Cache Storage 及本次畫面，不可清除作業系統／第三方語音服務資料或所有 HTTP 快取。

## 性能定義

- ASR Duration：由開始辨識到辨識 onend，包含學生說話；不是純解碼時間。
- AI First Token Latency：開始 generate 到首個非空文字 chunk，為首個可見 chunk 代理值，非底層單 token 精確計時。
- AI First Sentence Latency：開始 generate 到首個句末標點；若無標點，結束時餘文作一句。
- TTS First Audio Latency：首個已開始播放句子的 enqueue 到 utterance.onstart。
- Total Response Latency：文字按提問／ASR onspeechend（如有，否則 ASR onend）到第一句 TTS onstart。辨識文字核對的人工等待包含在語音總時間內。

沒有朗讀、沒有真實 AI 就不顯示 5 秒通過。onstart 並不證明人耳已聽到內容；必須用外部錄影／錄音人工對照。尚無目標 iPad 的實測數據。SDK 初始化不計入暖啟動問答，另外記錄冷啟動時間於人工測試。串流前文可能有不安全內容，本版沒有可信安全攔截，教師監督測試用，未適合無人監督學生使用。

## iPad Safari 驗收

- 記錄 iPadOS/Safari 版本、能力檢查、儲存 quota。Safari 若缺 JSPI 應顯示限制而非成功。
- 模擬模式提問、測試九表情、橫直轉向、放大字體、緊急停止、清除。
- 不同意語音私隱時開始收音應被拒絕；同意後檢查允許／拒絕權限、zh-HK 辨識結果、停止後收音圖示消失。
- TEST MICROPHONE 必須真實變動 RMS 並於兩秒後釋放。TEST SPEAKER 親耳確認廣東話，另測離線。
- Mac Chrome 真模型測試至少 20 題，匯出數據，人工統計中位數及 p95；模擬不可混入。再次提問不應重新初始化 engine。
- 生成／收音／朗讀途中停止，再發新題，舊資料不得插入新回應。
- HTML 安全：輸入 `<img src=x onerror=alert(1)>` 應只顯示文字。
- 預覽不等於 iPad 驗證。此交付環境沒有用戶目標 iPad、模型及實體機械人。

## 下一步最小 Hybrid

保留本 HTML/CSS、狀態及表情，將 AIEngine / SpeechAdapter / RobotAdapter 替換為 Swift bridge。WKWebView 載入 App bundle 的靜態資源，嚴格只允許 bundle origin 呼叫已白名單 bridge；不要讓任意遠端頁面調用硬件。Swift LiteRT-LM 原生 SDK 可作 Gemma 整合候選，須先驗證 iPad GPU 支援及性能。原生 SFSpeechRecognizer(locale: zh_HK) 先檢查 supportsOnDeviceRecognition，再設定 requiresOnDeviceRecognition=true，不支持就保留文字；不可默默退回雲端。AVSpeechSynthesizer 選本地香港聲線，AVAudioEngine 實作 PCM。URLSessionWebSocketTask 管理本地連線，加 NSLocalNetworkUsageDescription 等權限；無須付費雲端中轉。原生 App 仍需 TLS／配對，不能以關閉 ATS 全域驗證當解決方案。原生橋接本版未實作。

參考：
- https://developers.google.com/edge/litert-lm/js
- https://github.com/google-ai-edge/LiteRT-LM/issues/2616
- https://github.com/google-ai-edge/LiteRT-LM
- https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm
- https://webkit.org/blog/11648/new-webkit-features-in-safari-14-1/
- https://developer.apple.com/documentation/speech/sfspeechrecognizer/supportsondevicerecognition
- https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_client_applications
