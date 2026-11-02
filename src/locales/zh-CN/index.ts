import type { Messages } from '../en-US';
import admin from './admin';
import common from './common';
import connector from './connector';
import extension from './extension';
import flow from './flow';
import layout from './layout';
import nav from './nav';
import page from './page';
import rule from './rule';
import stream from './stream';

/** Compile-time guarantee that zh-CN mirrors the en-US namespace shape exactly. */
const zhCN: Messages = { admin, common, connector, extension, flow, layout, nav, page, rule, stream };

export default zhCN;
