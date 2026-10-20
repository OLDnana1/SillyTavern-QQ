const THINKING_TAGS = ['thinking', 'thought', 'reasoning', 'think', 'analysis'];
const entityDecoder = document.createElement('textarea');

/**
 * 把 OneBot 消息段转成纯文本。
 *
 * MVP 只关心文字；图片、表情、语音、回复引用直接忽略。
 * @param {unknown} message
 * @param {string|number} selfId 机器人 QQ 号，用于识别 @ 自己
 * @returns {string}
 */
export function segmentsToText(message, selfId) {
    if (typeof message === 'string') {
        // messageFormat 为 string 时可能带 CQ 码，直接剥掉
        return message.replace(/\[CQ:[^\]]+\]/g, '').trim();
    }

    if (!Array.isArray(message)) {
        return '';
    }

    let text = '';
    for (const segment of message) {
        if (!segment || typeof segment !== 'object') {
            continue;
        }

        const data = segment.data ?? {};
        switch (segment.type) {
            case 'text':
                text += String(data.text ?? '');
                break;
            case 'at': {
                const qq = String(data.qq ?? '');
                if (qq && qq !== String(selfId) && qq !== 'all') {
                    text += `@${data.name || qq} `;
                }
                break;
            }
            default:
                // image / face / mface / reply / record / video / file / json 等一律忽略
                break;
        }
    }

    return text.trim();
}

/**
 * 把酒馆回复清洗成适合 QQ 的纯文本。
 *
 * - 去掉思考块（<thinking>、<thought> 等）
 * - 去掉 style / script / HTML 注释 / 其余标签
 * - 解码 HTML 实体
 * - 保留 *动作*、括号旁白和原有换行
 * @param {string} text
 * @param {{ stripThinking?: boolean }} options
 * @returns {string}
 */
export function cleanReplyText(text, { stripThinking = true } = {}) {
    if (!text) {
        return '';
    }

    let result = String(text);

    if (stripThinking) {
        for (const tag of THINKING_TAGS) {
            const block = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi');
            result = result.replace(block, '');
        }
    }

    result = result.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
    result = result.replace(/<!--[\s\S]*?-->/g, '');
    result = result.replace(/<br\s*\/?>/gi, '\n');
    result = result.replace(/<\/(p|div|li|h[1-6])>/gi, '\n');
    result = result.replace(/<[^>]+>/g, '');

    entityDecoder.innerHTML = result;
    result = entityDecoder.value;

    result = result.replace(/\r\n/g, '\n');
    result = result.replace(/[ \t]+\n/g, '\n');
    result = result.replace(/\n{3,}/g, '\n\n');

    return result.trim();
}

/**
 * 超长消息的发送保护。正常情况下整段一条，只有超过阈值才按段落/句子切开。
 * @param {string} text
 * @param {number} maxChars
 * @returns {string[]}
 */
export function splitForQQ(text, maxChars = 3000) {
    const limit = Math.max(200, Number(maxChars) || 3000);
    const source = String(text ?? '').trim();

    if (!source) {
        return [];
    }
    if (source.length <= limit) {
        return [source];
    }

    const chunks = [];
    let rest = source;

    while (rest.length > limit) {
        let cut = rest.lastIndexOf('\n\n', limit);

        if (cut < limit * 0.4) {
            cut = rest.lastIndexOf('\n', limit);
        }
        if (cut < limit * 0.4) {
            cut = Math.max(
                rest.lastIndexOf('。', limit),
                rest.lastIndexOf('！', limit),
                rest.lastIndexOf('？', limit),
                rest.lastIndexOf('. ', limit),
                rest.lastIndexOf('! ', limit),
                rest.lastIndexOf('? ', limit),
            );
        }

        if (cut < limit * 0.4) {
            cut = limit;
        } else {
            cut += 1;
        }

        chunks.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
    }

    if (rest) {
        chunks.push(rest);
    }

    return chunks.filter(Boolean);
}

/**
 * 日志里的短预览。
 * @param {string} text
 * @param {number} limit
 */
export function preview(text, limit = 120) {
    const value = String(text ?? '');
    return value.length > limit ? `${value.slice(0, limit)}…` : value;
}
