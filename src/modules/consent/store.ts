import path from 'path';
import { secureReadAll, secureWrite } from '../../security/secureWrite';
import { Consent } from './types';

export const CONSENT_STORE_PATH = path.join(__dirname, '..', '..', 'data', 'consents.json');

export class ConsentStore {
  async read(): Promise<Consent[]> {
    return secureReadAll<Consent>(CONSENT_STORE_PATH);
  }

  async append(consent: Consent, actor: { userId?: string; role?: string }) {
    await secureWrite({
      filePath: CONSENT_STORE_PATH,
      record: consent,
      auditMeta: {
        action: 'consent.write',
        actorUserId: actor.userId,
        actorRole: actor.role,
        resourceType: 'Consent',
        resourceId: consent.id,
      },
    });
  }
}
