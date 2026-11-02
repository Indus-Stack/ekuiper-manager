import type { Messages } from '../en-US';
import common from './common';
import layout from './layout';
import nav from './nav';
import rule from './rule';
import stream from './stream';

/** Compile-time guarantee that zh-CN mirrors the en-US namespace shape exactly. */
const zhCN: Messages = { common, layout, nav, rule, stream };

export default zhCN;
