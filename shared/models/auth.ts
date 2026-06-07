export type AuthUser = {
  id: number;
  sub: string;
  email?: string | null;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  oauthProvider?: string | null;
  onboardingCompleted: boolean;
  isNew?: boolean;
  needsOnboarding: boolean;
};

export type OnboardingStatus = {
  needsWizard: boolean;
  onboardingCompleted: boolean;
  connectedMarketplaces: string[];
  availableMarketplaces: Array<{ id: string; name: string }>;
};
