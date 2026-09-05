"use client";

import { FormEvent } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  KeyRound,
  Lock,
  MailCheck,
  RotateCcw,
  ShieldCheck
} from "lucide-react";
import { Badge, Button, Card, Logo, ThemeToggle, Toasts } from "./ui";
import { DEMO_RESET_CODE } from "../lib/helpers";
import { useStore } from "../lib/store";

export function SignInView() {
  const { theme, setTheme, navigate, notify, setResetStep } = useStore();
  return (
    <div className="login-wrap" data-current-route="signin">
      <div className="login-brand">
        <div>
          <Logo onDark compact />
        </div>
        <div>
          <p className="hero-kicker"><span className="pulse-dot" /> Quote-to-cash in one workspace</p>
          <h1>Welcome back. <em>Pick up where the deal left off.</em></h1>
          <p className="lede">Q-1042 is waiting on Finance, Beta is countering, and the East Depot restocked overnight. Sign in to see exactly what moved.</p>
          <div className="login-proof">
            <div><b>$184.5k</b><span>Active pipeline</span></div>
            <div><b>3.4 hrs</b><span>Avg approval SLA</span></div>
            <div><b>88.4%</b><span>Margin protected</span></div>
          </div>
          <div className="login-steps">
            <div><span className="step-num">1</span><span><strong style={{ color: "#fff" }}>Check the queue.</strong> 4 approvals blocking $117.8k, oldest first.</span></div>
            <div><span className="step-num">2</span><span><strong style={{ color: "#fff" }}>Scan the risks.</strong> 3 anomalies flagged by the health radar.</span></div>
            <div><span className="step-num">3</span><span><strong style={{ color: "#fff" }}>Close the day.</strong> Fulfill, invoice, reconcile from one screen.</span></div>
          </div>
        </div>
        <div className="cluster" style={{ gap: 8 }}>
          <Badge tone="blue">SOC2 Type II</Badge>
          <Badge tone="green">SSO / SAML 2.0</Badge>
          <Badge tone="steel">Live ERP Sync</Badge>
        </div>
      </div>
      <div className="login-form-side">
        <div className="login-back">
          <Button tone="ghost" onClick={() => navigate("landing")} ariaLabel="Back to homepage">← Back to site</Button>
        </div>
        <div className="login-top-bar">
          <ThemeToggle theme={theme} onChange={setTheme} />
        </div>
        <div className="login-card">
          <Card>
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <div className="cluster" style={{ justifyContent: "center", marginBottom: 10 }}>
                <Logo />
              </div>
              <h2 style={{ fontSize: 17 }}>Sign in to DealFlow 360</h2>
              <p className="subtle" style={{ marginTop: 4 }}>Sales Ops workspace · NA-OPS region</p>
            </div>
            <form
              className="grid"
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                navigate("dashboard", "Authenticated as Alex Chen (Sales Ops)", "success");
              }}
            >
              <label>
                Work Email
                <input defaultValue="alex.chen@acmeops.io" type="email" required autoComplete="email" />
              </label>
              <label>
                Password
                <input defaultValue="password123" type="password" required autoComplete="current-password" />
              </label>
              <div className="cluster" style={{ justifyContent: "space-between" }}>
                <label className="check-row">
                  <input type="checkbox" defaultChecked /> Remember me
                </label>
                <button type="button" onClick={() => { setResetStep("email"); navigate("forgot-password"); }} style={{ all: "unset", cursor: "pointer", color: "var(--accent)", fontWeight: 700, fontSize: 12.5 }}>
                  Forgot password?
                </button>
              </div>
              <Button
                tone="primary"
                type="submit"
                testId="login-submit"
              >
                Sign In to Workspace <ArrowRight size={15} aria-hidden="true" />
              </Button>
              <div className="divider">or</div>
              <Button onClick={() => navigate("dashboard", "Authenticated with SSO as Alex Chen (Sales Ops)", "success")}>
                <ShieldCheck size={15} aria-hidden="true" /> Continue with SSO
              </Button>
              <div className="notice blue">
                <div className="cluster" style={{ gap: 6 }}>
                  <ShieldCheck size={16} aria-hidden="true" />
                  <span>Enterprise SSO & SAML 2.0 Enabled</span>
                </div>
                <Badge tone="blue">SOC2 Type II</Badge>
              </div>
            </form>
          </Card>
          <p className="auth-switch" style={{ marginTop: 14 }}>
            New to DealFlow 360? <button type="button" onClick={() => navigate("register")}>Create an account</button>
          </p>
        </div>
      </div>
    </div>
  );
}

