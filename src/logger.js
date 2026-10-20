const MAX_ENTRIES = 200;
const entries = [];
const listeners = new Set();

/**
 * @typedef {'info'|'warn'|'error'|'in'|'out'} LogLevel
 * @typedef {{ time: number, level: LogLevel, message: string, detail: string }} LogEntry
 */

/**
 * 写一条扩展日志，同时通知 UI。
 * @param {LogLevel} level
 * @param {string} message
 * @param {unknown} [detail]
 */
export function log(level, message, detail) {
    const entry = {
        time: Date.now(),
        level,
        message: String(message ?? ''),
        detail: detail === undefined || detail === null ? '' : String(detail),
    };

    entries.push(entry);
    if (entries.length > MAX_ENTRIES) {
        entries.shift();
    }

    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[consoleMethod]('[ST-QQ]', entry.message, entry.detail || '');

    for (const listener of listeners) {
        try {
            listener(entry);
        } catch (error) {
            console.warn('[ST-QQ] 日志监听器异常', error);
        }
    }
}

/** @returns {LogEntry[]} */
export function getLogs() {
    return entries.slice();
}

export function clearLogs() {
    entries.length = 0;
}

/**
 * @param {(entry: LogEntry) => void} listener
 * @returns {() => void} 取消订阅
 */
export function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
