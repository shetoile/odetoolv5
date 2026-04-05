import type { NodeAccessRole } from "@/features/workspace/accessControl";
import { callNative } from "@/lib/tauriApi";

export type UserAccountLicensePlan = "unlimited" | "daily" | "weekly" | "monthly" | "yearly";

export interface RememberedUserAccountSessionInput {
  durationMs: number;
}

export interface UserAccountSummary {
  userId: string;
  username: string;
  displayName: string;
  profilePhotoDataUrl: string | null;
  role: NodeAccessRole;
  isAdmin: boolean;
  disabled: boolean;
  licensePlan: UserAccountLicensePlan;
  licenseStartedAt: number | null;
  licenseExpiresAt: number | null;
  licenseStatus: "active" | "expired" | "unlimited";
  createdAt: number;
  updatedAt: number;
  lastLoginAt: number | null;
}

export interface UserAccountState {
  hasUsers: boolean;
  users: UserAccountSummary[];
}

export interface BootstrapUserAccountInput {
  username: string;
  displayName: string;
  password: string;
  rememberSession?: RememberedUserAccountSessionInput | null;
}

export interface SignInUserAccountInput {
  username: string;
  password: string;
  rememberSession?: RememberedUserAccountSessionInput | null;
}

export interface CreateUserAccountInput {
  username: string;
  displayName: string;
  password: string;
  role: NodeAccessRole;
  isAdmin: boolean;
  profilePhotoDataUrl?: string | null;
  licensePlan: UserAccountLicensePlan;
}

export interface UpdateUserAccountInput {
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
}

export interface UserAccountAuthResult {
  user: UserAccountSummary;
  rememberedSessionToken: string | null;
  rememberedSessionExpiresAt: number | null;
}

export async function getUserAccountState(): Promise<UserAccountState> {
  return callNative<UserAccountState>("get_user_account_state");
}

export async function bootstrapUserAccount(
  input: BootstrapUserAccountInput
): Promise<UserAccountAuthResult> {
  return callNative<UserAccountAuthResult>("bootstrap_user_account", { input });
}

export async function signInUserAccount(
  input: SignInUserAccountInput
): Promise<UserAccountAuthResult> {
  return callNative<UserAccountAuthResult>("sign_in_user_account", { input });
}

export async function resumeUserAccountSession(sessionToken: string): Promise<UserAccountAuthResult> {
  return callNative<UserAccountAuthResult>("resume_user_account_session", { sessionToken });
}

export async function revokeUserAccountSession(sessionToken: string): Promise<void> {
  await callNative("revoke_user_account_session", { sessionToken });
}

export async function createUserAccount(
  input: CreateUserAccountInput
): Promise<UserAccountSummary> {
  return callNative<UserAccountSummary>("create_user_account", { input });
}

export async function updateUserAccount(
  input: UpdateUserAccountInput
): Promise<UserAccountSummary> {
  return callNative<UserAccountSummary>("update_user_account", { input });
}

export async function deleteUserAccount(userId: string): Promise<void> {
  await callNative("delete_user_account", { userId });
}
