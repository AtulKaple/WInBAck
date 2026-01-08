// Public API of Consent Module

export { ConsentService } from "./services/ConsentService";
export { requireActiveConsent } from "./middleware/requireConsent";

export {
  CONSENT_STATES,
  MODULES,
  PURPOSES,
  ROLES,
  ERROR_CODES
} from "./constants/consent.constants";
