import type { AddressJson, PackageDetailsJson } from "./shippingLabelPdf";

export type ShippingRateQuote = {
  rateId: string;
  carrier: string;
  service: string;
  price: number;
  currency: string;
  /** @deprecated Prefer deliveryDays — kept for backward compatibility */
  etaDays: number;
  deliveryDays: string;
  deliveryDate?: string;
  source: "live" | "mock";
};

export type ShippingRatesResponse = {
  rates: ShippingRateQuote[];
  source: "live" | "mixed" | "mock";
  distanceMiles: number | null;
  isInternational: boolean;
  billableWeightLbs: number;
  currency: string;
  shipDate: string;
  shipDateLabel: string;
};

export type RateQuoteInput = {
  fromAddress?: AddressJson;
  toAddress?: AddressJson;
  packageDetails?: PackageDetailsJson & { weightOz?: number };
  weightLbs?: number;
  weightOz?: number;
};

type GeoPoint = { lat: number; lon: number };

const geocodeCache = new Map<string, GeoPoint | null>();
let fedexTokenState: { token: string; expiresAt: number } | null = null;

function normalizeCountry(country?: string): string {
  const raw = (country ?? "US").trim().toUpperCase();
  if (raw === "USA" || raw === "UNITED STATES") return "US";
  return raw.slice(0, 2);
}

function normalizeAddress(
  input: AddressJson | undefined,
  fallback: AddressJson
): AddressJson {
  return {
    name: input?.name ?? fallback.name,
    line1: input?.line1 ?? fallback.line1,
    line2: input?.line2,
    city: input?.city ?? fallback.city,
    state: input?.state ?? fallback.state,
    postalCode: input?.postalCode ?? fallback.postalCode,
    country: normalizeCountry(input?.country ?? fallback.country),
  };
}

export function defaultFromAddress(): AddressJson {
  return {
    name: process.env.SHIPPING_FROM_NAME ?? "KAUF26 Seller",
    line1: process.env.SHIPPING_FROM_LINE1 ?? "123 Warehouse Rd",
    city: process.env.SHIPPING_FROM_CITY ?? "Los Angeles",
    state: process.env.SHIPPING_FROM_STATE ?? "CA",
    postalCode: process.env.SHIPPING_FROM_ZIP ?? "90001",
    country: "US",
  };
}

function parseWeightLbs(input: RateQuoteInput): number {
  const pkg = input.packageDetails ?? {};
  const lbs = Number(input.weightLbs ?? pkg.weightLbs ?? 1);
  const oz = Number(input.weightOz ?? pkg.weightOz ?? 0);
  const total = (Number.isFinite(lbs) ? lbs : 1) + (Number.isFinite(oz) ? oz : 0) / 16;
  return Math.max(0.1, Math.round(total * 100) / 100);
}

function parseDimensions(input: RateQuoteInput): PackageDetailsJson {
  const pkg = input.packageDetails ?? {};
  return {
    weightLbs: parseWeightLbs(input),
    lengthIn: Math.max(1, Number(pkg.lengthIn ?? 10) || 10),
    widthIn: Math.max(1, Number(pkg.widthIn ?? 10) || 10),
    heightIn: Math.max(1, Number(pkg.heightIn ?? 10) || 10),
  };
}

export function billableWeightLbs(
  weightLbs: number,
  dims: PackageDetailsJson
): number {
  const length = dims.lengthIn ?? 10;
  const width = dims.widthIn ?? 10;
  const height = dims.heightIn ?? 10;
  const dimWeight = (length * width * height) / 139;
  return Math.max(weightLbs, dimWeight);
}

function isInternationalShipment(from: AddressJson, to: AddressJson): boolean {
  return normalizeCountry(from.country) !== normalizeCountry(to.country);
}

