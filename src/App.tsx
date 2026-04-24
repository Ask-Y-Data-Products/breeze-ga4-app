import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Executive from './pages/Executive';
import Segments from './pages/Segments';
import Experiments from './pages/Experiments';
import PaidMedia from './pages/PaidMedia';
import Funnel from './pages/Funnel';
import Explore from './pages/Explore';
import Learn from './pages/Learn';
import DataQuality from './pages/DataQuality';
import Management from './pages/Management';
import ManagementComparison from './pages/ManagementComparison';
import Settings from './pages/Settings';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Executive />} />
        <Route path="segments" element={<Segments />} />
        <Route path="experiments" element={<Experiments />} />
        <Route path="paid-media" element={<PaidMedia />} />
        <Route path="funnel" element={<Funnel />} />
        <Route path="explore" element={<Explore />} />
        {/* Management is a layout with tabs — sub-routes render inside its <Outlet /> */}
        <Route path="management" element={<Management />}>
          <Route index element={<ManagementComparison />} />
          <Route path="learn" element={<Learn />} />
          <Route path="data-quality" element={<DataQuality />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        {/* Legacy top-level routes still work — keep for bookmarks */}
        <Route path="learn" element={<Learn />} />
        <Route path="data-quality" element={<DataQuality />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
