import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { TrashGlyphSmall, UploadGlyphSmall } from "@/components/Icons";
import { ACCESS_ROLE_VALUES, type NodeAccessRole } from "@/features/workspace/accessControl";
import {
  createEmptyStoredAiProviderKey,
  detectAndNormalizeAiProviderKeys,
  ensureAiProviderKeyDrafts,
  readStoredAiProviderKeys,
  writeStoredAiProviderKeys,
  type StoredAiProviderKey
} from "@/lib/aiProviderKeys";
import { translate, type LanguageCode, type TranslationParams } from "@/lib/i18n";
import type { UserAccountLicensePlan, UserAccountSummary } from "@/lib/userAccounts";
import { createUserProfilePhotoDataUrl, deriveUserProfileInitials } from "@/lib/userProfile";

type CreatePayload = {
  username: string;
  displayName: string;
  password: string;
  role: NodeAccessRole;
  isAdmin: boolean;
  profilePhotoDataUrl?: string | null;
  licensePlan: UserAccountLicensePlan;
};

type UpdatePayload = {
  userId: string;
  username: string;
  displayName: string;
  role: NodeAccessRole;
  isAdmin: boolean;
  disabled: boolean;
  profilePhotoDataUrl?: string | null;
  nextPassword?: string | null;
  licensePlan: UserAccountLicensePlan;
  restartLicenseFromNow?: boolean;
};

interface UserAccountsModalProps {
  open: boolean;
  language: LanguageCode;
  users: UserAccountSummary[];
  currentUserId: string | null;
  profileOnlyUserId?: string | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (payload: CreatePayload) => Promise<void> | void;
  onUpdate: (payload: UpdatePayload) => Promise<void> | void;
  onDelete: (userId: string) => Promise<void> | void;
}

