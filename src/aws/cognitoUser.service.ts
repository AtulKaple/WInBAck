
import {
  AdminGetUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { cognitoClient } from "./cognito";

export async function getCognitoUserEmail(userId: string): Promise<string | null> {
  try {
    const res = await cognitoClient.send(
      new AdminGetUserCommand({
        UserPoolId: process.env.COGNITO_USER_POOL_ID!,
        Username: userId, // 👈 payload.sub
      })
    );

    const emailAttr = res.UserAttributes?.find(
      (a) => a.Name === "email"
    );

    return emailAttr?.Value || null;
  } catch (err) {
    console.error("Failed to fetch Cognito user:", err);
    return null;
  }
}
