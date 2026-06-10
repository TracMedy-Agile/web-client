export type UserRole =
  'patient' | 'clinician' | 'hospital_admin' | 'tracmedy_admin';

export type UserStatus =
  'pending' | 'active' | 'locked' | 'suspended';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface SafeUser {
  id: string;
  email: string;
  phone: string | null;
  name: string | null;
  role: UserRole;
  status: UserStatus;
  timezone: string | null;
  locale: string | null;
  careIntent: string[];
  onboardingCompleted: boolean;
  loginLockedUntil: string | null;
  hospitalId: string | null;
  facilityId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: SafeUser;
}