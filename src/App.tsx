import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './app/AppLayout';
import { TitlePage } from './features/title/TitlePage';
import { NewGamePage } from './features/title/NewGamePage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { SquadPage } from './features/squad/SquadPage';
import { PlayerPage } from './features/players/PlayerPage';
import { TacticsPage } from './features/tactics/TacticsPage';
import { FixturesPage } from './features/fixtures/FixturesPage';
import { StandingsPage } from './features/standings/StandingsPage';
import { MatchPage } from './features/match/MatchPage';
import { SavesPage } from './features/saves/SavesPage';
import { Toasts } from './components/Toasts';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<TitlePage />} />
          <Route path="/new" element={<NewGamePage />} />
          <Route path="/game" element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="squad" element={<SquadPage />} />
            <Route path="player/:id" element={<PlayerPage />} />
            <Route path="tactics" element={<TacticsPage />} />
            <Route path="fixtures" element={<FixturesPage />} />
            <Route path="standings" element={<StandingsPage />} />
            <Route path="match" element={<MatchPage />} />
            <Route path="saves" element={<SavesPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toasts />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
