import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SiteView } from '../shared/SiteView';
import type { Product, Settings } from '../shared/types';
import '../shared/site.css';

type SiteData = { settings: Settings; products: Product[] };

function App() {
  const [data, setData] = useState<SiteData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/site')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: SiteData) => {
        setData(d);
        document.title = d.settings.title;
      })
      .catch(() => setError(true));
  }, []);

  if (error) return <p className="site-loading">잠시 후 다시 열어주세요 🙏</p>;
  if (!data) return <p className="site-loading">불러오는 중…</p>;
  return <SiteView settings={data.settings} products={data.products} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
