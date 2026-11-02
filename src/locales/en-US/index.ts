import admin from './admin';
import common from './common';
import extension from './extension';
import flow from './flow';
import layout from './layout';
import nav from './nav';
import page from './page';
import rule from './rule';
import stream from './stream';

const enUS = { admin, common, extension, flow, layout, nav, page, rule, stream };

export default enUS;
export type Messages = typeof enUS;
