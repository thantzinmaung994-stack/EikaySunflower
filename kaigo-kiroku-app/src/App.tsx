import { useEffect, useState } from 'react';
import { INFO_PAGES, type InfoPage } from './data/info';
import { scenarioById } from './data/scenarios';
import { t } from './i18n';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, SettingsContext, type Settings } from './lib/settings';
import { clearAll, loadJson, loadLang, loadRecords, saveJson, saveRecords } from './lib/storage';
import { FactQuiz } from './screens/FactQuiz';
import { History } from './screens/History';
import { Home } from './screens/Home';
import { Learn } from './screens/Learn';
import { PracticeList } from './screens/PracticeList';
import { RecordEditor } from './screens/RecordEditor';
import { InfoView, SettingsScreen } from './screens/SettingsScreen';
import { Premium } from './screens/Premium';
import { initPremium, isFreeScenario, previewToggleEnabled } from './lib/premium';
import type { CategoryId, QuizResult, RecordEntry } from './types';
import logoMark from './assets/logo-mark.png';

type Tab = 'home' | 'practice' | 'quiz' | 'history' | 'learn';
type View =
  | { kind: 'tab'; tab: Tab }
  | { kind: 'scenario'; id: string }
  | { kind: 'free'; cat?: CategoryId }
  | { kind: 'settings' }
  | { kind: 'premium' }
  | { kind: 'info'; id: InfoPage['id'] };

const QUIZ_KEY = 'kaigo-kiroku:quizzes';
const PREVIEW_KEY = 'kaigo-kiroku:preview-premium';

