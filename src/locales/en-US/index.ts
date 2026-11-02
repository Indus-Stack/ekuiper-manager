import common from './common';
import layout from './layout';
import nav from './nav';
import page from './page';
import rule from './rule';
import stream from './stream';

const enUS = { common, layout, nav, page, rule, stream };

export default enUS;
export type Messages = typeof enUS;
