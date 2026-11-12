// B2B Registration API client. Creates a fresh, real player via the platform's
// back-office/registration endpoint so authenticated tests run against a
// player that was created by automation (instead of a shared .env account).
//
// Contract (verified against the platform's curl):
//   POST ${TEST_API_URL}
//   Authorization: ${B2B_AUTH}      (raw token, NO "Bearer" prefix)
//   PartnerId:     <partner.centrivoId>
//
// The payload is the platform's Client/Register body. Partner-specific static
// values (centrivoId) come from src/config/partners.js; per-partner dynamic
// identity values (username, email, mobile, currency, password) come from
// tests/data/registerData.js so a new partner only adds an entry there. The
// remaining constants below are verbatim from the platform's own request.
//
// Fail-hard: a missing token/URL or a non-2xx response throws, so the auth
// setup test fails and every dependent project is skipped (never a silent
// fallback to another account).

import { PARTNERS } from '../config/partners.js';
import { buildRegisterData } from '#data/registerData.js';

/** Fields that carry over unchanged from the platform's reference request. */
const STATIC_PAYLOAD = {
  Id: 0,
  IsEmailVerified: false,
  CountryId: 257,
  RegionId: null,
  Gender: 1,
  BirthDate: '1994-09-28T00:00:00',
  MiddleName: null,
  PhoneNumber: null,
  DocumentIssuedBy: null,
  Address: null,
  utm_source: 'hello',
  IsMobileVerified: false,
  LanguageId: 'HY',
  PromoCode: null,
  SecurityQuestionId: null,
  SecurityAnswer: null,
  SessionId: 0,
  CreationTime: '0001-01-01T00:00:00',
  LastUpdateTime: '0001-01-01T00:00:00',
  SecurityQestionText: null,
  Token: null,
  EmailOrMobile: null,
  SendMail: true,
  SendSms: true,
  CallToPhone: false,
  SendPromotions: false,
  InformedFrom: null,
  IsDocumentVerified: false,
  CategoryId: null,
  ZipCode: null,
  Info: null,
  Lang: null,
  Btag: 'testAutomationPlayer',
  SportClinetId: 0,
  SocialNetworkId: 0,
  ReferralId: 0,
  LineId: null,
  CpfNumber: null,
  DocumentType: 8,
  AddressLine2: null,
  AddressLine3: null,
  RegionState: null,
  ProvisionCode: null,
  OddDisplay: null,
  DepositInfo: null,
  MigratedClientId: null,
  PasswordSalt: 0,
  BetshopId: null,
  UserAgentString:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
  PaymentCategoryId: null,
  RegistrationCountryId: null,
  RegistrationCountryIsoCode: null,
  DepositLimitPeriodType: 0,
  DepositLimitAmount: 0,
  SecondName: null,
  SecondSurname: null,
  NationalityId: 0,
  ProvinceId: 0,
  DeviceType: 1,
  IsAutoRegistrated: false,
  SportCategoryId: 0,
  InternalAgentId: 0,
  IsBetShopVerified: null,
  RegCategoryType: 1,
  IsFromMobileApp: false,
  CaptchaId: null,
  CaptchaText: null,
};

/** Prefix marking automation-created players for later clean-up. */
const PLAYER_NAME_PREFIX = 'TEST_FE_AUTOMATION_NEED_TO_DELETE';

