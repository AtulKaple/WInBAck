import { Request } from 'express';
import { CognitoJwtVerifier } from "aws-jwt-verify";
import { AuthContext, AuthSource } from './types';
import { AuthAdapter } from './adapter';

// 1. Define the verifier type but don't create it yet
let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

// 2. Helper to get or create the verifier (Singleton pattern)
function getVerifier() {
  if (!verifier) {
    // Safety check: ensure variables exist before crashing
    if (!process.env.COGNITO_USER_POOL_ID || !process.env.COGNITO_CLIENT_ID) {
      throw new Error("Missing COGNITO_USER_POOL_ID or COGNITO_CLIENT_ID in environment variables");
    }


    verifier = CognitoJwtVerifier.create({
      userPoolId: process.env.COGNITO_USER_POOL_ID,
      tokenUse: "access",
      clientId: process.env.COGNITO_CLIENT_ID,
    });
  }
  return verifier;
}

export class CognitoAdapter implements AuthAdapter {
  async resolve(req: Request): Promise<AuthContext> {
    try {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.replace("Bearer ", "").trim();


      if (!token) {
        throw new Error("No token provided");
      }

      // 3. Call getVerifier() here instead of using a global variable
      const payload = await getVerifier().verify(token);

      const groups = payload["cognito:groups"] || [];
      const allowedRoles = ["patient", "researcher", "admin"] as const;
      
      const role = groups.find((g) => allowedRoles.includes(g as any));

      if (!role) {
        throw new Error("User does not have a valid role");
      }

      return {
        userId: payload.sub,
        role: role as any,
        sessionId: "xxx", // Cognito handles sessions, we just verify the token
        issuedAt: payload.iat,
        expiresAt: payload.exp,
        source: "aws-cognito" as AuthSource,
      };
    } catch (err) {
      console.error("Auth Verification Failed:", err);
      // It is often safer to return null or throw depending on your middleware strategy
      throw new Error("Unauthorized");
    }
  }
}