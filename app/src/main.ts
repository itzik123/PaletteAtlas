import '@fontsource-variable/bricolage-grotesque/standard.css';
import './style.css';
import { SiteHeader } from './site/site-header.ts';
import { Studio } from './studio/studio.ts';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app element');

app.append(new SiteHeader().element, new Studio().element);
