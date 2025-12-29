import { Request } from 'express';
import { AuthContext } from './types';

export interface AuthAdapter {
  resolve(req: Request): Promise<AuthContext>;
}
