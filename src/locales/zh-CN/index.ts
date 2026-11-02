import type { Messages } from '../en-US';
import common from './common';
import nav from './nav';

/** Compile-time guarantee that zh-CN mirrors the en-US namespace shape exactly. */
const zhCN: Messages = { common, nav };

export default zhCN;