export function RegisterView() {
  const { theme, setTheme, navigate } = useStore();
  return (
    <div className="login-wrap" data-current-route="register">
      <div className="login-brand alt">
        <div>
          <Logo onDark compact />
        </div>
        <div>
          <p className="hero-kicker"><span className="pulse-dot" /> Get started in minutes</p>
          <h1>Provision a workspace <em>that sells the way you do.</em></h1>
          <p className="lede">Bring your catalog, set discount guardrails, and send your first governed quote today. Sample data included so every view works on arrival.</p>
          <div className="login-steps">
            <div><span className="step-num">1</span><span><strong style={{ color: "#fff" }}>Create your account.</strong> One form, no credit card, sandbox ready instantly.</span></div>
            <div><span className="step-num">2</span><span><strong style={{ color: "#fff" }}>Set your guardrails.</strong> Tier caps and approval paths prefilled from best practice.</span></div>
            <div><span className="step-num">3</span><span><strong style={{ color: "#fff" }}>Send quote one.</strong> Q-1043 drafts itself from the sample catalog.</span></div>
          </div>
          <div className="login-proof">
            <div><b>18</b><span>Working views</span></div>
            <div><b>118</b><span>Sample SKUs</span></div>
            <div><b>0</b><span>Setup calls needed</span></div>
          </div>
        </div>
        <div className="cluster" style={{ gap: 8 }}>
          <Badge tone="blue">Free sandbox</Badge>
          <Badge tone="green">No credit card</Badge>
          <Badge tone="steel">Cancel anytime</Badge>
        </div>
      </div>
      <div className="login-form-side">
        <div className="login-back">
          <Button tone="ghost" onClick={() => navigate("landing")} ariaLabel="Back to homepage">← Back to site</Button>
        </div>
        <div className="login-top-bar">
          <ThemeToggle theme={theme} onChange={setTheme} />
        </div>
        <div className="login-card">
          <Card>
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <div className="cluster" style={{ justifyContent: "center", marginBottom: 10 }}>
                <Logo />
              </div>
              <h2 style={{ fontSize: 17 }}>Create your account</h2>
              <p className="subtle" style={{ marginTop: 4 }}>Provision an enterprise sandbox in under a minute</p>
            </div>
            <form
              className="grid"
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
                navigate("dashboard", "Enterprise sandbox initialized", "success");
              }}
            >
              <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <label>
                  Full Name
                  <input defaultValue="Alex Chen" required autoComplete="name" />
                </label>
                <label>
                  Company
                  <input defaultValue="Acme Corp" required autoComplete="organization" />
                </label>
              </div>
              <label>
                Work Email
                <input defaultValue="alex.chen@acmeops.io" type="email" required autoComplete="email" />
              </label>
              <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <label>
                  Sales Region
                  <select defaultValue="na-ops">
                    <option value="na-ops">North America (NA-OPS)</option>
                    <option value="emea">EMEA Revenue Ops</option>
                    <option value="global">Global Strategic</option>
                  </select>
                </label>
                <label>
                  Team Size
                  <select defaultValue="11-50">
                    <option value="1-10">1 to 10 reps</option>
                    <option value="11-50">11 to 50 reps</option>
                    <option value="51-200">51 to 200 reps</option>
                    <option value="200+">200+ reps</option>
                  </select>
                </label>
              </div>
              <label>
                Password
                <input defaultValue="password123" type="password" required autoComplete="new-password" />
              </label>
              <label className="check-row">
                <input type="checkbox" required /> I agree to the Terms and Data Processing Addendum
              </label>
              <Button
                tone="primary"
                type="submit"
                testId="register-submit"
              >
                Provision Enterprise Account <ArrowRight size={15} aria-hidden="true" />
              </Button>
              <div className="notice green">
                <div className="cluster" style={{ gap: 6 }}>
                  <CheckCircle2 size={16} aria-hidden="true" />
                  <span>Sandbox includes Q-1042 and the full approval trail</span>
                </div>
              </div>
            </form>
          </Card>
          <p className="auth-switch" style={{ marginTop: 14 }}>
            Already have an account? <button type="button" onClick={() => navigate("signin")}>Sign in</button>
          </p>
        </div>
      </div>
    </div>
  );
}