const NEW_USER_SENTINEL = "__new__";
const LICENSE_PLAN_OPTIONS: Array<{ value: UserAccountLicensePlan; label: string }> = [
  { value: "unlimited", label: "Unlimited" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" }
];

function formatLicensePlanLabel(plan: UserAccountLicensePlan): string {
  return LICENSE_PLAN_OPTIONS.find((option) => option.value === plan)?.label ?? "Unlimited";
}

function formatLicenseStatusLabel(user: UserAccountSummary): string {
  if (user.licenseStatus === "unlimited") return "Unlimited licence";
  if (user.licenseStatus === "expired") {
    if (user.licenseExpiresAt) {
      return `Expired ${new Date(user.licenseExpiresAt).toLocaleString()}`;
    }
    return "Licence expired";
  }
  if (user.licenseExpiresAt) {
    return `Active until ${new Date(user.licenseExpiresAt).toLocaleString()}`;
  }
  return "Licence active";
}

export function UserAccountsModal({
  open,
  language,
  users,
  currentUserId,
  profileOnlyUserId = null,
  saving,
  error,
  onClose,
  onCreate,
  onUpdate,
  onDelete
}: UserAccountsModalProps) {
  const t = (key: string, params?: TranslationParams) => translate(language, key, params);
  const profileOnlyMode = profileOnlyUserId !== null;
  const visibleUsers = useMemo(
    () => (profileOnlyMode ? users.filter((user) => user.userId === profileOnlyUserId) : users),
    [profileOnlyMode, profileOnlyUserId, users]
  );
  const [selectedUserId, setSelectedUserId] = useState<string>(NEW_USER_SENTINEL);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [profilePhotoDataUrl, setProfilePhotoDataUrl] = useState<string | null>(null);
  const [role, setRole] = useState<NodeAccessRole>("R3");
  const [isAdmin, setIsAdmin] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [licensePlan, setLicensePlan] = useState<UserAccountLicensePlan>("unlimited");
  const [restartLicenseFromNow, setRestartLicenseFromNow] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState<"profile" | "ai_api">("profile");
  const [providerKeys, setProviderKeys] = useState<StoredAiProviderKey[]>(() =>
    ensureAiProviderKeyDrafts(readStoredAiProviderKeys())
  );
  const [aiApiMessage, setAiApiMessage] = useState("");
  const [isTestingAiKeys, setIsTestingAiKeys] = useState(false);
  const [isSavingAiKeys, setIsSavingAiKeys] = useState(false);

  const selectedUser = useMemo(
    () => visibleUsers.find((user) => user.userId === selectedUserId) ?? null,
    [selectedUserId, visibleUsers]
  );
  const creatingNewUser = !profileOnlyMode && selectedUserId === NEW_USER_SENTINEL;
  const editingSelf = selectedUser?.userId === currentUserId;
  const canManageDirectory = !profileOnlyMode;

  useEffect(() => {
    if (!open) return;
    setActiveProfileTab("profile");
    setProviderKeys(ensureAiProviderKeyDrafts(readStoredAiProviderKeys()));
    setAiApiMessage("");
    if (profileOnlyMode) {
      setSelectedUserId(profileOnlyUserId ?? NEW_USER_SENTINEL);
      return;
    }
    if (creatingNewUser) return;
    if (selectedUser) return;
    setSelectedUserId(visibleUsers[0]?.userId ?? NEW_USER_SENTINEL);
  }, [creatingNewUser, open, profileOnlyMode, profileOnlyUserId, selectedUser, visibleUsers]);

  useEffect(() => {
    if (!open) return;
    setLocalError(null);
    setPassword("");
    setConfirmPassword("");
    if (!selectedUser) {
      setDisplayName("");
      setUsername("");
      setProfilePhotoDataUrl(null);
      setRole("R3");
      setIsAdmin(false);
      setDisabled(false);
      setLicensePlan("unlimited");
      setRestartLicenseFromNow(false);
      return;
    }
    setDisplayName(selectedUser.displayName);
    setUsername(selectedUser.username);
    setProfilePhotoDataUrl(selectedUser.profilePhotoDataUrl ?? null);
    setRole(selectedUser.role);
    setIsAdmin(selectedUser.isAdmin);
    setDisabled(selectedUser.disabled);
    setLicensePlan(selectedUser.licensePlan);
    setRestartLicenseFromNow(false);
  }, [open, selectedUser]);

  if (!open) return null;

  const resolvedError = localError ?? error;
  const avatarLabel = displayName.trim() || selectedUser?.displayName || username.trim() || selectedUser?.username || "User";
  const avatarInitials = deriveUserProfileInitials(avatarLabel);

  const handleProfilePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;

    setPhotoUploading(true);
    try {
      const nextPhotoDataUrl = await createUserProfilePhotoDataUrl(file);
      setProfilePhotoDataUrl(nextPhotoDataUrl);
      setLocalError(null);
    } catch {
      setLocalError("Profile photo could not be loaded. Try another image.");
    } finally {
      setPhotoUploading(false);
    }
  };

  const submit = () => {
    const normalizedDisplayName = displayName.trim();
    const normalizedUsername = username.trim();
    if (!normalizedDisplayName) {
      setLocalError("Display name is required.");
      return;
    }
    if (!normalizedUsername) {
      setLocalError("Username is required.");
      return;
    }
    if (password || confirmPassword) {
      if (password !== confirmPassword) {
        setLocalError("Passwords do not match.");
        return;
      }
    }

    if (creatingNewUser) {
      if (!password) {
        setLocalError("Password is required for a new user.");
        return;
      }
      setLocalError(null);
      void onCreate({
        username: normalizedUsername,
        displayName: normalizedDisplayName,
        password,
        role,
        isAdmin,
        profilePhotoDataUrl,
        licensePlan
      });
      return;
    }

    if (!selectedUser) {
      setLocalError("Choose a user account first.");
      return;
    }

    setLocalError(null);
    void onUpdate({
      userId: selectedUser.userId,
      username: normalizedUsername,
      displayName: normalizedDisplayName,
      role,
      isAdmin,
      disabled,
      profilePhotoDataUrl,
      nextPassword: password ? password : null,
      licensePlan,
      restartLicenseFromNow
    });
  };

  const requestDelete = () => {
    if (!selectedUser) return;
    if (editingSelf) {
      setLocalError("Sign out and use another admin account before deleting this user.");
      return;
    }
    const confirmed = window.confirm(`Delete user "${selectedUser.displayName}"?`);
    if (!confirmed) return;
    setLocalError(null);
    void onDelete(selectedUser.userId);
  };

  const updateAiProviderKey = (index: number, apiKey: string) => {
    setProviderKeys((current) =>
      ensureAiProviderKeyDrafts(
        current.map((entry, entryIndex) =>
          entryIndex === index
            ? {
                providerId: "unknown",
                providerLabel: "Auto-detect",
                apiKey
              }
            : entry
        )
      )
    );
    setAiApiMessage("");
  };

  const updateAiProviderList = (next: StoredAiProviderKey[]) => {
    setProviderKeys(ensureAiProviderKeyDrafts(next));
    setAiApiMessage("");
  };

  const formatDetectedProviderMessage = (entries: StoredAiProviderKey[]): string => {
    const known = entries.filter((entry) => entry.providerId !== "unknown");
    if (known.length === 0) return t("settings.msg_no_keys");
    const labels = Array.from(new Set(known.map((entry) => entry.providerLabel)));
    const unknownCount = entries.filter((entry) => entry.providerId === "unknown").length;
    return unknownCount > 0
      ? `Detected ${known.length} key(s): ${labels.join(", ")}. ${unknownCount} key(s) could not be identified.`
      : `Detected ${known.length} key(s): ${labels.join(", ")}.`;
  };

  const testAiProviderKeys = async () => {
    setAiApiMessage("");
    setIsTestingAiKeys(true);
    try {
      const detected = await detectAndNormalizeAiProviderKeys(providerKeys);
      if (detected.length === 0) {
        setProviderKeys([createEmptyStoredAiProviderKey()]);
        setAiApiMessage(t("settings.msg_no_keys"));
        return;
      }
      setProviderKeys(ensureAiProviderKeyDrafts(detected));
      setAiApiMessage(formatDetectedProviderMessage(detected));
    } catch {
      setAiApiMessage(t("settings.msg_no_keys"));
    } finally {
      setIsTestingAiKeys(false);
    }
  };

  const saveAiProviderKeys = async () => {
    setIsSavingAiKeys(true);
    try {
      const detected = await detectAndNormalizeAiProviderKeys(providerKeys);
      writeStoredAiProviderKeys(detected);
      setProviderKeys(ensureAiProviderKeyDrafts(detected));
      setAiApiMessage(t("settings.msg_saved_local"));
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      setAiApiMessage(reason);
    } finally {
      setIsSavingAiKeys(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[145] flex items-center justify-center bg-[rgba(6,14,24,0.7)] px-4 py-8">
      <div
        className="flex max-h-[86vh] w-full max-w-[1080px] overflow-hidden rounded-[28px] border border-[rgba(120,164,198,0.28)] bg-[linear-gradient(180deg,rgba(8,28,44,0.98),rgba(6,17,28,0.98))] shadow-[0_28px_90px_rgba(0,0,0,0.42)]"
        data-ode-ignore-shortcuts="true"
      >
        {canManageDirectory ? (
          <div className="w-[320px] shrink-0 border-r border-[var(--ode-border)] bg-[rgba(7,22,34,0.82)] p-5">
          <div className="text-[0.78rem] uppercase tracking-[0.2em] text-[var(--ode-accent)]">Users</div>
          <div className="mt-2 text-[1.35rem] font-semibold text-[var(--ode-text)]">Account Directory</div>
          <div className="mt-2 text-[0.92rem] leading-6 text-[var(--ode-text-muted)]">
            Create local users, assign ODE roles, and disable access when needed.
          </div>

          <button
            type="button"
            className="ode-primary-btn mt-5 h-10 w-full px-4"
            onClick={() => setSelectedUserId(NEW_USER_SENTINEL)}
            disabled={saving}
          >
            New User
          </button>

          <div className="mt-5 space-y-2 overflow-y-auto pr-1">
            {visibleUsers.map((user) => {
              const selected = user.userId === selectedUserId;
              return (
                <button
                  key={user.userId}
                  type="button"
                  className={`w-full rounded-[18px] border px-4 py-3 text-left transition ${
                    selected
                      ? "border-[var(--ode-border-accent)] bg-[rgba(8,55,86,0.42)]"
                      : "border-[var(--ode-border)] bg-[rgba(6,21,33,0.5)] hover:border-[rgba(120,164,198,0.36)]"
                  }`}
                  onClick={() => setSelectedUserId(user.userId)}
                  disabled={saving}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--ode-border)] bg-[rgba(10,48,73,0.64)] text-[0.82rem] font-semibold tracking-[0.08em] text-[var(--ode-text)]">
                      {user.profilePhotoDataUrl ? (
                        <img
                          src={user.profilePhotoDataUrl}
                          alt={user.displayName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        deriveUserProfileInitials(user.displayName)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-[var(--ode-text)]">{user.displayName}</span>
                        <span className="rounded-full border border-[var(--ode-border)] px-2 py-0.5 text-[0.72rem] uppercase tracking-[0.12em] text-[var(--ode-text-muted)]">
                          {user.role}
                        </span>
                      {user.isAdmin ? (
                          <span className="rounded-full border border-[rgba(148,203,183,0.32)] px-2 py-0.5 text-[0.68rem] uppercase tracking-[0.12em] text-[#bcefd8]">
                            Admin
                          </span>
                        ) : null}
                        {user.licenseStatus === "expired" ? (
                          <span className="rounded-full border border-[rgba(244,157,157,0.52)] px-2 py-0.5 text-[0.68rem] uppercase tracking-[0.12em] text-[#ffd5d5]">
                            Licence Expired
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-[0.84rem] text-[var(--ode-text-muted)]">@{user.username}</div>
                      <div className="mt-1 text-[0.78rem] text-[var(--ode-text-muted)]">
                        {formatLicensePlanLabel(user.licensePlan)} · {formatLicenseStatusLabel(user)}
                      </div>
                      {user.disabled ? (
                        <div className="mt-2 text-[0.76rem] uppercase tracking-[0.12em] text-[#ffc7c7]">
                          Disabled
                        </div>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[0.78rem] uppercase tracking-[0.18em] text-[var(--ode-accent)]">
                {profileOnlyMode ? "Profile Settings" : creatingNewUser ? "Create User" : "Edit User"}
              </div>
              <div className="mt-2 text-[1.45rem] font-semibold text-[var(--ode-text)]">
                {profileOnlyMode
                  ? selectedUser?.displayName ?? currentUserId ?? "My profile"
                  : creatingNewUser
                    ? "New local account"
                    : selectedUser?.displayName ?? "User account"}
              </div>
              <div className="mt-2 text-[0.92rem] leading-6 text-[var(--ode-text-muted)]">
                {profileOnlyMode
                  ? "Update your display name, profile photo, username, and password from one place."
                  : creatingNewUser
                  ? "Each user signs in locally and inherits access from the role assigned here."
                  : editingSelf
                    ? "You are editing your own account. Delete is disabled for safety."
                    : "Update profile, role, admin rights, and password as needed."}
              </div>
            </div>

            <button
              type="button"
              className="rounded-[14px] border border-[var(--ode-border)] px-4 py-2 text-[0.82rem] uppercase tracking-[0.12em] text-[var(--ode-text-muted)] transition hover:border-[var(--ode-border-accent)] hover:text-[var(--ode-text)]"
              onClick={onClose}
              disabled={saving}
            >
              Close
            </button>
          </div>

          {profileOnlyMode ? (
            <div className="mt-5 inline-flex w-fit rounded-[16px] border border-[var(--ode-border)] bg-[rgba(4,24,39,0.48)] p-1">
              <button
                type="button"
                className={`rounded-[12px] px-4 py-2 text-[0.78rem] font-semibold uppercase tracking-[0.1em] transition ${
                  activeProfileTab === "profile"
                    ? "bg-[rgba(12,77,117,0.44)] text-[var(--ode-accent)]"
                    : "text-[var(--ode-text-dim)] hover:text-[var(--ode-text)]"
                }`}
                onClick={() => setActiveProfileTab("profile")}
              >
                {t("profile.tab_profile")}
              </button>
              <button
                type="button"
                className={`rounded-[12px] px-4 py-2 text-[0.78rem] font-semibold uppercase tracking-[0.1em] transition ${
                  activeProfileTab === "ai_api"
                    ? "bg-[rgba(12,77,117,0.44)] text-[var(--ode-accent)]"
                    : "text-[var(--ode-text-dim)] hover:text-[var(--ode-text)]"
                }`}
                onClick={() => setActiveProfileTab("ai_api")}
              >
                {t("settings.api_setup")}
              </button>
            </div>
          ) : null}

          {activeProfileTab === "ai_api" ? (
            <div className="mt-6 space-y-5 rounded-[22px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.34)] px-5 py-5">
              <div>
                <div className="text-[0.82rem] uppercase tracking-[0.18em] text-[var(--ode-accent)]">
                  {t("settings.ai_provider_keys_title")}
                </div>
                <p className="mt-2 text-[0.9rem] leading-6 text-[var(--ode-text-muted)]">
                  {t("settings.security")}
                </p>
              </div>

              <div className="space-y-3">
                {providerKeys.map((entry, idx) => (
                  <div key={`profile-provider-key-${idx}`} className="flex items-center gap-2">
                    <span className="min-w-[8.5rem] rounded-xl border border-[var(--ode-border)] bg-[rgba(7,36,57,0.32)] px-3 py-3 text-center text-[0.78rem] font-medium text-[var(--ode-text-dim)]">
                      {entry.providerLabel}
                    </span>
                    <input
                      type="password"
                      value={entry.apiKey}
                      onChange={(event) => updateAiProviderKey(idx, event.target.value)}
                      className="ode-input h-12 w-full rounded-xl px-4"
                      placeholder={t("settings.ai_provider_placeholder", { index: idx + 1 })}
                    />
                    <button
                      type="button"
                      className="ode-icon-btn h-12 w-12"
                      onClick={() => updateAiProviderList(providerKeys.filter((_, itemIdx) => itemIdx !== idx))}
                    >
                      -
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="ode-action-btn h-12 w-full rounded-xl border border-dashed border-[var(--ode-border-accent)] text-[var(--ode-text-dim)]"
                onClick={() => updateAiProviderList([...providerKeys, createEmptyStoredAiProviderKey()])}
              >
                {t("settings.add_key")}
              </button>

              {aiApiMessage ? (
                <p className="rounded-xl border border-[var(--ode-border)] bg-[rgba(7,40,66,0.45)] px-4 py-2.5 text-sm text-[var(--ode-accent)]">
                  {aiApiMessage}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--ode-border)] pt-5">
                <button
                  type="button"
                  className="ode-secondary-btn h-11 px-5"
                  onClick={() => {
                    void testAiProviderKeys();
                  }}
                  disabled={isTestingAiKeys || isSavingAiKeys}
                >
                  {isTestingAiKeys ? t("settings.testing") : t("settings.test_keys")}
                </button>
                <button
                  type="button"
                  className="ode-primary-btn h-11 px-6"
                  onClick={() => {
                    void saveAiProviderKeys();
                  }}
                  disabled={isSavingAiKeys || isTestingAiKeys}
                >
                  {isSavingAiKeys ? t("settings.saving_keys") : t("settings.save")}
                </button>
              </div>
            </div>
          ) : (
            <>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2 rounded-[22px] border border-[var(--ode-border)] bg-[rgba(7,39,61,0.42)] px-5 py-5">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-[var(--ode-border-strong)] bg-[rgba(10,48,73,0.68)] text-[1.25rem] font-semibold tracking-[0.08em] text-[var(--ode-text)] shadow-[0_12px_30px_rgba(0,0,0,0.22)]">
                  {profilePhotoDataUrl ? (
                    <img src={profilePhotoDataUrl} alt={avatarLabel} className="h-full w-full object-cover" />
                  ) : (
                    avatarInitials
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[0.82rem] uppercase tracking-[0.18em] text-[var(--ode-accent)]">Profile Photo</div>
                  <div className="mt-2 text-[0.96rem] text-[var(--ode-text)]">
                    Show a real photo in the sidebar launcher and account directory.
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-[12px] border border-[var(--ode-border)] px-3 py-2 text-[0.76rem] uppercase tracking-[0.12em] text-[var(--ode-text-muted)] transition hover:border-[var(--ode-border-accent)] hover:text-[var(--ode-text)]">
                      <UploadGlyphSmall />
                      <span>{photoUploading ? "Loading..." : profilePhotoDataUrl ? "Change Photo" : "Add Photo"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          void handleProfilePhotoChange(event);
                        }}
                        disabled={saving || photoUploading}
                      />
                    </label>
                    {profilePhotoDataUrl ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-[12px] border border-[rgba(217,114,114,0.42)] px-3 py-2 text-[0.76rem] uppercase tracking-[0.12em] text-[#ffc7c7] transition hover:border-[rgba(244,157,157,0.72)] hover:text-[#fff0f0]"
                        onClick={() => setProfilePhotoDataUrl(null)}
                        disabled={saving || photoUploading}
                      >
                        <TrashGlyphSmall />
                        <span>Remove</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <label className="block">
              <div className="mb-2 text-[0.82rem] text-[var(--ode-text-muted)]">Display Name</div>
              <input
                className="ode-input h-11 w-full rounded-[16px] px-4"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                disabled={saving}
              />
            </label>

            <label className="block">
              <div className="mb-2 text-[0.82rem] text-[var(--ode-text-muted)]">Username</div>
              <input
                className="ode-input h-11 w-full rounded-[16px] px-4"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                disabled={saving}
              />
            </label>

            {canManageDirectory ? (
              <>
                <label className="block">
                  <div className="mb-2 text-[0.82rem] text-[var(--ode-text-muted)]">Role</div>
                  <select
                    className="ode-input h-11 w-full rounded-[16px] px-4"
                    value={role}
                    onChange={(event) => setRole(event.target.value as NodeAccessRole)}
                    disabled={saving}
                  >
                    {ACCESS_ROLE_VALUES.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <div className="mb-2 text-[0.82rem] text-[var(--ode-text-muted)]">Licence</div>
                  <select
                    className="ode-input h-11 w-full rounded-[16px] px-4"
                    value={licensePlan}
                    onChange={(event) => {
                      setLicensePlan(event.target.value as UserAccountLicensePlan);
                      if (event.target.value === "unlimited") {
                        setRestartLicenseFromNow(false);
                      }
                    }}
                    disabled={saving}
                  >
                    {LICENSE_PLAN_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-3 pt-7">
                  <label className="flex items-center gap-3 text-[0.92rem] text-[var(--ode-text)]">
                    <input
                      type="checkbox"
                      checked={isAdmin}
                      onChange={(event) => setIsAdmin(event.target.checked)}
                      disabled={saving}
                    />
                    <span>Administrator</span>
                  </label>
                  <label className="flex items-center gap-3 text-[0.92rem] text-[var(--ode-text)]">
                    <input
                      type="checkbox"
                      checked={disabled}
                      onChange={(event) => setDisabled(event.target.checked)}
                      disabled={saving || editingSelf}
                    />
                    <span>Disabled</span>
                  </label>
                  {!creatingNewUser && licensePlan !== "unlimited" ? (
                    <label className="flex items-center gap-3 text-[0.92rem] text-[var(--ode-text)]">
                      <input
                        type="checkbox"
                        checked={restartLicenseFromNow}
                        onChange={(event) => setRestartLicenseFromNow(event.target.checked)}
                        disabled={saving}
                      />
                      <span>Restart licence from now on save</span>
                    </label>
                  ) : null}
                </div>
              </>
            ) : null}

            <label className="block">
              <div className="mb-2 text-[0.82rem] text-[var(--ode-text-muted)]">
                {creatingNewUser ? "Password" : "New Password"}
              </div>
              <input
                className="ode-input h-11 w-full rounded-[16px] px-4"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={saving}
                autoComplete={creatingNewUser ? "new-password" : "off"}
              />
            </label>

            <label className="block">
              <div className="mb-2 text-[0.82rem] text-[var(--ode-text-muted)]">
                {creatingNewUser ? "Confirm Password" : "Confirm New Password"}
              </div>
              <input
                className="ode-input h-11 w-full rounded-[16px] px-4"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={saving}
                autoComplete={creatingNewUser ? "new-password" : "off"}
              />
            </label>
          </div>

          {selectedUser ? (
            <div className="mt-5 flex flex-wrap gap-3 text-[0.82rem] text-[var(--ode-text-muted)]">
              <span>{formatLicensePlanLabel(selectedUser.licensePlan)} licence</span>
              <span>{formatLicenseStatusLabel(selectedUser)}</span>
              <span>Created {new Date(selectedUser.createdAt).toLocaleString()}</span>
              <span>Updated {new Date(selectedUser.updatedAt).toLocaleString()}</span>
              {selectedUser.lastLoginAt ? (
                <span>Last login {new Date(selectedUser.lastLoginAt).toLocaleString()}</span>
              ) : (
                <span>No login yet</span>
              )}
            </div>
          ) : null}

          {resolvedError ? (
            <div className="mt-5 rounded-[18px] border border-[rgba(224,132,132,0.34)] bg-[rgba(91,28,28,0.4)] px-4 py-3 text-[0.92rem] text-[#ffd2d2]">
              {resolvedError}
            </div>
          ) : null}

          <div className="mt-auto flex justify-between gap-3 pt-8">
            <div>
              {canManageDirectory && !creatingNewUser && selectedUser ? (
                <button
                  type="button"
                  className="rounded-[14px] border border-[rgba(217,114,114,0.52)] bg-[rgba(83,26,26,0.32)] px-4 py-2 text-[0.82rem] uppercase tracking-[0.12em] text-[#ffc7c7] transition hover:border-[rgba(244,157,157,0.72)] hover:text-[#fff0f0] disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={requestDelete}
                  disabled={saving || editingSelf}
                >
                  Delete
                </button>
              ) : null}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                className="rounded-[14px] border border-[var(--ode-border)] px-4 py-2 text-[0.82rem] uppercase tracking-[0.12em] text-[var(--ode-text-muted)] transition hover:border-[var(--ode-border-accent)] hover:text-[var(--ode-text)]"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ode-primary-btn h-11 px-6 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={submit}
                disabled={saving}
              >
                {saving ? "Saving..." : profileOnlyMode ? "Save Profile" : creatingNewUser ? "Create User" : "Save Changes"}
              </button>
            </div>
          </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
