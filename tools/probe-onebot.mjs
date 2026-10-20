/**
 * 联调小工具：读取 SnowLuma 的 OneBot 配置，连接 WebSocket 并调用 get_login_info。
 * 只做只读探测，不发送任何 QQ 消息，也不会打印 access token。
 *
 * 用法：
 *   node tools/probe-onebot.mjs "D:\SnowLuma-v2.0.3-win-x64\config\onebot_<uin>.json"
 */
import fs from 'node:fs';

const configPath = process.argv[2];
if (!configPath) {
    console.error('用法：node tools/probe-onebot.mjs <onebot_<uin>.json 路径>');
    process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const server = config?.networks?.wsServers?.[0];
if (!server) {
    console.error('配置里没有 networks.wsServers[0]');
    process.exit(1);
}
if (server.enabled === false) {
    console.error('wsServers[0] 是禁用状态');
    process.exit(1);
}

const params = new URLSearchParams();
if (server.accessToken) {
    params.set('access_token', server.accessToken);
}
const query = params.toString();
const url = `ws://${server.host || '127.0.0.1'}:${server.port || 3001}${server.path || '/'}${query ? `?${query}` : ''}`;

console.log(`连接 ${server.host || '127.0.0.1'}:${server.port || 3001}${server.path || '/'}（token ${server.accessToken ? '已配置' : '未配置'}）`);

const socket = new WebSocket(url);
const timeout = setTimeout(() => {
    console.error('连接或响应超时');
    socket.close();
    process.exit(1);
}, 10000);

socket.addEventListener('open', () => {
    console.log('WebSocket 已连接');
    socket.send(JSON.stringify({ action: 'get_login_info', params: {}, echo: 'probe-1' }));
});

socket.addEventListener('message', event => {
    let data;
    try {
        data = JSON.parse(typeof event.data === 'string' ? event.data : '');
    } catch {
        return;
    }

    if (data.echo === 'probe-1') {
        clearTimeout(timeout);
        if (data.status === 'ok' && data.retcode === 0) {
            console.log(`机器人账号：${data.data?.nickname ?? '未知'} (${data.data?.user_id ?? '未知'})`);
            process.exitCode = 0;
        } else {
            console.error('get_login_info 失败：', JSON.stringify(data));
            process.exitCode = 1;
        }
        socket.close();
    }
});

socket.addEventListener('error', () => {
    clearTimeout(timeout);
    console.error('WebSocket 连接错误');
    process.exit(1);
});

socket.addEventListener('close', () => {
    clearTimeout(timeout);
});
