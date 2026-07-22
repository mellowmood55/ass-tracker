import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

function PasswordField({ id, label, value, onChange, autoComplete, show, onToggleShow }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
          onClick={onToggleShow}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export function AccountSettingsPage() {
  const { auth } = useAuth();
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [show, setShow] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (form.newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }
    if (form.currentPassword === form.newPassword) {
      setError("New password must differ from the current password.");
      return;
    }

    setLoading(true);
    try {
      await api(
        "/api/auth/change-password",
        {
          method: "POST",
          body: JSON.stringify({
            currentPassword: form.currentPassword,
            newPassword: form.newPassword,
          }),
        },
        auth.token
      );
      toast.success("Password updated.");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5 animate-in-fade">
      <PageHeader
        eyebrow="Settings"
        title="Account"
        description="Manage your sign-in credentials."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change password</CardTitle>
          <CardDescription>
            Signed in as <span className="font-medium text-foreground">{auth.user?.username}</span>
            {" · "}
            Role: <span className="font-medium capitalize text-foreground">{auth.user?.role}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="mx-auto max-w-md space-y-4">
            <PasswordField
              id="currentPassword"
              label="Current password"
              value={form.currentPassword}
              onChange={(value) => setForm((current) => ({ ...current, currentPassword: value }))}
              autoComplete="current-password"
              show={show.current}
              onToggleShow={() => setShow((current) => ({ ...current, current: !current.current }))}
            />
            <PasswordField
              id="newPassword"
              label="New password"
              value={form.newPassword}
              onChange={(value) => setForm((current) => ({ ...current, newPassword: value }))}
              autoComplete="new-password"
              show={show.next}
              onToggleShow={() => setShow((current) => ({ ...current, next: !current.next }))}
            />
            <PasswordField
              id="confirmPassword"
              label="Confirm new password"
              value={form.confirmPassword}
              onChange={(value) => setForm((current) => ({ ...current, confirmPassword: value }))}
              autoComplete="new-password"
              show={show.confirm}
              onToggleShow={() => setShow((current) => ({ ...current, confirm: !current.confirm }))}
            />

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={loading}>
              {loading && <Spinner className="mr-2" />}
              Update password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