function haversineMiles(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

async function geocodePostal(
  postalCode: string,
  country: string
): Promise<GeoPoint | null> {
  const zip = postalCode.trim().slice(0, 10);
  if (!zip) return null;
  const cc = normalizeCountry(country);
  const cacheKey = `${cc}:${zip}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey) ?? null;
  }

  try {
    const params = new URLSearchParams({
      postalcode: zip,
      countrycodes: cc.toLowerCase(),
      format: "json",
      limit: "1",
    });
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "Kauf26-Shipping/1.0 (support@kauf26.local)",
        },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) {
      geocodeCache.set(cacheKey, null);
      return null;
    }
    const rows = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    const hit = rows[0];
    if (!hit?.lat || !hit?.lon) {
      geocodeCache.set(cacheKey, null);
      return null;
    }
    const point = { lat: Number(hit.lat), lon: Number(hit.lon) };
    geocodeCache.set(cacheKey, point);
    return point;
  } catch {
    geocodeCache.set(cacheKey, null);
    return null;
  }
}

async function estimateDistanceMiles(
  from: AddressJson,
  to: AddressJson
): Promise<number | null> {
  const fromZip = from.postalCode?.trim();
  const toZip = to.postalCode?.trim();
  if (!fromZip || !toZip) return null;

  const [fromPoint, toPoint] = await Promise.all([
    geocodePostal(fromZip, from.country ?? "US"),
    geocodePostal(toZip, to.country ?? "US"),
  ]);

  if (!fromPoint || !toPoint) {
    if (fromZip.slice(0, 3) === toZip.slice(0, 3)) return 150;
    if (from.state && to.state && from.state === to.state) return 350;
    return 1200;
  }

  return Math.round(haversineMiles(fromPoint, toPoint));
}

function distanceSurcharge(distanceMiles: number | null): number {
  if (distanceMiles == null) return 2;
  if (distanceMiles <= 300) return 0;
  if (distanceMiles <= 800) return (distanceMiles - 300) * 0.004;
  return 2 + (distanceMiles - 800) * 0.006;
}

function makeRateId(
  carrier: string,
  service: string,
  price: number,
  externalId?: string
): string {
  if (externalId) return externalId;
  return `${carrier}-${service}-${price}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}

function fixedUSHolidays(year: number): Set<string> {
  return new Set([
    `${year}-01-01`,
    `${year}-06-19`,
    `${year}-07-04`,
    `${year}-11-11`,
    `${year}-12-25`,
  ]);
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function isUSHoliday(date: Date): boolean {
  return fixedUSHolidays(date.getFullYear()).has(
    date.toISOString().slice(0, 10)
  );
}

function isBusinessDay(date: Date): boolean {
  return !isWeekend(date) && !isUSHoliday(date);
}

/** Next business day after today (ships tomorrow if weekday). */
export function getNextBusinessShipDate(from = new Date()): Date {
  const ship = new Date(from);
  ship.setHours(12, 0, 0, 0);
  ship.setDate(ship.getDate() + 1);
  while (!isBusinessDay(ship)) {
    ship.setDate(ship.getDate() + 1);
  }
  return ship;
}

function addBusinessDays(start: Date, days: number): Date {
  const result = new Date(start);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result)) added++;
  }
  return result;
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatShipDateLabel(shipDate: Date): string {
  const tomorrow = new Date();
  tomorrow.setHours(12, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (
    shipDate.toDateString() === tomorrow.toDateString() &&
    isBusinessDay(tomorrow)
  ) {
    return "Ships tomorrow";
  }
  return `Ships ${formatShortDate(shipDate)}`;
}

function formatDeliveryDaysRange(minDays: number, maxDays: number): string {
  if (minDays === maxDays) {
    return minDays === 1 ? "1 business day" : `${minDays} business days`;
  }
  return `${minDays}-${maxDays} business days`;
}

type TransitEstimate = { minDays: number; maxDays: number };

function estimateTransitDays(input: {
  carrier: string;
  service: string;
  distanceMiles: number | null;
  isInternational: boolean;
}): TransitEstimate {
  const { carrier, service, distanceMiles, isInternational } = input;
  const svc = service.toLowerCase();
  const carrierLower = carrier.toLowerCase();
  const longDistance = (distanceMiles ?? 0) > 1000;
  const lowerBump = longDistance ? 1 : 0;
  const upperBump = longDistance ? 2 : 0;

  if (isInternational) {
    const base = 7 + (longDistance ? 5 : 0);
    return { minDays: base, maxDays: base + 8 };
  }

  if (svc.includes("overnight") || svc.includes("next day")) {
    return { minDays: 1, maxDays: 1 };
  }
  if (
    svc.includes("2day") ||
    svc.includes("2-day") ||
    svc.includes("2 day") ||
    svc === "fedex 2day"
  ) {
    return { minDays: 2, maxDays: 2 };
  }
  if (carrierLower.includes("usps") && svc.includes("priority")) {
    return { minDays: 1 + lowerBump, maxDays: 3 + upperBump };
  }
  if (
    svc.includes("ground advantage") ||
    (carrierLower.includes("usps") && svc.includes("ground"))
  ) {
    return { minDays: 2 + lowerBump, maxDays: 5 + upperBump };
  }
  if (carrierLower.includes("ups") && svc.includes("ground")) {
    return { minDays: 1 + lowerBump, maxDays: 5 + upperBump };
  }
  if (
    svc.includes("home delivery") ||
    (carrierLower.includes("fedex") && svc.includes("ground"))
  ) {
    return { minDays: 2 + lowerBump, maxDays: 5 + upperBump };
  }
  if (svc.includes("express") || svc.includes("priority")) {
    return { minDays: 1 + lowerBump, maxDays: 3 + upperBump };
  }
  return { minDays: 2 + lowerBump, maxDays: 5 + upperBump };
}

type DeliveryEnrichmentContext = {
  shipDate: Date;
  distanceMiles: number | null;
  isInternational: boolean;
};

type ApiDeliveryHint = {
  days?: number;
  commitmentDate?: string;
};

type RawRateQuote = {
  rateId: string;
  carrier: string;
  service: string;
  price: number;
  currency: string;
  source: "live" | "mock";
  apiDelivery?: ApiDeliveryHint;
};

function finalizeRateQuote(
  partial: {
    rateId: string;
    carrier: string;
    service: string;
    price: number;
    currency: string;
    source: "live" | "mock";
    etaDays?: number;
    deliveryDays?: string;
    deliveryDate?: string;
  },
  ctx: DeliveryEnrichmentContext,
  apiHint?: ApiDeliveryHint
): ShippingRateQuote {
  let minDays: number;
  let maxDays: number;
  let deliveryDays: string;
  let deliveryDate: string | undefined;

  if (apiHint?.commitmentDate) {
    const arrive = new Date(apiHint.commitmentDate);
    deliveryDate = arrive.toISOString();
    deliveryDays = `Arrives by ${formatShortDate(arrive)}`;
    const transit = estimateTransitDays({
      carrier: partial.carrier,
      service: partial.service,
      distanceMiles: ctx.distanceMiles,
      isInternational: ctx.isInternational,
    });
    minDays = apiHint.days ?? transit.minDays;
    maxDays = apiHint.days ?? transit.maxDays;
  } else if (apiHint?.days != null && apiHint.days > 0) {
    maxDays = Math.round(apiHint.days);
    minDays = Math.max(1, maxDays - 1);
    deliveryDays = formatDeliveryDaysRange(minDays, maxDays);
    deliveryDate = addBusinessDays(ctx.shipDate, maxDays).toISOString();
  } else if (partial.deliveryDays && partial.deliveryDate) {
    deliveryDays = partial.deliveryDays;
    deliveryDate = partial.deliveryDate;
    const transit = estimateTransitDays({
      carrier: partial.carrier,
      service: partial.service,
      distanceMiles: ctx.distanceMiles,
      isInternational: ctx.isInternational,
    });
    minDays = partial.etaDays ?? transit.minDays;
    maxDays = transit.maxDays;
  } else {
    const transit = estimateTransitDays({
      carrier: partial.carrier,
      service: partial.service,
      distanceMiles: ctx.distanceMiles,
      isInternational: ctx.isInternational,
    });
    minDays = transit.minDays;
    maxDays = transit.maxDays;
    deliveryDays = formatDeliveryDaysRange(minDays, maxDays);
    deliveryDate = addBusinessDays(ctx.shipDate, maxDays).toISOString();
  }

  if (ctx.isInternational && !deliveryDays.includes("Customs")) {
    deliveryDays = `${deliveryDays} · customs may add time`;
  }

  return {
    rateId: partial.rateId,
    carrier: partial.carrier,
    service: partial.service,
    price: partial.price,
    currency: partial.currency,
    source: partial.source,
    etaDays: partial.etaDays ?? minDays,
    deliveryDays,
    deliveryDate,
  };
}

function enrichRates(
  rates: RawRateQuote[],
  ctx: DeliveryEnrichmentContext
): ShippingRateQuote[] {
  return rates.map((rate) =>
    finalizeRateQuote(
      {
        rateId: rate.rateId,
        carrier: rate.carrier,
        service: rate.service,
        price: rate.price,
        currency: rate.currency,
        source: rate.source,
      },
      ctx,
      rate.apiDelivery
    )
  );
}

function buildRatesResponse(
  rates: ShippingRateQuote[],
  meta: Omit<ShippingRatesResponse, "rates" | "shipDate" | "shipDateLabel">,
  shipDate: Date
): ShippingRatesResponse {
  return {
    ...meta,
    rates,
    shipDate: shipDate.toISOString(),
    shipDateLabel: formatShipDateLabel(shipDate),
  };
}

export function generateMockShippingRates(input: {
  fromAddress: AddressJson;
  toAddress: AddressJson;
  packageDetails: PackageDetailsJson;
  distanceMiles: number | null;
}): RawRateQuote[] {
  const { fromAddress, toAddress, packageDetails, distanceMiles } = input;
  const billable = billableWeightLbs(
    packageDetails.weightLbs ?? 1,
    packageDetails
  );
  const weightOz = billable * 16;
  const distanceFee = distanceSurcharge(distanceMiles);
  const international = isInternationalShipment(fromAddress, toAddress);

  if (international) {
    const intlBase = weightOz * 1.5 + 15 + distanceFee;
    return [
      {
        rateId: "",
        carrier: "USPS",
        service: "Priority Mail International",
        price: roundPrice(intlBase + 8),
        currency: "USD",
        source: "mock",
      },
      {
        rateId: "",
        carrier: "FedEx",
        service: "International Economy",
        price: roundPrice(intlBase + 22),
        currency: "USD",
        source: "mock",
      },
      {
        rateId: "",
        carrier: "UPS",
        service: "Worldwide Saver",
        price: roundPrice(intlBase + 18),
        currency: "USD",
        source: "mock",
      },
    ].map((rate) => ({
      ...rate,
      rateId: makeRateId(rate.carrier, rate.service, rate.price),
    }));
  }

  const domestic = [
    {
      carrier: "USPS",
      service: "Priority Mail",
      base: 5,
      perOz: 0.5,
    },
    {
      carrier: "USPS",
      service: "Ground Advantage",
      base: 8,
      perOz: 0.35,
    },
    {
      carrier: "UPS",
      service: "Ground",
      base: 10,
      perOz: 0.4,
    },
    {
      carrier: "FedEx",
      service: "Home Delivery",
      base: 12,
      perOz: 0.45,
    },
    {
      carrier: "FedEx",
      service: "2Day",
      base: 18,
      perOz: 0.55,
    },
  ];

  return domestic.map(({ carrier, service, base, perOz }) => {
    const price = roundPrice(base + perOz * weightOz + distanceFee);
    return {
      rateId: makeRateId(carrier, service, price),
      carrier,
      service,
      price,
      currency: "USD",
      source: "mock" as const,
    };
  });
}

/** @deprecated Use generateMockShippingRates — kept for simple weight-only callers */
export function mockShippingRates(weightLbs: number): Array<{
  service: string;
  carrier: string;
  price: number;
  etaDays: number;
}> {
  const shipDate = getNextBusinessShipDate();
  const ctx: DeliveryEnrichmentContext = {
    shipDate,
    distanceMiles: 2450,
    isInternational: false,
  };
  return enrichRates(
    generateMockShippingRates({
      fromAddress: defaultFromAddress(),
      toAddress: {
        postalCode: "10001",
        city: "New York",
        state: "NY",
        country: "US",
      },
      packageDetails: { weightLbs, lengthIn: 10, widthIn: 10, heightIn: 10 },
      distanceMiles: 2450,
    }),
    ctx
  ).map(({ carrier, service, price, etaDays }) => ({
    carrier,
    service,
    price,
    etaDays,
  }));
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseUspsPostage(xml: string): Array<{
  service: string;
  price: number;
}> {
  const rates: Array<{ service: string; price: number }> = [];
  const blockRegex = /<Postage[^>]*>([\s\S]*?)<\/Postage>/gi;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(xml)) !== null) {
    const block = match[1];
    const service =
      block.match(/<MailService>([\s\S]*?)<\/MailService>/i)?.[1]?.trim() ??
      "USPS Service";
    const rateRaw = block.match(/<Rate>([\s\S]*?)<\/Rate>/i)?.[1]?.trim();
    const price = Number(rateRaw);
    if (Number.isFinite(price) && price > 0) {
      rates.push({ service, price });
    }
  }
  return rates;
}

