import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import { DataRefreshProvider } from "@/context/DataRefreshContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RequireAdmin } from "@/components/RequireAdmin";
import { AppShell } from "@/components/layout/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { EntryPage } from "@/pages/EntryPage";
import { ImportPage } from "@/pages/ImportPage";
import { AssetsPage } from "@/pages/AssetsPage";
import { SettingsHubPage } from "@/pages/SettingsHubPage";
import { AccountSettingsPage } from "@/pages/settings/AccountSettingsPage";
import { AppearanceSettingsPage } from "@/pages/settings/AppearanceSettingsPage";
import { UsersSettingsPage } from "@/pages/settings/UsersSettingsPage";
import { EditCategoryFieldsPage } from "@/pages/settings/EditCategoryFieldsPage";

function EditRedirect() {
  const { id } = useParams();
  return <Navigate to={`/entry?edit=${id}`} replace />;
}

function App() {
  return (
    <ThemeProvider>
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
                <Route path="settings" element={<SettingsHubPage />}>
                  <Route index element={<Navigate to="account" replace />} />
                  <Route path="account" element={<AccountSettingsPage />} />
                  <Route path="appearance" element={<AppearanceSettingsPage />} />
                  <Route
                    path="users"
                    element={
                      <RequireAdmin>
                        <UsersSettingsPage />
                      </RequireAdmin>
                    }
                  />
                  <Route
                    path="edit-category-fields"
                    element={
                      <RequireAdmin>
                        <EditCategoryFieldsPage />
                      </RequireAdmin>
                    }
                  />
                </Route>
                <Route path="assets/:id/edit" element={<EditRedirect />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Toaster richColors position="top-right" />
          </BrowserRouter>
        </DataRefreshProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
