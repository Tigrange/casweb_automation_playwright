// B2B Registration API client. Creates a fresh, real player via the platform's
// back-office/registration endpoint so authenticated tests run against a
// player that was created by automation (instead of a shared .env account).
//
// Contract (verified against the platform's curl):
//   POST ${TEST_API_URL}
//   Authorization: ${B2B_AUTH}      (raw token, NO "Bearer" prefix)
//   PartnerId:     <partner.CentrivoId>
//
// The payload is the platform's Client/Register body. Partner-specific static
// values (CentrivoId) come from src/config/partners.js; per-partner dynamic
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
  CurrentURL: 'playintest.tst-digi.com',
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
  Domain: 'playintest.tst-digi.com',
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

/** Build the full Client/Register payload for a partner. */
export function buildRegisterPayload(partnerId, partner, data) {
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
    PartnerId: partner.CentrivoId,
    FirstName: marker,
    LastName: marker,
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
 * Register a fresh player for the given partner/environment/device.
 *
 * @param {{ partnerId: string, envName: string, device: string }} params
 * @returns {Promise<{ username: string, password: string, partnerId: string, envName: string, device: string, response: any }>}
 */
export async function registerPlayer({ partnerId, envName, device }) {
  const apiUrl = process.env.TEST_API_URL;
  const token = process.env.B2B_AUTH;
  if (!apiUrl) throw new Error('Missing TEST_API_URL for the registration API.');
  if (!token) throw new Error('Missing B2B_AUTH for the registration API.');

  const partner = PARTNERS[partnerId];
  if (!partner) throw new Error(`Unknown partner "${partnerId}" for the registration API.`);
  if (partner.CentrivoId === undefined) {
    throw new Error(`Partner "${partnerId}" has no CentrivoId configured in src/config/partners.js.`);
  }

  const data = buildRegisterData(partnerId);
  const payload = buildRegisterPayload(partnerId, partner, data);

  const res = await fetch(registerEndpoint(apiUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'accept-language': 'en',
      TimeZone: '4',
      Authorization: token,
      PartnerId: String(partner.CentrivoId),
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
