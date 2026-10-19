# Piggy Buddy protocol v1 — 設計稿（未完成硬件）

JSON envelope: `{ "v":1, "id":"23", "type":"PING", "payload":{} }`。
回應：`{ "v":1, "id":"device-1", "replyTo":"23", "type":"PONG", "payload":{} }`。

| type | 方向 | payload／狀態 |
|---|---|---|
| CONNECT | iPad → device | client；WSS open 不等於完成配對 |
| DISCONNECT | 雙向 | reason；V0.1 實際使用 WebSocket close |
| PING / PONG | 雙向 | replyTo 對應 id；3 秒 timeout |
| START_LISTENING / STOP_LISTENING | iPad → device | 控制錄音；本版只發送指令 |
| SET_EXPRESSION | iPad → device | name: IDLE/LISTENING/THINKING/SPEAKING/HAPPY/SURPRISED/CONFUSED/SLEEPING/ERROR |
| DEVICE_STATUS | device → iPad | firmware,battery,capabilities；本版只記 type |
| ERROR | 雙向 | code,message,recoverable；不要含學生內容 |
| AUDIO_INPUT / AUDIO_OUTPUT | 雙向 | 設計中，V0.1 不播放音訊 |

建議音訊 header JSON 先宣告 streamId、PCM signed 16-bit little endian、mono、16000 Hz、20ms frames（640 bytes），後續 binary frame 加 streamId + sequence + sample timestamp。這是將來設計，V0.1 沒有 serializer、resampler、jitter buffer、背壓或實體播放。Web Speech 無法直接注入 ESP32 PCM，speechSynthesis 亦不提供 PCM 輸出；因此純 Web Speech 不能完成機械人雙向音訊，必須原生／其他本地語音引擎支援。

安全：HTTPS GitHub Pages 不能運行後端及 websocket server；不得依賴 ws://。WSS 需 hostname 相符且 iPad 信任的憑證。自簽憑證預設不可信，Safari WebSocket 沒有略過錯誤的 UI。學校 MDM 安裝 CA 或私有 DNS + 可信憑證均需管理，不保證現場可用；仍受本地網絡權限、路由、AP client isolation、防火牆限制。

V0.1 不含裝置認證，真實 WSS 標為「未驗證裝置」。生產前加入實體按鍵配對、短時 token、TLS、Origin 白名單、訊息大小上限、速率限制、重播防護、idle timeout。音訊禁止寫入 flash；重連必須重新取得教師收音授權，不得自動恢復咪高峰。
