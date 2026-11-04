/** 译名依据 docs/GLOSSARY.md。侧边栏分组与导航项。 */
import type en from '../en-US/nav';

const nav: Record<keyof typeof en, string> = {
  // 分组
  groupsWorkspace: '工作台',
  groupsData: '数据',
  groupsRules: '规则',
  groupsResources: '资源',
  groupsExtensions: '扩展',
  groupsOperations: '运维',
  groupsManager: '管理',

  // 导航项
  overview: '概览',
  streams: '流',
  tables: '表',
  flows: '流程',
  rules: '规则',
  designer: '设计器',
  connections: '连接',
  schemas: '模式',
  files: '文件',
  plugins: '插件',
  functions: '函数',
  services: '外部服务',
  dataImport: '导入',
  dataExport: '导出',
  nodes: '节点',
  users: '用户',
  settings: '设置',

  // 页面标题
  connectionsFull: '连接与连接器',
  dataImportFull: '数据导入',
  dataExportFull: '数据导出',
  filesFull: '文件上传',
  createSchema: '创建模式',
  registerService: '注册外部服务',
  installPlugin: '安装插件',
  system: '系统',
  help: '文档与帮助',
  apiDocs: 'API 文档',

  // 侧边栏
  expandNavigation: '展开导航',
  collapseNavigation: '收起导航',
  primaryNavigation: '主导航',
  toggleMenu: '切换菜单',
};

export default nav;
