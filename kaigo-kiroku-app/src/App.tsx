import { useEffect, useState } from 'react';
import { scenarioById } from './data/scenarios';
import { t } from './i18n';
import { loadLang, loadRecords, saveLang, saveRecords } from './lib/storage';
import { History } from './screens/History';
import { Home } from './screens/Home';
import { Learn } from './screens/Learn';
import { PracticeList } from './screens/PracticeList';
import { RecordEditor } from './screens/RecordEditor';
import type { CategoryId, Lang, RecordEntry } from './types';

type Tab = 'home' | 'practice' | 'free' | 'history' | 'learn';
type View = { kind: 'tab'; tab: Tab } | { kind: 'scenario'; id: string } | { kind: 'free'; cat?: CategoryId };

export default function App() {
  const [lang, setLang] = useState<Lang>('ja');
  const [records, setRecords] = useState<RecordEntry[]>([]);
  const [view, setView] = useState<View>({ kind: 'tab', tab: 'home' });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([loadRecords(), loadLang()]).then(([r, l]) => {
      setRecords(r);
      setLang(l);
      setLoaded(true);
    });
  }, []);

  const toggleLang = () => {
    const next: Lang = lang === 'ja' ? 'my' : 'ja';
    setLang(next);
    void saveLang(next);
  };

  const upsert = (entry: RecordEntry) => {
    setRecords((prev) => {
      const next = [entry, ...prev.filter((r) => r.id !== entry.id)];
      void saveRecords(next);
      return next;
    });
  };

  const remove = (id: string) => {
    setRecords((prev) => {
      const next = prev.filter((r) => r.id !== id);
      void saveRecords(next);
      return next;
    });
  };

  const goTab = (tab: Tab) => {
    if (tab === 'free') setView({ kind: 'free' });
    else setView({ kind: 'tab', tab });
    window.scrollTo(0, 0);
  };

  const activeTab: Tab = view.kind === 'tab' ? view.tab : view.kind === 'scenario' ? 'practice' : 'free';

  const tabs: { id: Tab; ico: string; key: 'tabHome' | 'tabPractice' | 'tabFree' | 'tabHistory' | 'tabLearn' }[] = [
    { id: 'home', ico: '🏠', key: 'tabHome' },
    { id: 'practice', ico: '📖', key: 'tabPractice' },
    { id: 'free', ico: '✏️', key: 'tabFree' },
    { id: 'history', ico: '🗂', key: 'tabHistory' },
    { id: 'learn', ico: '🎓', key: 'tabLearn' },
  ];

  let body: JSX.Element | null = null;
  if (!loaded) body = null;
  else if (view.kind === 'scenario') {
    const sc = scenarioById(view.id);
    body = (
      <RecordEditor key={view.id} lang={lang} scenario={sc} onSave={upsert} onExit={() => goTab('history')} />
    );
  } else if (view.kind === 'free') {
    body = (
      <RecordEditor key={`free-${view.cat ?? ''}`} lang={lang} initialCategory={view.cat} onSave={upsert} onExit={() => goTab('history')} />
    );
  } else if (view.tab === 'home') {
    body = <Home lang={lang} records={records} onPractice={() => goTab('practice')} onFree={(cat) => setView({ kind: 'free', cat })} />;
  } else if (view.tab === 'practice') {
    body = <PracticeList lang={lang} records={records} onSelect={(id) => { setView({ kind: 'scenario', id }); window.scrollTo(0, 0); }} />;
  } else if (view.tab === 'history') {
    body = <History lang={lang} records={records} onDelete={remove} />;
  } else {
    body = <Learn lang={lang} />;
  }

  return (
    <div className="app">
      <header className="header">
        <div className="title">
          <span className="sun">🌻</span>
          <span>{t(lang, 'appName')}</span>
        </div>
        <button className="lang-toggle" onClick={toggleLang} aria-label={t(lang, 'language')}>
          {lang === 'ja' ? 'မြန်မာ' : '日本語'}
        </button>
      </header>
      <main className="main">{body}</main>
      <nav className="tabbar">
        {tabs.map((tb) => (
          <button key={tb.id} className={activeTab === tb.id ? 'active' : ''} onClick={() => goTab(tb.id)}>
            <span className="ico">{tb.ico}</span>
            {t(lang, tb.key)}
          </button>
        ))}
      </nav>
    </div>
  );
}
