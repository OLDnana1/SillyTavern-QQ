import { getSettings } from './src/config.js';
import { createGenerationQueue } from './src/generation-queue.js';
import { createInbound } from './src/inbound.js';
import { log } from './src/logger.js';
import { OneBotClient } from './src/onebot-client.js';
import { createOutbound } from './src/outbound.js';
import { initUi } from './src/ui.js';

const ctx = {
    settings: null,
    client: null,
    queue: null,
    lastInboundUserId: null,
    qqTriggeredGeneration: false,
};

jQuery(async () => {
    try {
        ctx.settings = getSettings();
        ctx.client = new OneBotClient({ getSettings: () => ctx.settings });
        ctx.queue = createGenerationQueue(ctx);

        createInbound({ ctx, client: ctx.client, queue: ctx.queue });
        createOutbound({ ctx, client: ctx.client });

        await initUi(ctx);

        if (ctx.settings.enabled && ctx.settings.autoConnect) {
            ctx.client.connect();
        }

        log('info', 'QQ Bridge 扩展已加载');
    } catch (error) {
        console.error('[ST-QQ] 扩展初始化失败', error);
    }
});
