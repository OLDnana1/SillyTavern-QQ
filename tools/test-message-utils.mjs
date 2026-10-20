/**
 * 消息清洗与引号提取的本地测试。
 * 用法：node tools/test-message-utils.mjs
 */

// message-utils.js 在模块顶层创建 textarea 用于解码实体，这里用最小 mock 顶替。
globalThis.document = {
    createElement: () => {
        let html = '';
        return {
            set innerHTML(value) {
                html = value;
            },
            get value() {
                return html;
            },
        };
    },
};

const { cleanReplyText, extractQuotedSegments, splitForQQ } = await import('../src/message-utils.js');

const sample = `**开场白：**

她转过身，*轻轻*晃了一下。

「你来了啊。太好了……我还以为只剩下我一个人了呢。」

「有没有受伤？被咬到了吗？」

> 这是一段旁白引用
- 列表项一
- 列表项二

\`inline code\` 和 [链接文字](https://example.com)。`;

const cleaned = cleanReplyText(sample);
console.log('--- 清洗后 ---');
console.log(cleaned);
console.log('--- 引号对话 ---');
console.log(extractQuotedSegments(cleaned));
console.log('--- 超长切分（limit=40）---');
console.log(splitForQQ(cleaned, 40));