async function fetchUspsRates(input: {
  fromAddress: AddressJson;
  toAddress: AddressJson;
  packageDetails: PackageDetailsJson;
}): Promise<RawRateQuote[]> {
  const userId = process.env.USPS_WEB_TOOLS_USER_ID?.trim();
  if (!userId) return [];

  const fromZip = (input.fromAddress.postalCode ?? "").replace(/\D/g, "").slice(0, 5);
  const toZip = (input.toAddress.postalCode ?? "").replace(/\D/g, "").slice(0, 5);
  if (fromZip.length < 5 || toZip.length < 5) return [];

  const pounds = Math.floor(input.packageDetails.weightLbs ?? 1);
  const ounces = Math.round(
    ((input.packageDetails.weightLbs ?? 1) - pounds) * 16
  );

  const xml = `<RateV4Request USERID="${xmlEscape(userId)}"><Revision>2</Revision><Package ID="1"><Service>ALL</Service><ZipOrigination>${fromZip}</ZipOrigination><ZipDestination>${toZip}</ZipDestination><Pounds>${pounds}</Pounds><Ounces>${ounces}</Ounces><Container>VARIABLE</Container><Size>REGULAR</Size><Machinable>TRUE</Machinable></Package></RateV4Request>`;

  const url = `https://secure.shippingapis.com/ShippingAPI.dll?API=RateV4&XML=${encodeURIComponent(xml)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const body = await res.text();

  if (!res.ok || body.includes("<Error>")) {
    throw new Error("USPS rate API error");
  }

  return parseUspsPostage(body).map(({ service, price }) => ({
    rateId: makeRateId("USPS", service, price),
    carrier: "USPS",
    service,
    price: roundPrice(price),
    currency: "USD",
    source: "live" as const,
  }));
}

async function getFedExAccessToken(): Promise<string | null> {
  const clientId = process.env.FEDEX_CLIENT_ID?.trim();
  const clientSecret = process.env.FEDEX_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  if (fedexTokenState && fedexTokenState.expiresAt > Date.now() + 60_000) {
    return fedexTokenState.token;
  }

  const baseUrl =
    process.env.FEDEX_API_BASE_URL?.replace(/\/$/, "") ??
    "https://apis-sandbox.fedex.com";

  const res = await fetch(`${baseUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) return null;

  fedexTokenState = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return data.access_token;
}

