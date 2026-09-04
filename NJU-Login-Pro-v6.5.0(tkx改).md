NJU-Login-Pro-v6.5.0(tkx改)的使用说明
该扩展是在原扩展的基础上将30s挡位换成了1~3s随机
如果需要更改此随即范围，例如想要改为2~5s随机：



//● 下面是改成 2~5 秒随机的完整清单。核心只 1 处，剩下全是文字。
//     ① 功能（必改，就这一处决定实际等待时间）
//     
//  grab-engine.js 约 785 行
//     
//  // 改前
//          cadenceTarget = 1000 + Math.floor((Number.isFinite(rv) ? Math.max(0, Math.min(1, rv)) : 0.5) * 2001);
//  // 改后
//          cadenceTarget = 2000 + Math.floor((Number.isFinite(rv) ? Math.max(0, Math.min(1, rv)) : 0.5) * 3001);
//
//  起点 1000→2000，跨度 2001→3001（= 5000−2000+1）。改完每轮就是 2000~5000ms 随机。
//
//  ② 文案（建议同步改，共 6 处，否则界面/日志还显示 1~3s）
//
//  grab-engine.js ~1004 行（启动日志）
//  // 改前
//                interval === RANDOM_CADENCE_SENTINEL_MS ? '随机 1~3s' : `${interval / 1000}s`});
//  // 改后
//                interval === RANDOM_CADENCE_SENTINEL_MS ? '随机 2~5s' : `${interval / 1000}s`});
//
//  popup.html 1882 行
//  <!-- 改前 --> <option value="30000">随机1~3s</option>
//  <!-- 改后 --> <option value="30000">随机2~5s</option>
//
//  popup.html 1890 行
//  <!-- 改前 --> <button class="interval-option" data-value="30000" type="button">随机1~3s</button>
//  <!-- 改后 --> <button class="interval-option" data-value="30000" type="button">随机2~5s</button>

//  popup.js ~767 行
//  // 改前
//    if (Number(value) === RANDOM_CADENCE_SENTINEL_MS) return '随机 1~3s';
//  // 改后
//    if (Number(value) === RANDOM_CADENCE_SENTINEL_MS) return '随机 2~5s';
//
//  content-grab.js ~1348 行
//  // 改前
//    if (Number(intervalMs) === RANDOM_CADENCE_SENTINEL_MS) return '随机 1~3s';
//  // 改后
//    if (Number(intervalMs) === RANDOM_CADENCE_SENTINEL_MS) return '随机 2~5s';
//
//  content-grab.js ~1764 行
//  <!-- 改前 --> <option value="30000">随机 1~3s</option>
//  <!-- 改后 --> <option value="30000">随机 2~5s</option>
//
//  ③ 注释（可选，3 处）
//
//  三个文件里常量旁都写着 // 30000 档位现表示：每轮随机等待 1~3s，顺手改成 2~5s 即可：
//  - grab-engine.js:4、popup.js:15、content-grab.js:1104
















  ---
