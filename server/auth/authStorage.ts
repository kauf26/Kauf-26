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