async function fetchFedExRates(input: {
  fromAddress: AddressJson;
  toAddress: AddressJson;
  packageDetails: PackageDetailsJson;
}): Promise<RawRateQuote[]> {
  const token = await getFedExAccessToken();
  const accountNumber = process.env.FEDEX_ACCOUNT_NUMBER?.trim();
  if (!token || !accountNumber) return [];

  const baseUrl =
    process.env.FEDEX_API_BASE_URL?.replace(/\/$/, "") ??
    "https://apis-sandbox.fedex.com";

  const weight = billableWeightLbs(
    input.packageDetails.weightLbs ?? 1,
    input.packageDetails
  );

  const payload = {
    accountNumber: { value: accountNumber },
    requestedShipment: {
      shipper: {
        address: {
          postalCode: input.fromAddress.postalCode,
          countryCode: normalizeCountry(input.fromAddress.country),
          city: input.fromAddress.city,
          stateOrProvinceCode: input.fromAddress.state,
        },
      },
      recipient: {
        address: {
          postalCode: input.toAddress.postalCode,
          countryCode: normalizeCountry(input.toAddress.country),
          city: input.toAddress.city,
          stateOrProvinceCode: input.toAddress.state,
          residential: true,
        },
      },
      pickupType: "DROPOFF_AT_FEDEX_LOCATION",
      rateRequestType: ["ACCOUNT", "LIST"],
      requestedPackageLineItems: [
        {
          weight: { units: "LB", value: weight },
          dimensions: {
            length: input.packageDetails.lengthIn ?? 10,
            width: input.packageDetails.widthIn ?? 10,
            height: input.packageDetails.heightIn ?? 10,
            units: "IN",
          },
        },
      ],
    },
  };

  const res = await fetch(`${baseUrl}/rate/v1/rates/quotes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    throw new Error(`FedEx rate API HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    output?: {
      rateReplyDetails?: Array<{
        serviceType?: string;
        serviceName?: string;
        ratedShipmentDetails?: Array<{
          totalNetCharge?: number;
          shipmentRateDetail?: { currency?: string };
        }>;
        operationalDetail?: { deliveryDate?: string };
      }>;
    };
  };

  const quotes = data.output?.rateReplyDetails ?? [];
  const rates: RawRateQuote[] = [];

  for (const quote of quotes) {
    const detail = quote.ratedShipmentDetails?.[0];
    const price = detail?.totalNetCharge;
    if (!Number.isFinite(price)) continue;
    const service = quote.serviceName ?? quote.serviceType ?? "FedEx Service";
    const currency = detail?.shipmentRateDetail?.currency ?? "USD";
    const commitmentDate = quote.operationalDetail?.deliveryDate;
    rates.push({
      rateId: makeRateId("FedEx", service, price as number, quote.serviceType),
      carrier: "FedEx",
      service,
      price: roundPrice(price as number),
      currency,
      source: "live",
      apiDelivery: commitmentDate
        ? { commitmentDate }
        : undefined,
    });
  }

  return rates;
}