export default function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [records, setRecords] = useState<RecordEntry[]>([]);
  const [quizzes, setQuizzes] = useState<QuizResult[]>([]);
  const [view, setView] = useState<View>({ kind: 'tab', tab: 'home' });
  const [loaded, setLoaded] = useState(false);
  const [premium, setPremium] = useState(false);
  const [backTo, setBackTo] = useState<View>({ kind: 'settings' });
  const lang = settings.lang;

  useEffect(() => {
    (async () => {
      const [r, q, s] = await Promise.all([loadRecords(), loadJson<QuizResult[]>(QUIZ_KEY, []), loadLang().then(loadSettings)]);
      setRecords(r);
      setQuizzes(q);
      setSettings(s);
      if (previewToggleEnabled()) setPremium(await loadJson<boolean>(PREVIEW_KEY, false));
      setLoaded(true);
      void initPremium(setPremium);
    })();
  }, []);

  const go = (v: View) => {
    if (v.kind === 'premium' || v.kind === 'info') setBackTo(view.kind === 'premium' || view.kind === 'info' ? backTo : view);
    setView(v);
    window.scrollTo(0, 0);
  };

  const updateSettings = (s: Settings) => {
    setSettings(s);
    void saveSettings(s);
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

  const addQuiz = (q: QuizResult) => {
    setQuizzes((prev) => {
      const next = [q, ...prev].slice(0, 200);
      void saveJson(QUIZ_KEY, next);
      return next;
    });
  };

  const togglePreview = (on: boolean) => {
    setPremium(on);
    void saveJson(PREVIEW_KEY, on);
  };

  const clearData = async () => {
    await clearAll();
    setRecords([]);
    setQuizzes([]);
    // 設定は消さずに残す（言語が急に変わると困るため）
    void saveSettings(settings);
  };

  const activeTab: Tab | null =
    view.kind === 'tab' ? view.tab : view.kind === 'scenario' || view.kind === 'free' ? 'practice' : null;

  const tabs: { id: Tab; ico: string; key: 'tabHome' | 'tabPractice' | 'tabQuiz' | 'tabHistory' | 'tabLearn' }[] = [
    { id: 'home', ico: '🏠', key: 'tabHome' },
    { id: 'practice', ico: '📝', key: 'tabPractice' },
    { id: 'quiz', ico: '⚡', key: 'tabQuiz' },
    { id: 'history', ico: '🗂', key: 'tabHistory' },
    { id: 'learn', ico: '🎓', key: 'tabLearn' },
  ];

  let body: JSX.Element | null = null;
  if (!loaded) body = null;
  else if (view.kind === 'scenario' && !premium && !isFreeScenario({ id: view.id })) {
    body = <Premium lang={lang} premium={premium} onPreviewToggle={togglePreview} onOpenInfo={(id) => go({ kind: 'info', id })} onBack={() => go({ kind: 'tab', tab: 'practice' })} />;
  } else if (view.kind === 'scenario') {
    body = <RecordEditor key={view.id} lang={lang} scenario={scenarioById(view.id)} onSave={upsert} onExit={() => go({ kind: 'tab', tab: 'history' })} />;
  } else if (view.kind === 'free') {
    body = <RecordEditor key={`free-${view.cat ?? ''}`} lang={lang} initialCategory={view.cat} onSave={upsert} onExit={() => go({ kind: 'tab', tab: 'history' })} />;
  } else if (view.kind === 'settings') {
    body = <SettingsScreen settings={settings} onChange={updateSettings} onOpenInfo={(id) => go({ kind: 'info', id })} onClearData={clearData} premium={premium} onOpenPremium={() => go({ kind: 'premium' })} />;
  } else if (view.kind === 'premium') {
    body = <Premium lang={lang} premium={premium} onPreviewToggle={togglePreview} onOpenInfo={(id) => go({ kind: 'info', id })} onBack={() => go(backTo)} />;
  } else if (view.kind === 'info') {
    const page = INFO_PAGES.find((p) => p.id === view.id)!;
    body = <InfoView page={page} onBack={() => go(backTo)} backLabel={t(lang, 'back')} />;
  } else if (view.tab === 'home') {
    body = (
      <Home
        lang={lang}
        records={records}
        quizzes={quizzes}
        dailyGoal={settings.dailyGoal}
        premium={premium}
        onScenario={(id) => go({ kind: 'scenario', id })}
        onQuiz={() => go({ kind: 'tab', tab: 'quiz' })}
        onFree={(cat) => go({ kind: 'free', cat })}
        onPractice={() => go({ kind: 'tab', tab: 'practice' })}
      />
    );
  } else if (view.tab === 'practice') {
    body = <PracticeList lang={lang} records={records} onSelect={(id) => go({ kind: 'scenario', id })} onFree={() => go({ kind: 'free' })} premium={premium} onLocked={() => go({ kind: 'premium' })} />;
  } else if (view.tab === 'quiz') {
    body = <FactQuiz lang={lang} quizzes={quizzes} onFinish={addQuiz} premium={premium} onLocked={() => go({ kind: 'premium' })} />;
  } else if (view.tab === 'history') {
    body = <History lang={lang} records={records} onDelete={remove} />;
  } else {
    body = <Learn lang={lang} premium={premium} onLocked={() => go({ kind: 'premium' })} />;
  }

  return (
    <SettingsContext.Provider value={settings}>
      <div className="app">
        <header className="header">
          <button className="title" onClick={() => go({ kind: 'tab', tab: 'home' })}>
            <img className="logo" src={logoMark} alt="EikaySunflower" />
            <span>{t(lang, 'appName')}</span>
          </button>
          <div className="header-actions">
            <button className="lang-toggle" onClick={() => updateSettings({ ...settings, lang: lang === 'ja' ? 'my' : 'ja' })} aria-label={t(lang, 'language')}>
              {lang === 'ja' ? 'မြန်မာ' : '日本語'}
            </button>
            <button className={`icon-btn${view.kind === 'settings' || view.kind === 'info' || view.kind === 'premium' ? ' on' : ''}`} onClick={() => go({ kind: 'settings' })} aria-label={t(lang, 'settings')}>
              ⚙️
            </button>
          </div>
        </header>
        <main className="main">{body}</main>
        <nav className="tabbar">
          {tabs.map((tb) => (
            <button key={tb.id} className={activeTab === tb.id ? 'active' : ''} onClick={() => go({ kind: 'tab', tab: tb.id })}>
              <span className="ico">{tb.ico}</span>
              {t(lang, tb.key)}
            </button>
          ))}
        </nav>
      </div>
    </SettingsContext.Provider>
  );
}
