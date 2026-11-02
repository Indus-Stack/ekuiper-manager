import type { Messages } from '../en-US';
import common from './common';
import layout from './layout';
import nav from './nav';

/** Compile-time guarantee that zh-CN mirrors the en-US namespace shape exactly. */
const zhCN: Messages = { common, layout, nav };

export default zhCN;
