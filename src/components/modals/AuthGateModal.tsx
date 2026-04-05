import { useEffect, useState } from "react";
import { deriveUserProfileInitials } from "@/lib/userProfile";

export type AuthGateMode = "loading" | "bootstrap" | "sign_in";
export type RememberPasswordDurationUnit = "hour" | "day" | "week" | "month" | "year";

export interface RememberPasswordPreference {
  enabled: boolean;
  durationValue: number;
  durationUnit: RememberPasswordDurationUnit;
}

const DEFAULT_REMEMBER_PASSWORD_PREFERENCE: RememberPasswordPreference = {
  enabled: false,
  durationValue: 1,
  durationUnit: "day"
};

type BootstrapPayload = {
  username: string;
  displayName: string;
  password: string;
  rememberPassword: RememberPasswordPreference;
};

type SignInPayload = {
  username: string;
  password: string;
  rememberPassword: RememberPasswordPreference;
};

type RememberedAuthUser = {
  userId: string;
  username: string;
  displayName: string;
  profilePhotoDataUrl: string | null;
};

interface AuthGateModalProps {
  mode: AuthGateMode;
  busy: boolean;
  error: string | null;
  rememberedUser?: RememberedAuthUser | null;
  initialRememberPassword?: RememberPasswordPreference;
  onBootstrap: (payload: BootstrapPayload) => Promise<void> | void;
  onSignIn: (payload: SignInPayload) => Promise<void> | void;
}

