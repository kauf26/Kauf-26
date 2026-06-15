import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { users, type User } from "@shared/schema";
import { db } from "../db";
import type { OAuthProvider } from "./types";

export type UpsertOAuthUserInput = {
  sub: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  provider: OAuthProvider;
};

export async function upsertOAuthUser(
  input: UpsertOAuthUserInput
): Promise<{ user: User; isNew: boolean }> {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.sub, input.sub))
    .limit(1);

  if (existing) {
    const updates: Partial<typeof users.$inferInsert> = {};
    if (input.email && !existing.email) updates.email = input.email;
    if (input.firstName && !existing.firstName) updates.firstName = input.firstName;
    if (input.lastName && !existing.lastName) updates.lastName = input.lastName;
    if (input.profileImageUrl && !existing.profileImageUrl) {
      updates.profileImageUrl = input.profileImageUrl;
    }

    if (Object.keys(updates).length > 0) {
      const [updated] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, existing.id))
        .returning();
      return { user: updated ?? existing, isNew: false };
    }

    return { user: existing, isNew: false };
  }

  const usernameBase = input.email ?? input.sub;
  let username = usernameBase;
  let suffix = 0;
  while (true) {
    const [collision] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    if (!collision) break;
    suffix += 1;
    username = `${usernameBase}_${suffix}`;
  }

  const [user] = await db
    .insert(users)
    .values({
      sub: input.sub,
      username,
      email: input.email,
      password: randomBytes(32).toString("hex"),
      oauthProvider: input.provider,
      firstName: input.firstName,
      lastName: input.lastName,
      profileImageUrl: input.profileImageUrl,
      onboardingCompleted: false,
    })
    .returning();

  return { user, isNew: true };
}

export async function getUserById(id: number): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user;
}

export async function completeOnboarding(userId: number): Promise<User> {
  const [user] = await db
    .update(users)
    .set({ onboardingCompleted: true })
    .where(eq(users.id, userId))
    .returning();
  if (!user) throw new Error("User not found");
  return user;
}

export type UpdateUserProfileInput = {
  name?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
};

function splitDisplayName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

export async function updateUserProfile(
  userId: number,
  input: UpdateUserProfileInput
): Promise<User> {
  const updates: Partial<typeof users.$inferInsert> = {};

  if (input.email?.trim()) {
    updates.email = input.email.trim();
  }

  if (input.firstName?.trim() || input.lastName?.trim()) {
    if (input.firstName?.trim()) updates.firstName = input.firstName.trim();
    if (input.lastName?.trim()) updates.lastName = input.lastName.trim();
  } else if (input.name?.trim()) {
    const { firstName, lastName } = splitDisplayName(input.name);
    if (firstName) updates.firstName = firstName;
    if (lastName) updates.lastName = lastName;
  }

  if (Object.keys(updates).length === 0) {
    const existing = await getUserById(userId);
    if (!existing) throw new Error("User not found");
    return existing;
  }

  const [user] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, userId))
    .returning();

  if (!user) throw new Error("User not found");
  return user;
}

/** Permanently delete account; FK cascades remove drafts and related rows. */
export async function deleteAccountByUserId(userId: number): Promise<void> {
  const existing = await getUserById(userId);
  if (!existing) throw new Error("User not found");
  await db.delete(users).where(eq(users.id, userId));
}