async function fetchEasyPostRates(input: {
  fromAddress: AddressJson;
  toAddress: AddressJson;
  packageDetails: PackageDetailsJson;
}): Promise<RawRateQuote[]> {
  const apiKey = process.env.EASYPOST_API_KEY?.trim();
  if (!apiKey) return [];

  const weightOz = Math.max(
    1,
    Math.round((input.packageDetails.weightLbs ?? 1) * 16)
  );

  const body = {
    shipment: {
      from_address: {
        name: input.fromAddress.name,
        street1: input.fromAddress.line1,
        street2: input.fromAddress.line2,
        city: input.fromAddress.city,
        state: input.fromAddress.state,
        zip: input.fromAddress.postalCode,
        country: normalizeCountry(input.fromAddress.country),
      },
      to_address: {
        name: input.toAddress.name,
        street1: input.toAddress.line1,
        street2: input.toAddress.line2,
        city: input.toAddress.city,
        state: input.toAddress.state,
        zip: input.toAddress.postalCode,
        country: normalizeCountry(input.toAddress.country),
      },
      parcel: {
        length: input.packageDetails.lengthIn ?? 10,
        width: input.packageDetails.widthIn ?? 10,
        height: input.packageDetails.heightIn ?? 10,
        weight: weightOz,
      },
    },
  };

  const auth = Buffer.from(`${apiKey}:`).toString("base64");
  const res = await fetch("https://api.easypost.com/v2/shipments", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) {
    throw new Error(`EasyPost HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    rates?: Array<{
      id?: string;
      carrier?: string;
      service?: string;
      rate?: string;
      currency?: string;
      delivery_days?: number;
    }>;
  };

  return (data.rates ?? [])
    .map((rate) => {
      const price = Number(rate.rate);
      if (!Number.isFinite(price)) return null;
      const carrier = rate.carrier ?? "Carrier";
      const service = rate.service ?? "Standard";
      return {
        rateId: makeRateId(carrier, service, price, rate.id),
        carrier,
        service,
        price: roundPrice(price),
        currency: rate.currency ?? "USD",
        source: "live" as const,
        apiDelivery:
          rate.delivery_days != null
            ? { days: rate.delivery_days }
            : undefined,
      };
    })
    .filter((rate): rate is RawRateQuote => rate != null);
}

async function fetchShippoRates(input: {
  fromAddress: AddressJson;
  toAddress: AddressJson;
  packageDetails: PackageDetailsJson;
}): Promise<RawRateQuote[]> {
  const apiKey = process.env.SHIPPO_API_KEY?.trim();
  if (!apiKey) return [];

  const weight = billableWeightLbs(
    input.packageDetails.weightLbs ?? 1,
    input.packageDetails
  ).toFixed(2);

  const body = {
    address_from: {
      name: input.fromAddress.name,
      street1: input.fromAddress.line1,
      city: input.fromAddress.city,
      state: input.fromAddress.state,
      zip: input.fromAddress.postalCode,
      country: normalizeCountry(input.fromAddress.country),
    },
    address_to: {
      name: input.toAddress.name,
      street1: input.toAddress.line1,
      city: input.toAddress.city,
      state: input.toAddress.state,
      zip: input.toAddress.postalCode,
      country: normalizeCountry(input.toAddress.country),
    },
    parcels: [
      {
        length: String(input.packageDetails.lengthIn ?? 10),
        width: String(input.packageDetails.widthIn ?? 10),
        height: String(input.packageDetails.heightIn ?? 10),
        distance_unit: "in",
        weight,
        mass_unit: "lb",
      },
    ],
    async: false,
  };

  const res = await fetch("https://api.goshippo.com/shipments/", {
    method: "POST",
    headers: {
      Authorization: `ShippoToken ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) {
    throw new Error(`Shippo HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    rates?: Array<{
      object_id?: string;
      provider?: string;
      servicelevel?: { name?: string; token?: string };
      amount?: string;
      currency?: string;
      estimated_days?: number;
    }>;
  };

  return (data.rates ?? [])
    .map((rate) => {
      const price = Number(rate.amount);
      if (!Number.isFinite(price)) return null;
      const carrier = rate.provider ?? "Carrier";
      const service = rate.servicelevel?.name ?? "Standard";
      return {
        rateId: makeRateId(
          carrier,
          service,
          price,
          rate.object_id ?? rate.servicelevel?.token
        ),
        carrier,
        service,
        price: roundPrice(price),
        currency: rate.currency ?? "USD",
        source: "live" as const,
        apiDelivery:
          rate.estimated_days != null
            ? { days: rate.estimated_days }
            : undefined,
      };
    })
    .filter((rate): rate is RawRateQuote => rate != null);
}

function dedupeRates(rates: RawRateQuote[]): RawRateQuote[] {
  const seen = new Set<string>();
  const out: RawRateQuote[] = [];
  for (const rate of rates.sort((a, b) => a.price - b.price)) {
    const key = `${rate.carrier}:${rate.service}:${rate.price}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(rate);
  }
  return out;
}

export async function getShippingRates(
  input: RateQuoteInput
): Promise<ShippingRatesResponse> {
  const fromAddress = normalizeAddress(input.fromAddress, defaultFromAddress());
  const toAddress = normalizeAddress(input.toAddress ?? {}, {
    postalCode: "",
    city: "",
    state: "",
    country: "US",
  });
  const packageDetails = parseDimensions(input);
  packageDetails.weightLbs = parseWeightLbs(input);

  const [distanceMiles, isInternational] = await Promise.all([
    estimateDistanceMiles(fromAddress, toAddress),
    Promise.resolve(isInternationalShipment(fromAddress, toAddress)),
  ]);

  const billable = billableWeightLbs(
    packageDetails.weightLbs ?? 1,
    packageDetails
  );
  packageDetails.weightLbs = billable;

  const shipDate = getNextBusinessShipDate();
  const deliveryCtx: DeliveryEnrichmentContext = {
    shipDate,
    distanceMiles,
    isInternational,
  };

  const mockRatesRaw = generateMockShippingRates({
    fromAddress,
    toAddress,
    packageDetails,
    distanceMiles,
  });

  const liveRates: RawRateQuote[] = [];
  const carrierApiKey = process.env.EASYPOST_API_KEY?.trim();
  const shippoKey = process.env.SHIPPO_API_KEY?.trim();

  const quoteInput = { fromAddress, toAddress, packageDetails };

  if (carrierApiKey) {
    try {
      liveRates.push(...(await fetchEasyPostRates(quoteInput)));
    } catch (error) {
      console.warn("[shipping] EasyPost rates failed:", error);
    }
  } else if (shippoKey) {
    try {
      liveRates.push(...(await fetchShippoRates(quoteInput)));
    } catch (error) {
      console.warn("[shipping] Shippo rates failed:", error);
    }
  } else {
    await Promise.all([
      fetchUspsRates(quoteInput)
        .then((rates) => liveRates.push(...rates))
        .catch((error) => console.warn("[shipping] USPS rates failed:", error)),
      fetchFedExRates(quoteInput)
        .then((rates) => liveRates.push(...rates))
        .catch((error) => console.warn("[shipping] FedEx rates failed:", error)),
    ]);
  }

  const dedupedLive = dedupeRates(liveRates);

  const responseMeta = {
    source: "mock" as const,
    distanceMiles,
    isInternational,
    billableWeightLbs: billable,
    currency: "USD",
  };

  if (dedupedLive.length === 0) {
    return buildRatesResponse(
      enrichRates(mockRatesRaw, deliveryCtx),
      responseMeta,
      shipDate
    );
  }

  const liveCarriers = new Set(
    dedupedLive.map((rate) => rate.carrier.toLowerCase())
  );
  const supplementalMocks = mockRatesRaw.filter(
    (rate) => !liveCarriers.has(rate.carrier.toLowerCase())
  );

  const combined = dedupeRates([...dedupedLive, ...supplementalMocks]);

  return buildRatesResponse(
    enrichRates(combined, deliveryCtx),
    {
      ...responseMeta,
      source: supplementalMocks.length > 0 ? "mixed" : "live",
    },
    shipDate
  );
}
