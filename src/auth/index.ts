import { Request, Response, NextFunction } from 'express';
// import { SocialStubAdapter } from './socialStubAdapter';
import { AuthAdapter } from './adapter';
import { AuthContext } from './types';
import { CognitoAdapter } from './cognitoAdapter';
declare global {
  namespace Express {
    interface Request {
      user?: any;
      authContext?: AuthContext;
    }
  }
}

const adapter: AuthAdapter = new CognitoAdapter();

// const REGION = "eu-north-1";
// const USER_POOL_ID = "eu-north-1_KuyQbTUYS";
// const CLIENT_ID = "7r3c50ct47vq5b32liopvhpai4";

// export const jwks = jwksClient({
//   jwksUri: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`,
// });

// const getKey = (header: any, cb: any) => {
//   jwks.getSigningKey(header.kid, (err, key) => {
//     cb(null, key?.getPublicKey());
//   });
// };

// export const verifyJWT = (req: Request, res: Response, next: NextFunction) => {
//   const token = req.headers.authorization?.split(" ")[1];
//   if (!token) return res.sendStatus(401);

//   jwt.verify(
//     token,
//     getKey,
//     {
//       audience: CLIENT_ID,
//       issuer: `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`,
//       algorithms: ["RS256"],
//     },
//     (err, decoded) => {
//       if (err) return res.sendStatus(401);
//       req.user = decoded;
//       next();
//     }
//   );
// };

export async function resolveAuthContext(req: Request, res: Response, next: NextFunction) {
  try {
    const ctx = await adapter.resolve(req);
    req.authContext = ctx;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

export function requireAuthContext(req: Request, res: Response, next: NextFunction) {
  if (!req.authContext) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

export { AuthContext } from './types';
