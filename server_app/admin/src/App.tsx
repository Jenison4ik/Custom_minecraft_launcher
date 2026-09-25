import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { BuildsPage } from "@/pages/BuildsPage";
import { FilesPage } from "@/pages/FilesPage";
import { LauncherPage } from "@/pages/LauncherPage";
import { LoginPage } from "@/pages/LoginPage";
import { useAuth } from "@/store/auth";

function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAuth((state) => state.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/files" element={<FilesPage />} />
        <Route path="/pack" element={<Navigate to="/files" replace />} />
        <Route path="/launcher" element={<LauncherPage />} />
        <Route path="/builds" element={<BuildsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/files" replace />} />
    </Routes>
  );
}
