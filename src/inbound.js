import { parseIdList } from './config.js';
import { segmentsToText } from './message-utils.js';
import { log } from './logger.js';

const SEEN_LIMIT = 200;

/**
 * QQ 私聊 -> 酒馆。
 *
 * 只接受私聊消息；群聊留到后续版本。
 * @param {{ ctx: any, client: any, queue: { enqueue: (job: any) => boolean } }} options
 */
export function createInbound({ ctx, client, queue }) {
    const seen = new Set();
    const seenOrder = [];

    function isDuplicate(messageId, userId) {
        if (messageId === undefined || messageId === null) {
            return false;
        }

        const key = `${messageId}:${userId}`;
        if (seen.has(key)) {
            return true;
        }

        seen.add(key);
        seenOrder.push(key);
        if (seenOrder.length > SEEN_LIMIT) {
            seen.delete(seenOrder.shift());
        }

        return false;
    }

    function handleEvent(event) {
        if (!ctx.settings.enabled) {
            return;
        }
        if (event.post_type !== 'message' || event.message_type !== 'private') {
            return;
        }

        const selfId = String(client.selfId || event.self_id || '');
        const userId = String(event.user_id ?? '');
        if (!userId || userId === selfId) {
            return;
        }

        const allowed = parseIdList(ctx.settings.allowedUserIds);
        if (allowed.length > 0) {
            if (!allowed.includes(userId)) {
                log('warn', `忽略未授权 QQ ${userId}`);
                return;
            }
        } else {
            // 白名单为空时，如果配置了默认接收 QQ，就只接受这个人的私聊。
            const defaultTarget = String(ctx.settings.defaultTargetUserId || '').trim();
            if (defaultTarget && defaultTarget !== userId) {
                log('warn', `未配置白名单，忽略非默认接收人 ${userId}`);
                return;
            }
        }

        if (isDuplicate(event.message_id, userId)) {
            return;
        }

        const text = segmentsToText(event.message, selfId);
        if (!text) {
            log('info', `忽略空消息（${userId}）`);
            return;
        }

        const nickname = event.sender?.card || event.sender?.nickname || userId;
        log('in', `QQ ${nickname}(${userId})`, text);
        queue.enqueue({ userId, nickname, text, messageId: event.message_id });
    }

    client.addEventListener('event', event => {
        try {
            handleEvent(event.detail);
        } catch (error) {
            log('error', '入站处理失败', error?.message || error);
        }
    });
}
