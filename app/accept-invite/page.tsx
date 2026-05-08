"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { FieldError, FormAlert, RequiredMark } from "@/components/form-error";
import { type FieldErrors, parseApiError } from "@/lib/form-errors";
import { usePageTitle } from "@/hooks/use-page-title";

type Invitee = { name: string; email: string };

function AcceptInviteForm() {
  usePageTitle("Accept invite");
  const router = useRouter();
  const search = useSearchParams();
  const token = search.get("token") ?? "";

  const [loading, setLoading] = useState(true);
  const [invitee, setInvitee] = useState<Invitee | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setTokenError("Invite link is missing a token.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `/api/auth/invite?token=${encodeURIComponent(token)}`
        );
        const data = await res.json();
        if (!res.ok) {
          setTokenError(data.error || "Invite link is invalid or has expired");
        } else {
          setInvitee(data.user);
        }
      } catch {
        setTokenError("Couldn't verify invite link.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAlertMsg(null);

    const localErrs: FieldErrors = {};
    if (password.length < 6)
      localErrs.password = "Password must be at least 6 characters";
    if (password !== confirmPassword)
      localErrs.confirm = "Passwords do not match";
    if (Object.keys(localErrs).length > 0) {
      setErrors(localErrs);
      return;
    }
    setErrors({});

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const { message, fieldErrors } = await parseApiError(res);
        if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
        else setAlertMsg(message);
        return;
      }
      toast.success("Welcome to Projectly");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setAlertMsg(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col justify-center items-center px-4 py-10 sm:px-6 lg:px-12">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-10 lg:hidden">
          <Image
            src="/logo.png"
            alt="Projectly"
            width={36}
            height={36}
            priority
            className="size-9 rounded-lg"
          />
          <span className="text-lg font-semibold tracking-tight">
            Projectly
          </span>
        </div>

        <div className="rounded-2xl border bg-card text-card-foreground shadow-xl p-8 sm:p-10">
          <div className="space-y-2 mb-8">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium">
              <Sparkles className="size-3" /> You're invited
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              Set your password
            </h1>
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Verifying your invite…"
                : invitee
                ? `Welcome, ${invitee.name}. Choose a password to activate your account.`
                : tokenError ?? "Invite link is invalid."}
            </p>
          </div>

          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : tokenError ? (
            <div className="space-y-4">
              <FormAlert message={tokenError} />
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Go to sign in <ArrowRight className="size-4" />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormAlert message={alertMsg} />

              {invitee && (
                <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs">
                  <div className="text-muted-foreground">Signing in as</div>
                  <div className="mt-0.5 font-medium">{invitee.email}</div>
                </div>
              )}

              <div className="grid gap-1.5">
                <Label htmlFor="password">
                  New password
                  <RequiredMark />
                </Label>
                <InputGroup>
                  <InputGroupAddon>
                    <Lock className="text-muted-foreground" />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                    aria-invalid={errors.password ? true : undefined}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-sm"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      onClick={() => setShowPassword((v) => !v)}
                      type="button"
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <FieldError reserve message={errors.password} />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="confirm">
                  Confirm password
                  <RequiredMark />
                </Label>
                <InputGroup>
                  <InputGroupAddon>
                    <ShieldCheck className="text-muted-foreground" />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="confirm"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                    aria-invalid={errors.confirm ? true : undefined}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-sm"
                      aria-label={
                        showConfirm ? "Hide password" : "Show password"
                      }
                      onClick={() => setShowConfirm((v) => !v)}
                      type="button"
                    >
                      {showConfirm ? <EyeOff /> : <Eye />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <FieldError reserve message={errors.confirm} />
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full"
                size="lg"
              >
                {submitting ? "Activating…" : "Activate & sign in"}
                <ArrowRight className="ml-2 size-4" />
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Already activated?{" "}
                <Link
                  href="/login"
                  className="font-medium text-primary hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-center">
        <ThemeToggle />
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Skeleton className="h-96 w-full max-w-md" />
        </div>
      }
    >
      <AcceptInviteForm />
    </Suspense>
  );
}
