/** 译名依据 docs/GLOSSARY.md。全局框架与共享组件。 */
import type en from '../en-US/layout';

const layout: Record<keyof typeof en, string> = {
  // 顶栏 / 账户
  accountMenu: '账户菜单',
  owner: '所有者',
  user: '用户',
  signOut: '退出登录',
  selectNodeButton: '选择 eKuiper 节点',
  selectNode: '选择节点',
  versionNotDetected: '未检测到版本',

  // AI 助手
  openAssistant: '打开 AI 助手',
  assistantTitle: '运维助手',
  assistantNotConfigured: 'AI 助手未配置',
  assistantPlaceholder: '询问当前页面或运行中的服务栈…',
  assistantDisabledPlaceholder: 'AI 助手未配置',
  suggestedQuestions: '推荐追问',
  continueWith: '继续提问',
  sendMessage: '发送消息',

  // 共享状态
  somethingWentWrong: '出现错误',
  loadErrorDescription: '加载数据时出错，请重试。',
  retry: '重试',
  loading: '加载中…',
  loadingData: '正在加载数据…',

  // 状态
  statusSuccess: '成功',
  statusRunning: '运行中',
  statusError: '错误',
  statusStopped: '已停止',
  statusWarning: '警告',
  statusPending: '等待中',
  statusInfo: '提示',

  // 表格
  searchPlaceholder: '搜索…',
  noResults: '未找到结果',
  refreshTable: '刷新表格',
  firstPage: '第一页',
  previousPage: '上一页',
  nextPage: '下一页',
  lastPage: '最后一页',

  // 命令面板
  commandPlaceholder: '输入命令或搜索…',
  loadingNodeResources: '正在加载节点资源…',
  suggestions: '建议',
  importConfiguration: '导入配置',
};

export default layout;
