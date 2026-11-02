import common from './common';
import layout from './layout';
import nav from './nav';

const enUS = { common, layout, nav };

export default enUS;
export type Messages = typeof enUS;