export function ForgotView() {
  const {
    theme, setTheme, navigate, notify,
    resetStep, setResetStep, resetEmail, setResetEmail
  } = useStore();
  const stepIndex = resetStep === "email" ? 0 : resetStep === "code" ? 1 : 2;
  return (
    <div className="login-wrap" data-current-route="forgot-password">
      <div className="login-brand alt">
        <div>
          <Logo onDark compact />
        </div>
        <div>
          <p className="hero-kicker"><span className="pulse-dot" /> Account recovery</p>
          <h1>Locked out? <em>Get back to the deal.</em></h1>
          <p className="lede">Reset links expire in 15 minutes and every reset is logged to the audit trail. Q-1042 will still be waiting when you return.</p>
          <div className="login-steps">
            <div><span className={`step-num${stepIndex >= 0 ? " done" : ""}`}>1</span><span><strong style={{ color: "#fff" }}>Verify your email.</strong> We send a 6-digit code to your work inbox.</span></div>
            <div><span className={`step-num${stepIndex >= 1 ? " done" : ""}`}>2</span><span><strong style={{ color: "#fff" }}>Enter the code.</strong> Confirms it is really you, no SSO round-trip.</span></div>
            <div><span className={`step-num${stepIndex >= 2 ? " done" : ""}`}>3</span><span><strong style={{ color: "#fff" }}>Set a new password.</strong> 8+ characters, then straight back to sign in.</span></div>
          </div>
        </div>
        <div className="cluster" style={{ gap: 8 }}>
          <Badge tone="blue">SSO / SAML 2.0</Badge>
          <Badge tone="green">Encrypted Reset</Badge>
          <Badge tone="steel">15-min Expiry</Badge>
        </div>
      </div>
      <div className="login-form-side">
        <div className="login-back">
          <Button tone="ghost" onClick={() => navigate("landing")} ariaLabel="Back to homepage">← Back to site</Button>
        </div>
        <div className="login-top-bar">
          <ThemeToggle theme={theme} onChange={setTheme} />
        </div>
        <div className="login-card">
          <Card>
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <div className="cluster" style={{ justifyContent: "center", marginBottom: 10 }}>
                <Logo />
              </div>
              <h2 style={{ fontSize: 17 }}>Reset your password</h2>
              <p className="subtle" style={{ marginTop: 4 }}>
                {resetStep === "email" && "Step 1 of 3: tell us which account to recover"}
                {resetStep === "code" && "Step 2 of 3: enter the code we emailed you"}
                {resetStep === "reset" && "Step 3 of 3: choose a new password"}
              </p>
            </div>
            <div className="auth-steps" aria-hidden="true">
              <span className={stepIndex === 0 ? "active" : "done"}>Email</span>
              <span className={stepIndex === 1 ? "active" : stepIndex > 1 ? "done" : ""}>Code</span>
              <span className={stepIndex === 2 ? "active" : ""}>New password</span>
            </div>
            {resetStep === "email" && (
              <form
                className="grid"
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  const email = new FormData(event.currentTarget).get("email");
                  if (typeof email === "string" && email) setResetEmail(email);
                  setResetStep("code");
                  notify(`Reset code sent to ${typeof email === "string" && email ? email : resetEmail}`, "success");
                }}
              >
                <label>
                  Work Email
                  <input name="email" defaultValue={resetEmail} type="email" required autoComplete="email" />
                </label>
                <Button tone="primary" type="submit" testId="reset-send-code">
                  <MailCheck size={15} aria-hidden="true" /> Send Reset Code
                </Button>
                <div className="notice blue">
                  <div className="cluster" style={{ gap: 6 }}>
                    <ShieldCheck size={16} aria-hidden="true" />
                    <span>Code expires in 15 minutes. Check spam if it does not arrive.</span>
                  </div>
                </div>
              </form>
            )}
            {resetStep === "code" && (
              <form
                className="grid"
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  const code = String(new FormData(event.currentTarget).get("code") || "").replace(/\s/g, "");
                  if (code === DEMO_RESET_CODE) {
                    setResetStep("reset");
                    notify("Code verified. Choose a new password.", "success");
                  } else {
                    notify("That code does not match. Check the demo hint and retry.", "error");
                  }
                }}
              >
                <p className="subtle" style={{ textAlign: "center" }}>
                  Sent to <strong style={{ color: "var(--ink)" }}>{resetEmail}</strong>
                  <button type="button" onClick={() => setResetStep("email")} style={{ all: "unset", cursor: "pointer", color: "var(--accent)", fontWeight: 700, marginLeft: 8 }}>
                    Change
                  </button>
                </p>
                <label>
                  6-digit Code
                  <input name="code" className="code-input" inputMode="numeric" maxLength={6} placeholder="••••••" required autoComplete="one-time-code" />
                </label>
                <Button tone="primary" type="submit" testId="reset-verify-code">
                  <KeyRound size={15} aria-hidden="true" /> Verify Code
                </Button>
                <Button tone="ghost" onClick={() => notify(`Reset code re-sent to ${resetEmail}`, "info")}>
                  <RotateCcw size={14} aria-hidden="true" /> Resend Code
                </Button>
                <div className="notice">
                  <span>Demo build: the code is <strong className="mono">{DEMO_RESET_CODE}</strong></span>
                </div>
              </form>
            )}
            {resetStep === "reset" && (
              <form
                className="grid"
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  const next = String(data.get("password") || "");
                  const confirm = String(data.get("confirm") || "");
                  if (next.length < 8) {
                    notify("Password must be at least 8 characters.", "error");
                    return;
                  }
                  if (next !== confirm) {
                    notify("Passwords do not match. Retype both fields.", "error");
                    return;
                  }
                  navigate("signin", "Password updated. Sign in with your new credentials.", "success");
                }}
              >
                <label>
                  New Password
                  <input name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="8+ characters" />
                </label>
                <label>
                  Confirm New Password
                  <input name="confirm" type="password" required minLength={8} autoComplete="new-password" placeholder="Repeat the password" />
                </label>
                <Button tone="primary" type="submit" testId="reset-save-password">
                  <Check size={15} aria-hidden="true" /> Save New Password
                </Button>
                <div className="notice green">
                  <div className="cluster" style={{ gap: 6 }}>
                    <Lock size={15} aria-hidden="true" />
                    <span>All other sessions will be signed out automatically.</span>
                  </div>
                </div>
              </form>
            )}
          </Card>
          <p className="auth-switch" style={{ marginTop: 14 }}>
            Remembered it after all? <button type="button" onClick={() => navigate("signin")}>Back to sign in</button>
          </p>
        </div>
      </div>
      <Toasts />
    </div>
  );
}