/** Current datetime as YYYYMMDDHHmmss, used to keep generated names unique. */
function datetimeStamp() {
  const d = new Date();
  const p = (n, len = 2) => String(n).padStart(len, '0');
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

/**
 * Build the full Client/Register payload for a partner.
 *
 * @param {string} partnerId
 * @param {object} partner
 * @param {object} data      per-partner identity data (tests/data/registerData.js)
 * @param {string} domain    partner site hostname for the active environment
 *                           (used for CurrentURL/Domain instead of a hardcoded host)
 */
export function buildRegisterPayload(partnerId, partner, data, domain) {
  const marker = `${PLAYER_NAME_PREFIX}-${datetimeStamp()}`;
  return {
    ...STATIC_PAYLOAD,
    RegistrationIp: null,
    UniqueIdentificatificator: crypto.randomUUID(),
    UserName: data.username,
    Email: data.email,
    MobileNumber: data.mobile,
    DocumentNumber: data.username,
    CurrencyId: data.currency,
    Password: data.password,
    IsEmailVerified: data.isEmailVerified ?? false,
    PartnerId: partner.centrivoId,
    FirstName: marker,
    LastName: marker,
    // Environment-specific site host (test vs prod).
    CurrentURL: domain,
    Domain: domain,
    ...(data.SocialCardNumber ? { SocialCardNumber: data.SocialCardNumber } : {}),
  };
}

/** Registration endpoint path appended to the configured API base URL. */
const REGISTER_PATH = '/Client/Register';

/** Join the API base URL with the register path (idempotent). */
function registerEndpoint(baseUrl) {
  const base = baseUrl.replace(/\/+$/, '');
  return base.endsWith(REGISTER_PATH) ? base : `${base}${REGISTER_PATH}`;
}

/**
 * Resolve the registration API URL + B2B token for an environment.
 *   test → TEST_API_URL / B2B_AUTH
 *   prod → PROD_API_URL / PROD_B2B_AUTH
 * Each env can also override with <ENV>_API_URL / <ENV>_B2B_AUTH.
 */
function resolveApiCredentials(envName) {
  const env = envName.toUpperCase();
  const apiUrl =
    process.env[`${env}_API_URL`] || (envName === 'test' ? process.env.TEST_API_URL : undefined);
  const token =
    process.env[`${env}_B2B_AUTH`] || (envName === 'test' ? process.env.B2B_AUTH : undefined);

  if (!apiUrl) {
    throw new Error(
      `Missing ${env}_API_URL for the registration API (${envName}). ` +
        `Set it in .env (e.g. PROD_API_URL for production).`,
    );
  }
  if (!token) {
    throw new Error(
      `Missing ${env}_B2B_AUTH for the registration API (${envName}). ` +
        `Set it in .env (e.g. PROD_B2B_AUTH for production).`,
    );
  }
  return { apiUrl, token };
}

/**
 * Register a fresh player for the given partner/environment/device.
 *
 * @param {{ partnerId: string, envName: string, device: string }} params
 * @returns {Promise<{ username: string, password: string, partnerId: string, envName: string, device: string, response: any }>}
 */
export async function registerPlayer({ partnerId, envName, device }) {
  const { apiUrl, token } = resolveApiCredentials(envName);

  const partner = PARTNERS[partnerId];
  if (!partner) throw new Error(`Unknown partner "${partnerId}" for the registration API.`);
  if (partner.centrivoId === undefined) {
    throw new Error(`Partner "${partnerId}" has no centrivoId configured in src/config/partners.js.`);
  }

  const partnerEnv = partner.envs?.[envName];
  if (!partnerEnv?.baseURL) {
    throw new Error(
      `No baseURL for partner "${partnerId}" env "${envName}" (needed for registration).`,
    );
  }
  const domain = new URL(partnerEnv.baseURL).hostname;

  const data = buildRegisterData(partnerId);
  const payload = buildRegisterPayload(partnerId, partner, data, domain);

  const res = await fetch(registerEndpoint(apiUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'accept-language': 'en',
      TimeZone: '4',
      Authorization: token,
      PartnerId: String(partner.centrivoId),
    },
    body: JSON.stringify(payload),
  });

  const raw = await res.text();
  let response;
  try {
    response = raw ? JSON.parse(raw) : null;
  } catch {
    response = raw;
  }

  if (!res.ok) {
    throw new Error(
      `Registration API failed for ${partnerId} [${envName}] (${res.status} ${res.statusText}): ${raw}`,
    );
  }

  // The API signals logical failures with HTTP 200 + a non-zero ResponseCode
  // (e.g. {"ResponseCode":-1,"ErrorObject":[{"Message":"WrongCurrencyId"}]}).
  // Treat that as a hard failure so the setup test fails and dependent projects
  // are skipped — never proceed to log in with a player that was not created.
  if (response && typeof response.ResponseCode === 'number' && response.ResponseCode !== 0) {
    const detail = Array.isArray(response.ErrorObject)
      ? response.ErrorObject.map((e) => e.Message ?? JSON.stringify(e)).join('; ')
      : JSON.stringify(response.ErrorObject);
    throw new Error(
      `Registration API rejected the player for ${partnerId} [${envName}] ` +
        `(ResponseCode ${response.ResponseCode}): ${detail || raw}`,
    );
  }

  console.log(
    `[registerApi] created player "${data.username}" for ${partnerId} [${envName}] · ${device}: ${raw}`,
  );

  return {
    username: data.username,
    password: data.password,
    partnerId,
    envName,
    device,
    response,
  };
}

export default registerPlayer;
