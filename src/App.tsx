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
import { TransfersPage } from './features/transfers/TransfersPage';
import { FinancePage } from './features/finance/FinancePage';
import { FacilitiesPage } from './features/club/FacilitiesPage';
import { TrainingPage } from './features/training/TrainingPage';
import { ImportPage } from './features/import/ImportPage';
import { LocalImagesPage } from './features/images/LocalImagesPage';
import { Toasts } from './components/Toasts';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<TitlePage />} />
          <Route path="/new" element={<NewGamePage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/images" element={<LocalImagesPage />} />
          <Route path="/game" element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="squad" element={<SquadPage />} />
            <Route path="player/:id" element={<PlayerPage />} />
            <Route path="tactics" element={<TacticsPage />} />
            <Route path="fixtures" element={<FixturesPage />} />
            <Route path="standings" element={<StandingsPage />} />
            <Route path="match" element={<MatchPage />} />
            <Route path="transfers" element={<TransfersPage />} />
            <Route path="finance" element={<FinancePage />} />
            <Route path="club" element={<FacilitiesPage />} />
            <Route path="training" element={<TrainingPage />} />
            <Route path="saves" element={<SavesPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toasts />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
