export type AuthSource = 'social-stub' | 'cognito';
export type Role = 'patient' | 'researcher' | 'admin' | 'caregiver';

export type AuthContext = {
  userId: string;
  role: Role;
  sessionId?: string;
  issuedAt?: number;
  expiresAt?: number;
  source: AuthSource;
};

declare global {
  namespace Express {
    interface Request {
      authContext?: AuthContext;
    }
  }
}
