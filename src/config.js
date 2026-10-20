import { extension_settings, saveSettingsDebounced } from '../st-api.js';

export const SETTINGS_KEY = 'st_qq_bridge';

export const DEFAULT_SETTINGS = {
    enabled: false,
    autoConnect: true,
    wsUrl: 'ws://127.0.0.1:3001/',
    accessToken: '',
    allowedUserIds: '',
    defaultTargetUserId: '',
    usePersonaName: true,
    sendManualReplies: true,
    stripThinking: true,
    maxCharsPerMessage: 3000,
    generationTimeoutMs: 300000,
};

/**
 * 取扩展设置。缺少的字段用默认值补齐，保证旧配置升级后不会出现 undefined。
 * @returns {typeof DEFAULT_SETTINGS}
 */
export function getSettings() {
    if (!extension_settings[SETTINGS_KEY] || typeof extension_settings[SETTINGS_KEY] !== 'object') {
        extension_settings[SETTINGS_KEY] = {};
    }

    const settings = extension_settings[SETTINGS_KEY];
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        if (settings[key] === undefined) {
            settings[key] = value;
        }
    }

    return settings;
}

/**
 * 延迟保存，避免每次输入都写盘。
 */
export function saveSettings() {
    saveSettingsDebounced();
}

/**
 * 把逗号、空格、换行分隔的 QQ 号解析成字符串数组。
 * @param {string} value
 * @returns {string[]}
 */
export function parseIdList(value) {
    return String(value ?? '')
        .split(/[\s,，;；]+/)
        .map(x => x.trim())
        .filter(x => /^\d+$/.test(x));
}
