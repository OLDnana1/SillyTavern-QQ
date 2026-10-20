import {
    characters,
    this_chid,
    getCurrentChatId,
    renderExtensionTemplateAsync,
} from '../st-api.js';
import { saveSettings } from './config.js';
import { clearLogs, getLogs, log, subscribe } from './logger.js';

const $id = id => $(`#${id}`);

export async function initUi(ctx) {
    const html = await renderExtensionTemplateAsync('third-party/SillyTavern-QQ', 'settings');
    $('#extensions_settings2').append(html);

    const settings = ctx.settings;

    // ---- 回填设置 ----
    $id('st-qq-enabled').prop('checked', settings.enabled);
    $id('st-qq-ws-url').val(settings.wsUrl);
    $id('st-qq-token').val(settings.accessToken).attr('autocomplete', 'off');
    $id('st-qq-allowed').val(settings.allowedUserIds);
    $id('st-qq-default-target').val(settings.defaultTargetUserId);
    $id('st-qq-persona-name').prop('checked', settings.usePersonaName);
    $id('st-qq-manual-replies').prop('checked', settings.sendManualReplies);
    $id('st-qq-strip-thinking').prop('checked', settings.stripThinking);
    $id('st-qq-strip-markdown').prop('checked', settings.stripMarkdown);
    $id('st-qq-dialogue-only').prop('checked', settings.dialogueOnly);
    $id('st-qq-max-chars').val(settings.maxCharsPerMessage);

    // ---- 设置绑定 ----
    $id('st-qq-enabled').on('change', () => {
        settings.enabled = $id('st-qq-enabled').prop('checked');
        saveSettings();

        if (settings.enabled) {
            ctx.client.connect();
        } else {
            ctx.client.disconnect();
        }
    });

    const reconnectIfEnabled = () => {
        if (settings.enabled) {
            ctx.client.disconnect();
            ctx.client.connect();
        }
    };

    $id('st-qq-ws-url').on('change', () => {
        settings.wsUrl = String($id('st-qq-ws-url').val() ?? '').trim();
        saveSettings();
        reconnectIfEnabled();
    });

    $id('st-qq-token').on('change', () => {
        settings.accessToken = String($id('st-qq-token').val() ?? '').trim();
        saveSettings();
        reconnectIfEnabled();
    });

    $id('st-qq-allowed').on('change', () => {
        settings.allowedUserIds = String($id('st-qq-allowed').val() ?? '').trim();
        saveSettings();
    });

    $id('st-qq-default-target').on('change', () => {
        settings.defaultTargetUserId = String($id('st-qq-default-target').val() ?? '').trim();
        saveSettings();
    });

    $id('st-qq-persona-name').on('change', () => {
        settings.usePersonaName = $id('st-qq-persona-name').prop('checked');
        saveSettings();
    });

    $id('st-qq-manual-replies').on('change', () => {
        settings.sendManualReplies = $id('st-qq-manual-replies').prop('checked');
        saveSettings();
    });

    $id('st-qq-strip-thinking').on('change', () => {
        settings.stripThinking = $id('st-qq-strip-thinking').prop('checked');
        saveSettings();
    });

    $id('st-qq-strip-markdown').on('change', () => {
        settings.stripMarkdown = $id('st-qq-strip-markdown').prop('checked');
        saveSettings();
    });

    $id('st-qq-dialogue-only').on('change', () => {
        settings.dialogueOnly = $id('st-qq-dialogue-only').prop('checked');
        saveSettings();
    });

    $id('st-qq-max-chars').on('change', () => {
        const value = Math.min(5000, Math.max(200, Number($id('st-qq-max-chars').val()) || 3000));
        settings.maxCharsPerMessage = value;
        $id('st-qq-max-chars').val(value);
        saveSettings();
    });

    // ---- 状态 ----
    const statusElement = $id('st-qq-status');
    const statusMap = {
        idle: ['未连接', 'st-qq-state-idle'],
        connecting: ['连接中…', 'st-qq-state-pending'],
        connected: ['已连接', 'st-qq-state-ok'],
        reconnecting: ['重连中…', 'st-qq-state-pending'],
        closed: ['已断开', 'st-qq-state-bad'],
        error: ['连接错误', 'st-qq-state-bad'],
    };

    const renderStatus = status => {
        const [defaultText, className] = statusMap[status.state] || ['未知状态', 'st-qq-state-idle'];
        let text = defaultText;
        if (status.state === 'connected' && status.nickname) {
            text = `已连接：${status.nickname} (${status.selfId})`;
        } else if (status.detail) {
            text = `${defaultText}：${status.detail}`;
        }

        statusElement
            .text(text)
            .removeClass('st-qq-state-idle st-qq-state-pending st-qq-state-ok st-qq-state-bad')
            .addClass(className);
    };

    ctx.client.addEventListener('status', event => renderStatus(event.detail));
    renderStatus(ctx.client.status);

    // ---- 当前聊天 ----
    const updateCurrentChat = () => {
        const character = characters?.[this_chid];
        const chatId = getCurrentChatId();
        $id('st-qq-current-chat').text(
            character
                ? `${character.name}${chatId ? ` / ${chatId}` : ''}`
                : '未打开角色卡',
        );
    };

    updateCurrentChat();
    setInterval(updateCurrentChat, 1500);

    // ---- 日志 ----
    const logsElement = $id('st-qq-logs');

    const appendLog = entry => {
        const line = document.createElement('div');
        line.className = `st-qq-log st-qq-log-${entry.level}`;

        const time = new Date(entry.time).toLocaleTimeString();
        const prefix = entry.level === 'in' ? 'IN' : entry.level === 'out' ? 'OUT' : entry.level.toUpperCase();
        line.textContent = `[${time}] [${prefix}] ${entry.message}${entry.detail ? ` | ${entry.detail}` : ''}`;

        logsElement.append(line);
        while (logsElement.childElementCount > 100) {
            logsElement.firstElementChild?.remove();
        }
        logsElement.scrollTop = logsElement.scrollHeight;
    };

    getLogs().forEach(appendLog);
    subscribe(appendLog);

    // ---- 按钮 ----
    $id('st-qq-test').on('click', async () => {
        try {
            const info = await ctx.client.testConnection();
            toastr.success(`已连接：${info?.nickname ?? ''} (${info?.user_id ?? ''})`);
            log('info', `测试连接成功：${info?.nickname ?? ''} (${info?.user_id ?? ''})`);
        } catch (error) {
            toastr.error(error?.message || String(error));
            log('error', '测试连接失败', error?.message || error);
        }
    });

    $id('st-qq-send-test').on('click', async () => {
        const target = String(settings.defaultTargetUserId || '').trim();
        if (!target) {
            toastr.warning('请先填写默认接收 QQ');
            return;
        }

        try {
            await ctx.client.sendPrivateMsg(target, '这是一条来自 SillyTavern 的测试消息。');
            toastr.success('测试消息已发送');
            log('out', `→ QQ ${target}`, '测试消息');
        } catch (error) {
            toastr.error(error?.message || String(error));
            log('error', '发送测试消息失败', error?.message || error);
        }
    });

    $id('st-qq-clear-logs').on('click', () => {
        clearLogs();
        logsElement.empty();
    });
}
