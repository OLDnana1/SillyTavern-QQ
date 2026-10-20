import {
    Generate,
    isGenerating,
    sendMessageAsUser,
    name1,
    characters,
    this_chid,
} from '../st-api.js';
import { log } from './logger.js';

const MAX_QUEUE_SIZE = 10;
const IDLE_POLL_MS = 200;
const DEFAULT_IDLE_TIMEOUT_MS = 300000;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * QQ 消息进入酒馆的唯一通道。
 *
 * 所有消息串行处理：先等酒馆当前生成结束，再写入用户消息并触发一次生成。
 * 这样不会打断酒馆自己的流式输出，也不会和手动生成抢锁。
 *
 * @param {{ settings: any, lastInboundUserId: string|null, qqTriggeredGeneration: boolean }} ctx
 */
export function createGenerationQueue(ctx) {
    const queue = [];
    let running = false;

    function enqueue(job) {
        if (queue.length >= MAX_QUEUE_SIZE) {
            log('warn', 'QQ 消息队列已满，丢弃最新一条', job.text);
            return false;
        }

        queue.push(job);
        void pump();
        return true;
    }

    async function pump() {
        if (running) {
            return;
        }

        running = true;
        try {
            while (queue.length > 0) {
                const job = queue.shift();
                try {
                    await waitUntilIdle();
                    await runJob(job);
                } catch (error) {
                    log('error', `处理 QQ 消息失败（${job.userId}）`, error?.message || error);
                }
            }
        } finally {
            running = false;
        }
    }

    async function waitUntilIdle() {
        const started = Date.now();
        const timeout = Number(ctx.settings.generationTimeoutMs) || DEFAULT_IDLE_TIMEOUT_MS;

        while (isGenerating()) {
            if (Date.now() - started > timeout) {
                throw new Error('等待酒馆生成结束超时');
            }
            await sleep(IDLE_POLL_MS);
        }
    }

    async function runJob(job) {
        if (this_chid === null || this_chid === undefined || !characters?.[this_chid]) {
            throw new Error('酒馆当前没有打开角色卡');
        }

        // 清空输入框，避免 Generate 把残留内容当成用户输入或 slash 命令
        const textarea = document.querySelector('#send_textarea');
        if (textarea) {
            textarea.value = '';
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }

        ctx.lastInboundUserId = job.userId;

        const name = ctx.settings.usePersonaName ? name1 : (job.nickname || name1);
        await sendMessageAsUser(job.text, '', null, false, name);
        log('in', `写入酒馆：${job.nickname}(${job.userId})`, job.text);

        // automatic_trigger 让 Generate 跳过 send_if_empty 等“空输入补充”逻辑，
        // 否则会在 QQ 消息后面再插入一条多余的用户消息。
        ctx.qqTriggeredGeneration = true;
        try {
            await Generate('normal', { automatic_trigger: true });
        } finally {
            ctx.qqTriggeredGeneration = false;
        }
    }

    return { enqueue };
}