export function AuthGateModal({
  mode,
  busy,
  error,
  rememberedUser = null,
  initialRememberPassword = DEFAULT_REMEMBER_PASSWORD_PREFERENCE,
  onBootstrap,
  onSignIn
}: AuthGateModalProps) {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberPasswordEnabled, setRememberPasswordEnabled] = useState(initialRememberPassword.enabled);
  const [rememberPasswordDurationValue, setRememberPasswordDurationValue] = useState(initialRememberPassword.durationValue);
  const [rememberPasswordDurationUnit, setRememberPasswordDurationUnit] = useState<RememberPasswordDurationUnit>(
    initialRememberPassword.durationUnit
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [useAnotherAccount, setUseAnotherAccount] = useState(false);

  useEffect(() => {
    const nextRememberPassword = {
      enabled: initialRememberPassword.enabled,
      durationValue: Math.max(1, Math.floor(initialRememberPassword.durationValue || 1)),
      durationUnit: initialRememberPassword.durationUnit
    };
    setLocalError(null);
    setRememberPasswordEnabled(nextRememberPassword.enabled);
    setRememberPasswordDurationValue(nextRememberPassword.durationValue);
    setRememberPasswordDurationUnit(nextRememberPassword.durationUnit);
    if (mode === "loading") return;
    setPassword("");
    setConfirmPassword("");
    if (mode === "bootstrap") {
      setUseAnotherAccount(false);
      return;
    }
    if (rememberedUser) {
      setUsername(rememberedUser.username);
      setUseAnotherAccount(false);
    }
  }, [initialRememberPassword, mode, rememberedUser]);

  const loadingMode = mode === "loading";
  const bootstrapMode = mode === "bootstrap";
  const rememberedSignInActive = !loadingMode && !bootstrapMode && Boolean(rememberedUser) && !useAnotherAccount;
  const signInUsername = rememberedSignInActive ? rememberedUser?.username ?? "" : username;
  const rememberedUserLabel =
    rememberedUser?.displayName.trim() || rememberedUser?.username.trim() || "User";
  const rememberedUserInitials = deriveUserProfileInitials(rememberedUserLabel);

  const submit = () => {
    const normalizedUsername = signInUsername.trim();
    const normalizedRememberDurationValue = Math.max(1, Math.floor(rememberPasswordDurationValue || 1));
    if (!normalizedUsername) {
      setLocalError("Username is required.");
      return;
    }
    if (!password) {
      setLocalError("Password is required.");
      return;
    }
    if (rememberPasswordEnabled && normalizedRememberDurationValue < 1) {
      setLocalError("Remembered sign-in duration must be at least 1.");
      return;
    }

    const rememberPassword: RememberPasswordPreference = {
      enabled: rememberPasswordEnabled,
      durationValue: normalizedRememberDurationValue,
      durationUnit: rememberPasswordDurationUnit
    };

    if (mode === "bootstrap") {
      const normalizedDisplayName = displayName.trim();
      if (!normalizedDisplayName) {
        setLocalError("Display name is required.");
        return;
      }
      if (password !== confirmPassword) {
        setLocalError("Passwords do not match.");
        return;
      }
      setLocalError(null);
      void onBootstrap({
        username: normalizedUsername,
        displayName: normalizedDisplayName,
        password,
        rememberPassword
      });
      return;
    }

    setLocalError(null);
    void onSignIn({
      username: normalizedUsername,
      password,
      rememberPassword
    });
  };

  const resolvedError = localError ?? error;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-[rgba(6,14,24,0.72)] px-4 py-8">
      <div
        className="w-full max-w-[560px] rounded-[28px] border border-[rgba(120,164,198,0.26)] bg-[linear-gradient(180deg,rgba(7,26,42,0.98),rgba(5,16,26,0.98))] p-7 shadow-[0_28px_90px_rgba(0,0,0,0.38)]"
        data-ode-ignore-shortcuts="true"
      >
        <div className="text-[0.78rem] uppercase tracking-[0.22em] text-[var(--ode-accent)]">
          {loadingMode ? "Access System" : bootstrapMode ? "First Admin" : "Sign In"}
        </div>
        <h2 className="mt-3 text-[1.8rem] font-semibold text-[var(--ode-text)]">
          {loadingMode
            ? "Loading user accounts"
            : bootstrapMode
              ? "Create the first administrator"
              : "Sign in to ODETool Pro"}
        </h2>
        <p className="mt-3 text-[0.98rem] leading-7 text-[var(--ode-text-muted)]">
          {loadingMode
            ? "Please wait while the local access store is loaded."
            : bootstrapMode
              ? "This first account becomes the local administrator and starts with role R6."
              : rememberedSignInActive
                ? "This device remembers your last account. Enter only the password to continue."
                : "Your account role now drives the access policy instead of the manual role switch."}
        </p>

        {loadingMode ? (
          <div className="mt-8 rounded-[20px] border border-[var(--ode-border)] bg-[rgba(6,22,36,0.68)] px-5 py-4 text-[0.98rem] text-[var(--ode-text-muted)]">
            Loading...
          </div>
        ) : (
          <>
            {rememberedSignInActive && rememberedUser ? (
              <div className="mt-8 rounded-[22px] border border-[rgba(95,220,255,0.18)] bg-[rgba(6,22,36,0.74)] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-full border border-[rgba(95,220,255,0.3)] bg-[rgba(13,73,110,0.42)] text-[1.05rem] font-semibold tracking-[0.08em] text-[var(--ode-text)]">
                      {rememberedUser.profilePhotoDataUrl ? (
                        <img
                          src={rememberedUser.profilePhotoDataUrl}
                          alt={rememberedUserLabel}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        rememberedUserInitials
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[0.72rem] uppercase tracking-[0.18em] text-[var(--ode-accent)]">
                        Remembered Account
                      </div>
                      <div className="mt-1 truncate text-[1rem] font-semibold text-[var(--ode-text)]">
                        {rememberedUserLabel}
                      </div>
                      <div className="mt-1 truncate text-[0.88rem] text-[var(--ode-text-muted)]">
                        @{rememberedUser.username}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-[var(--ode-border)] px-3 py-1.5 text-[0.72rem] uppercase tracking-[0.16em] text-[var(--ode-text-muted)] transition hover:border-[var(--ode-border-accent)] hover:text-[var(--ode-text)]"
                    disabled={busy}
                    onClick={() => {
                      setUseAnotherAccount(true);
                      setUsername("");
                      setPassword("");
                      setLocalError(null);
                    }}
                  >
                    Use Another
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-8 grid gap-4">
              {bootstrapMode ? (
                <label className="block">
                  <div className="mb-2 text-[0.82rem] text-[var(--ode-text-muted)]">Display Name</div>
                  <input
                    className="ode-input h-11 w-full rounded-[16px] px-4"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    disabled={busy}
                    autoComplete="name"
                    autoFocus
                  />
                </label>
              ) : null}

              {!rememberedSignInActive ? (
                <label className="block">
                  <div className="mb-2 text-[0.82rem] text-[var(--ode-text-muted)]">Username</div>
                  <input
                    className="ode-input h-11 w-full rounded-[16px] px-4"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    disabled={busy}
                    autoComplete="username"
                    autoFocus={!bootstrapMode}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        submit();
                      }
                    }}
                  />
                </label>
              ) : null}

              <label className="block">
                <div className="mb-2 text-[0.82rem] text-[var(--ode-text-muted)]">Password</div>
                <input
                  className="ode-input h-11 w-full rounded-[16px] px-4"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={busy}
                  autoComplete={bootstrapMode ? "new-password" : "current-password"}
                  autoFocus={rememberedSignInActive}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !bootstrapMode) {
                      event.preventDefault();
                      submit();
                    }
                  }}
                />
              </label>

              <div className="rounded-[18px] border border-[var(--ode-border)] bg-[rgba(7,24,37,0.58)] px-4 py-4">
                <label className="flex items-center gap-3 text-[0.92rem] text-[var(--ode-text)]">
                  <input
                    type="checkbox"
                    checked={rememberPasswordEnabled}
                    onChange={(event) => setRememberPasswordEnabled(event.target.checked)}
                    disabled={busy}
                  />
                  <span>Remember password on this device</span>
                </label>
                <div className="mt-2 text-[0.82rem] leading-6 text-[var(--ode-text-muted)]">
                  Keep this account signed in automatically for a time you choose.
                </div>
                {rememberPasswordEnabled ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,120px)_minmax(0,1fr)]">
                    <label className="block">
                      <div className="mb-2 text-[0.78rem] uppercase tracking-[0.12em] text-[var(--ode-text-muted)]">
                        Duration
                      </div>
                      <input
                        className="ode-input h-11 w-full rounded-[14px] px-4"
                        type="number"
                        min={1}
                        step={1}
                        value={rememberPasswordDurationValue}
                        onChange={(event) => setRememberPasswordDurationValue(Math.max(1, Number(event.target.value) || 1))}
                        disabled={busy}
                      />
                    </label>
                    <label className="block">
                      <div className="mb-2 text-[0.78rem] uppercase tracking-[0.12em] text-[var(--ode-text-muted)]">
                        Unit
                      </div>
                      <select
                        className="ode-input h-11 w-full rounded-[14px] px-4"
                        value={rememberPasswordDurationUnit}
                        onChange={(event) => setRememberPasswordDurationUnit(event.target.value as RememberPasswordDurationUnit)}
                        disabled={busy}
                      >
                        <option value="hour">Hour(s)</option>
                        <option value="day">Day(s)</option>
                        <option value="week">Week(s)</option>
                        <option value="month">Month(s)</option>
                        <option value="year">Year(s)</option>
                      </select>
                    </label>
                  </div>
                ) : null}
              </div>

              {!bootstrapMode && rememberedUser && useAnotherAccount ? (
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-[0.76rem] uppercase tracking-[0.16em] text-[var(--ode-accent)] transition hover:text-[var(--ode-text)]"
                    disabled={busy}
                    onClick={() => {
                      setUseAnotherAccount(false);
                      setUsername(rememberedUser.username);
                      setPassword("");
                      setLocalError(null);
                    }}
                  >
                    Back To Remembered Account
                  </button>
                </div>
              ) : null}

              {bootstrapMode ? (
                <label className="block">
                  <div className="mb-2 text-[0.82rem] text-[var(--ode-text-muted)]">Confirm Password</div>
                  <input
                    className="ode-input h-11 w-full rounded-[16px] px-4"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    disabled={busy}
                    autoComplete="new-password"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        submit();
                      }
                    }}
                  />
                </label>
              ) : null}
            </div>

            {resolvedError ? (
              <div className="mt-5 rounded-[18px] border border-[rgba(224,132,132,0.34)] bg-[rgba(91,28,28,0.4)] px-4 py-3 text-[0.92rem] text-[#ffd2d2]">
                {resolvedError}
              </div>
            ) : null}

            <div className="mt-7 flex justify-end">
              <button
                type="button"
                className="ode-primary-btn h-11 min-w-[180px] px-6 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={submit}
                disabled={busy}
              >
                {busy ? "Working..." : bootstrapMode ? "Create Admin" : "Sign In"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
