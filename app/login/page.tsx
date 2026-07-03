"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
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
import { ThemeToggle } from "@/components/theme-toggle";
import { FieldError, FormAlert, RequiredMark } from "@/components/form-error";
import { usePageTitle } from "@/hooks/use-page-title";
import { type FieldErrors, parseApiError } from "@/lib/form-errors";

function LoginForm() {
  usePageTitle("Sign in");
  const router = useRouter();
  const search = useSearchParams();
  const redirect = search.get("redirect") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAlertMsg(null);

    const localErrs: FieldErrors = {};
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(email.trim())) localErrs.email = "Enter a valid email";
    if (password.length < 1) localErrs.password = "Password is required";
    if (Object.keys(localErrs).length > 0) {
      setErrors(localErrs);
      return;
    }
    setErrors({});

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const { message, fieldErrors } = await parseApiError(res);
        if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
        else setAlertMsg(message);
        return;
      }
      toast.success("Welcome back");
      router.push(redirect);
      router.refresh();
    } catch (err) {
      setAlertMsg(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/70 p-7 shadow-xl shadow-primary/5 backdrop-blur sm:p-9">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
        />
        <div className="mb-8 space-y-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 transition-opacity hover:opacity-90"
          >
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
          </Link>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            <Sparkles className="size-3" /> Welcome back
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Sign in to your account
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your credentials to access the dashboard.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <FormAlert message={alertMsg} />

          <div className="grid gap-1.5">
            <Label htmlFor="email" className="text-sm font-medium">
              Email address
              <RequiredMark />
            </Label>
            <InputGroup
              className="h-12"
              aria-invalid={errors.email ? true : undefined}
            >
              <InputGroupAddon>
                <Mail className="text-muted-foreground" />
              </InputGroupAddon>
              <InputGroupInput
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((p) => ({ ...p, email: "" }));
                }}
                autoComplete="email"
                className="h-11"
              />
            </InputGroup>
            <FieldError message={errors.email} />
          </div>

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
                <RequiredMark />
              </Label>
              <button
                type="button"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                onClick={() =>
                  toast.info("Contact an admin to reset your password.")
                }
              >
                Forgot password?
              </button>
            </div>
            <InputGroup
              className="h-12"
              aria-invalid={errors.password ? true : undefined}
            >
              <InputGroupAddon>
                <Lock className="text-muted-foreground" />
              </InputGroupAddon>
              <InputGroupInput
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password)
                    setErrors((p) => ({ ...p, password: "" }));
                }}
                autoComplete="current-password"
                className="h-11"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-sm"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldError message={errors.password} />
          </div>

          <Button
            type="submit"
            className="group h-11 w-full text-base font-medium"
            disabled={submitting}
          >
            {submitting ? (
              "Signing in…"
            ) : (
              <>
                Sign in
                <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/60" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase">
            <span className="bg-card px-2 tracking-[0.2em] text-muted-foreground">
              Protected workspace
            </span>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Need access? Ask an admin to create your account, or return to{" "}
          <Link href="/" className="underline hover:text-foreground">
            home
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
