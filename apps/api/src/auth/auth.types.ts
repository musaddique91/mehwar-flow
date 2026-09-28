/** Identity attached to every authenticated request. All tenant data is scoped by organizationId. */
export interface AuthContext {
  userId: string;
  organizationId: string;
}

export interface AccessTokenPayload {
  sub: string;
  org: string;
}
