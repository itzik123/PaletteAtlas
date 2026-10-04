import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app element');

app.innerHTML = `
  <h1>Palette Atlas</h1>
  <p>Turn any image into a color strip. Coming soon.</p>
`;
