export type UserRole = 'admin' | 'moderator';
export type UserStatus = 'pending' | 'active' | 'deactivated';

export interface AuthUser {
  id: number;
  username: string;
  role: UserRole;
  status: UserStatus;
}

export interface RegisterRequest {
  username: string;
  password: string;
}

export interface RegisterResponse {
  status: 'pending';
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: AuthUser;
}

export interface MeResponse {
  user: AuthUser;
}

export interface ApproveUserRequest {
  role: UserRole;
}

export interface UserListItem extends AuthUser {
  createdAt: string;
}

export interface UsersListedPayload {
  pending: UserListItem[];
  active: UserListItem[];
  deactivated: UserListItem[];
}
