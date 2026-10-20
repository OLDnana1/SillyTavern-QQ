import { chat, eventSource, event_types } from '../st-api.js';
import { cleanReplyText, extractQuotedSegments, splitForQQ, preview } from './message-utils.js';
import { log } from './logger.js';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 酒馆 -> QQ 私聊。
 *
 * 只监听 AI 回复写入事件（MESSAGE_RECEIVED），不监听 MESSAGE_SENT，
 * 所以 QQ 消息写入酒馆时不会回声到 QQ。
 *
 * @param {{ ctx: any, client: any }} options
 */
export function createOutbound({ ctx, client }) {
    async function sendReply(snapshot, qqTriggered) {
        if (!ctx.settings.enabled) {
            return;
        }
        if (!ctx.settings.sendManualReplies && !qqTriggered) {
            return;
        }
        if (!snapshot || snapshot.isUser || snapshot.isSystem) {
            return;
        }

        const text = cleanReplyText(snapshot.mes, {
            stripThinking: ctx.settings.stripThinking,
            stripMarkdown: ctx.settings.stripMarkdown,
        });
        if (!text) {
            log('warn', '回复清洗后为空，跳过发送');
            return;
        }

        const target = String(ctx.settings.defaultTargetUserId || ctx.lastInboundUserId || '').trim();
        if (!target) {
            log('warn', '没有可用的 QQ 接收人，请在设置里填写默认接收 QQ');
            return;
        }

        let chunks;
        if (ctx.settings.dialogueOnly) {
            const dialogues = extractQuotedSegments(text);
            if (dialogues.length > 0) {
                log('info', `提取到 ${dialogues.length} 段引号对话`);
                chunks = dialogues.flatMap(segment => splitForQQ(segment, ctx.settings.maxCharsPerMessage));
            } else {
                log('warn', '未找到引号对话，回退为整段发送');
                chunks = splitForQQ(text, ctx.settings.maxCharsPerMessage);
            }
        } else {
            chunks = splitForQQ(text, ctx.settings.maxCharsPerMessage);
        }
        for (let index = 0; index < chunks.length; index += 1) {
            try {
                await client.sendPrivateMsg(target, chunks[index]);
                log('out', `→ QQ ${target}`, preview(chunks[index]));
            } catch (error) {
                log('error', `发送到 QQ ${target} 失败`, error?.message || error);
                return;
            }

            if (index < chunks.length - 1) {
                await sleep(400);
            }
        }
    }

    eventSource.on(event_types.MESSAGE_RECEIVED, (messageId, type) => {
        if (type !== 'normal') {
            return;
        }

        // 事件触发时同步取快照，异步发送期间酒馆可能已经改动 chat。
        const message = chat[messageId];
        const snapshot = message
            ? { mes: message.mes, isUser: message.is_user, isSystem: message.is_system }
            : null;
        const qqTriggered = ctx.qqTriggeredGeneration;

        void sendReply(snapshot, qqTriggered).catch(error => {
            log('error', '出站处理失败', error?.message || error);
        });
    });
}
