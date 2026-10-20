/**
 * 酒馆内部 API 的统一出口。
 *
 * 扩展位于 public/scripts/extensions/third-party/SillyTavern-QQ/，
 * 这里的相对路径在酒馆安装目录中解析，不要随意挪动文件层级。
 */
export {
    Generate,
    isGenerating,
    sendMessageAsUser,
    name1,
    chat,
    characters,
    this_chid,
    eventSource,
    event_types,
    saveSettingsDebounced,
    getCurrentChatId,
} from '../../../../script.js';

export {
    extension_settings,
    renderExtensionTemplateAsync,
} from '../../../extensions.js';
