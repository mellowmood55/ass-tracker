import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { ROLES } from "@/lib/roles";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function PasswordInput({ id, label, value, onChange, autoComplete }) {
  const [show, setShow] = useState(false);
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
          onClick={() => setShow((current) => !current)}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export function UsersSettingsPage() {
  const { auth } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    role: ROLES.OPERATOR,
  });
  const [resetPassword, setResetPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api("/api/users", {}, auth.token);
      setUsers(data.users || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [auth.token]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  async function handleRegister(event) {
    event.preventDefault();
    if (registerForm.password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (registerForm.password !== registerForm.confirmPassword) {
      toast.error("Password and confirmation do not match.");
      return;
    }

    setSaving(true);
    try {
      await api(
        "/api/users",
        {
          method: "POST",
          body: JSON.stringify({
            username: registerForm.username.trim(),
            password: registerForm.password,
            role: registerForm.role,
          }),
        },
        auth.token
      );
      toast.success("User registered.");
      setRegisterOpen(false);
      setRegisterForm({
        username: "",
        password: "",
        confirmPassword: "",
        role: ROLES.OPERATOR,
      });
      await loadUsers();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(user, role) {
    try {
      await api(
        `/api/users/${user.id}`,
        { method: "PATCH", body: JSON.stringify({ role }) },
        auth.token
      );
      toast.success(`Updated role for ${user.username}.`);
      await loadUsers();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleActiveToggle(user, isActive) {
    try {
      await api(
        `/api/users/${user.id}`,
        { method: "PATCH", body: JSON.stringify({ isActive }) },
        auth.token
      );
      toast.success(isActive ? `${user.username} activated.` : `${user.username} deactivated.`);
      await loadUsers();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    if (!resetTarget) return;
    if (resetPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    setSaving(true);
    try {
      await api(
        `/api/users/${resetTarget.id}/reset-password`,
        { method: "POST", body: JSON.stringify({ newPassword: resetPassword }) },
        auth.token
      );
      toast.success(`Password reset for ${resetTarget.username}.`);
      setResetTarget(null);
      setResetPassword("");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteUser() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`/api/users/${deleteTarget.id}`, { method: "DELETE" }, auth.token);
      toast.success(`${deleteTarget.username} deleted.`);
      setDeleteTarget(null);
      await loadUsers();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5 animate-in-fade">
      <PageHeader
        eyebrow="Settings"
        title="Users"
        description="Register operators and admins. Only admins can manage accounts."
        actions={
          <Button type="button" onClick={() => setRegisterOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Register user
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team accounts</CardTitle>
          <CardDescription>
            Operators can create, import, and view data. They cannot edit or delete assets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/70">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const isSelf = Number(user.id) === Number(auth.user?.id);
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.username}
                          {isSelf ? (
                            <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            onValueChange={(value) => handleRoleChange(user, value)}
                            disabled={isSelf}
                          >
                            <SelectTrigger className="w-[140px]" aria-label={`Role for ${user.username}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={ROLES.ADMIN}>Admin</SelectItem>
                              <SelectItem value={ROLES.OPERATOR}>Operator</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={user.isActive}
                              onCheckedChange={(checked) => handleActiveToggle(user, checked)}
                              disabled={isSelf}
                              aria-label={`Active status for ${user.username}`}
                            />
                            <Badge variant={user.isActive ? "secondary" : "outline"}>
                              {user.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setResetPassword("");
                                setResetTarget(user);
                              }}
                            >
                              <KeyRound className="h-4 w-4" />
                              Reset password
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={isSelf}
                              onClick={() => setDeleteTarget(user)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register user</DialogTitle>
            <DialogDescription>
              Create an account for field staff or another admin. Default role is operator.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reg-username">Username</Label>
              <Input
                id="reg-username"
                value={registerForm.username}
                onChange={(event) =>
                  setRegisterForm((current) => ({ ...current, username: event.target.value }))
                }
                autoComplete="off"
                required
              />
            </div>
            <PasswordInput
              id="reg-password"
              label="Temporary password"
              value={registerForm.password}
              onChange={(value) => setRegisterForm((current) => ({ ...current, password: value }))}
              autoComplete="new-password"
            />
            <PasswordInput
              id="reg-confirm"
              label="Confirm password"
              value={registerForm.confirmPassword}
              onChange={(value) =>
                setRegisterForm((current) => ({ ...current, confirmPassword: value }))
              }
              autoComplete="new-password"
            />
            <div className="space-y-2">
              <Label htmlFor="reg-role">Role</Label>
              <Select
                value={registerForm.role}
                onValueChange={(value) => setRegisterForm((current) => ({ ...current, role: value }))}
              >
                <SelectTrigger id="reg-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ROLES.OPERATOR}>Operator</SelectItem>
                  <SelectItem value={ROLES.ADMIN}>Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRegisterOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Spinner className="mr-2" />}
                Register
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(resetTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setResetTarget(null);
            setResetPassword("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Set a new temporary password for {resetTarget?.username}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <PasswordInput
              id="reset-password"
              label="New password"
              value={resetPassword}
              onChange={setResetPassword}
              autoComplete="new-password"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Spinner className="mr-2" />}
                Reset password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently remove <strong>{deleteTarget?.username}</strong>? They will no longer be
              able to sign in. Asset history stays in place; this cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteUser();
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting && <Spinner className="mr-2" />}
              Delete user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
