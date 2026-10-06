import '@fontsource-variable/bricolage-grotesque/standard.css';
import '../style.css';
import '../atlas/atlas.css';
import './mockups.css';
import { SiteHeader } from '../site/site-header.ts';
import { BarcodeMockups } from './barcode-mockups.ts';

// A dev-only page (pnpm dev, then /mockups.html): designs to choose between before the site gets them.

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app element');
const mockups = new BarcodeMockups();
app.append(new SiteHeader('atlas').element, mockups.element);
void mockups.load();
