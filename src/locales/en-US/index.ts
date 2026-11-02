import common from './common';
import layout from './layout';
import nav from './nav';
import stream from './stream';

const enUS = { common, layout, nav, stream };

export default enUS;
export type Messages = typeof enUS;
