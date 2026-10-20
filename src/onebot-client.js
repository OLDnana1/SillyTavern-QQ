import { log } from './logger.js';

const REQUEST_TIMEOUT_MS = 15000;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 面向 SnowLuma 的 OneBot v11 WebSocket 客户端。
 *
 * 浏览器 WebSocket 不能自定义请求头，所以 access token 走
 * `?access_token=` 查询参数，SnowLuma 支持这种鉴权方式。
 */
export class OneBotClient extends EventTarget {
    /**
     * @param {{ getSettings: () => any }} options
     */
    constructor({ getSettings }) {
        super();
        this.getSettings = getSettings;
        this.ws = null;
        this.selfId = '';
        this.loginInfo = null;
        this.state = 'idle';
        this.detail = '';
        this.shouldReconnect = false;
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.pending = new Map();
        this.echoCounter = 0;
    }

    get status() {
        return {
            state: this.state,
            detail: this.detail,
            selfId: this.selfId,
            nickname: this.loginInfo?.nickname ?? '',
        };
    }

    setState(state, detail = '') {
        this.state = state;
        this.detail = detail;
        this.dispatchEvent(new CustomEvent('status', { detail: this.status }));
    }

    buildUrl() {
        let url = String(this.getSettings().wsUrl || '').trim();
        if (!url) {
            throw new Error('未填写 OneBot WebSocket 地址');
        }
        if (!/^wss?:\/\//i.test(url)) {
            url = `ws://${url}`;
        }

        const parsed = new URL(url);
        const token = String(this.getSettings().accessToken || '').trim();
        if (token) {
            parsed.searchParams.set('access_token', token);
        }
        return parsed.toString();
    }

    connect() {
        this.shouldReconnect = true;
        this.clearReconnectTimer();

        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }

        let url;
        try {
            url = this.buildUrl();
        } catch (error) {
            this.setState('error', error.message);
            log('error', error.message);
            return;
        }

        this.setState('connecting');

        let ws;
        try {
            ws = new WebSocket(url);
        } catch (error) {
            this.setState('error', error.message);
            log('error', '创建 WebSocket 失败', error?.message || error);
            this.scheduleReconnect();
            return;
        }

        this.ws = ws;

        ws.addEventListener('open', () => {
            if (this.ws !== ws) {
                return;
            }
            this.reconnectAttempts = 0;
            this.setState('connected');
            log('info', 'OneBot WebSocket 已连接');
            void this.fetchLoginInfo();
        });

        ws.addEventListener('message', event => {
            if (this.ws !== ws) {
                return;
            }
            void this.handleMessage(event.data);
        });

        ws.addEventListener('close', event => {
            if (this.ws !== ws) {
                return;
            }
            this.ws = null;
            this.rejectAllPending(new Error('WebSocket 已断开'));
            this.setState('closed', `连接关闭（code ${event.code}）`);
            log('warn', `OneBot WebSocket 已断开（code ${event.code}）`);
            this.scheduleReconnect();
        });

        ws.addEventListener('error', () => {
            if (this.ws !== ws) {
                return;
            }
            this.setState('error', 'WebSocket 连接错误');
        });
    }

    disconnect() {
        this.shouldReconnect = false;
        this.clearReconnectTimer();

        if (this.ws) {
            const ws = this.ws;
            this.ws = null;
            try {
                ws.close();
            } catch {
                // 忽略关闭阶段的异常
            }
        }

        this.rejectAllPending(new Error('连接已关闭'));
        this.setState('idle');
    }

    scheduleReconnect() {
        if (!this.shouldReconnect || !this.getSettings().enabled || this.reconnectTimer) {
            return;
        }

        const delay = Math.min(30000, 1000 * 2 ** Math.min(this.reconnectAttempts, 5));
        this.reconnectAttempts += 1;
        this.setState('reconnecting', `将在 ${Math.round(delay / 1000)} 秒后重连`);

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (this.shouldReconnect && this.getSettings().enabled) {
                this.connect();
            }
        }, delay);
    }

    clearReconnectTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    async handleMessage(raw) {
        let data;
        try {
            const text = typeof raw === 'string' ? raw : await raw.text();
            data = JSON.parse(text);
        } catch {
            return;
        }

        if (!data || typeof data !== 'object') {
            return;
        }

        // 动作响应：按 echo 匹配
        if (data.echo !== undefined && data.echo !== null) {
            const key = String(data.echo);
            const pending = this.pending.get(key);
            if (pending) {
                this.pending.delete(key);
                clearTimeout(pending.timer);

                if (data.status === 'failed' || (data.retcode !== undefined && data.retcode !== 0)) {
                    pending.reject(new Error(`OneBot 动作失败：${data.retcode} ${data.wording || data.message || ''}`.trim()));
                } else {
                    pending.resolve(data.data ?? null);
                }
                return;
            }
        }

        // 事件推送
        if (data.post_type) {
            this.dispatchEvent(new CustomEvent('event', { detail: data }));
        }
    }

    request(action, params = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return Promise.reject(new Error('OneBot WebSocket 未连接'));
        }

        const echo = `stqq-${Date.now()}-${this.echoCounter++}`;
        const payload = { action, params, echo };

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(echo);
                reject(new Error(`OneBot 动作超时：${action}`));
            }, timeoutMs);

            this.pending.set(echo, { resolve, reject, timer });

            try {
                this.ws.send(JSON.stringify(payload));
            } catch (error) {
                clearTimeout(timer);
                this.pending.delete(echo);
                reject(error);
            }
        });
    }

    rejectAllPending(error) {
        for (const [key, pending] of this.pending) {
            clearTimeout(pending.timer);
            pending.reject(error);
            this.pending.delete(key);
        }
    }

    async fetchLoginInfo() {
        try {
            const info = await this.request('get_login_info');
            this.loginInfo = info || null;
            this.selfId = String(info?.user_id ?? '');
            log('info', `机器人账号：${info?.nickname ?? '未知'} (${this.selfId})`);
            this.dispatchEvent(new CustomEvent('ready', { detail: info }));
            this.setState('connected', `${info?.nickname ?? ''} (${this.selfId})`);
        } catch (error) {
            log('error', '获取机器人账号失败', error?.message || error);
        }
    }

    async sendPrivateMsg(userId, text) {
        return this.request('send_private_msg', {
            user_id: Number(userId),
            message: [{ type: 'text', data: { text: String(text) } }],
        });
    }

    /**
     * 手动测试连接：先连上，再拉一次机器人账号。
     * @param {number} timeoutMs
     */
    async testConnection(timeoutMs = 8000) {
        if (!this.getSettings().enabled) {
            throw new Error('请先勾选“启用桥接”');
        }

        this.connect();
        const started = Date.now();

        while (Date.now() - started < timeoutMs) {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                const info = await this.request('get_login_info');
                this.loginInfo = info || null;
                this.selfId = String(info?.user_id ?? '');
                return info;
            }
            await sleep(200);
        }

        throw new Error('连接超时，请检查 WS 地址、端口和 access token');
    }
}
