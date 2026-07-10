import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import { DataRefreshProvider } from "@/context/DataRefreshContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { EntryPage } from "@/pages/EntryPage";
import { ImportPage } from "@/pages/ImportPage";
import { AssetsPage } from "@/pages/AssetsPage";

function EditRedirect() {
  const { id } = useParams();
  return <Navigate to={`/entry?edit=${id}`} replace />;
}

function App() {
  return (
    <AuthProvider>
      <DataRefreshProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="entry" element={<EntryPage />} />
              <Route path="import" element={<ImportPage />} />
              <Route path="assets" element={<AssetsPage />} />
              <Route path="assets/:id/edit" element={<EditRedirect />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster richColors position="top-right" />
        </BrowserRouter>
      </DataRefreshProvider>
    </AuthProvider>
  );
}

export default App;
