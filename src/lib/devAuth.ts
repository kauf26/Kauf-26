import { queryClient } from "./queryClient";

export async function fetchDevLoginEnabled(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/dev-login/enabled");
    if (!res.ok) return false;
    const data = (await res.json()) as { enabled?: boolean };
    return data.enabled === true;
  } catch {
    return false;
  }
}

export async function devLoginWithPin(pin: string): Promise<void> {
  const res = await fetch("/api/auth/dev-login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  const data = (await res.json()) as { message?: string };
  if (!res.ok) {
    throw new Error(data.message ?? "Dev login failed");
  }
  await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
}
