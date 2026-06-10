export type ShippingAddressFields = {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

export function isShippingAddressComplete(
  address: ShippingAddressFields | undefined
): boolean {
  if (!address) return false;
  return Boolean(
    address.line1?.trim() &&
      address.city?.trim() &&
      address.state?.trim() &&
      address.postalCode?.trim()
  );
}

export function isShippingWeightValid(
  weightLbs: string | number,
  weightOz: string | number = 0
): boolean {
  const lbs = typeof weightLbs === "number" ? weightLbs : parseFloat(weightLbs);
  const oz = typeof weightOz === "number" ? weightOz : parseFloat(weightOz);
  const total =
    (Number.isFinite(lbs) ? lbs : 0) + (Number.isFinite(oz) ? oz : 0) / 16;
  return total > 0;
}

export function areShippingDimensionsValid(
  lengthIn: string | number,
  widthIn: string | number,
  heightIn: string | number
): boolean {
  const parse = (v: string | number) =>
    typeof v === "number" ? v : parseFloat(String(v));
  const l = parse(lengthIn);
  const w = parse(widthIn);
  const h = parse(heightIn);
  return l > 0 && w > 0 && h > 0;
}

/** Merge stored ship-from with defaults (env / app default). */
export function mergeShipFromAddress(
  stored: ShippingAddressFields | undefined,
  fallback: ShippingAddressFields
): ShippingAddressFields {
  return {
    name: stored?.name?.trim() || fallback.name?.trim() || "",
    line1: stored?.line1?.trim() || fallback.line1?.trim() || "",
    line2: stored?.line2?.trim() || fallback.line2?.trim() || "",
    city: stored?.city?.trim() || fallback.city?.trim() || "",
    state: stored?.state?.trim() || fallback.state?.trim() || "",
    postalCode: stored?.postalCode?.trim() || fallback.postalCode?.trim() || "",
    country: stored?.country?.trim() || fallback.country?.trim() || "US",
  };
}

/** UI gate for Get Rates — ship-to + package only (ship-from may use defaults). */
export function getShippingToPackageBlockReason(input: {
  toAddress: ShippingAddressFields;
  weightLbs: string | number;
  weightOz?: string | number;
  lengthIn?: string | number;
  widthIn?: string | number;
  heightIn?: string | number;
}): string | null {
  if (!isShippingAddressComplete(input.toAddress)) {
    return "Complete the ship-to address (street, city, state, ZIP).";
  }
  if (!isShippingWeightValid(input.weightLbs, input.weightOz ?? 0)) {
    return "Enter a package weight greater than 0.";
  }
  if (
    input.lengthIn != null &&
    input.widthIn != null &&
    input.heightIn != null &&
    !areShippingDimensionsValid(input.lengthIn, input.widthIn, input.heightIn)
  ) {
    return "Enter package length, width, and height (inches, all greater than 0).";
  }
  return null;
}

export function getShippingRatesBlockReason(input: {
  fromAddress: ShippingAddressFields;
  toAddress: ShippingAddressFields;
  weightLbs: string | number;
  weightOz?: string | number;
  lengthIn?: string | number;
  widthIn?: string | number;
  heightIn?: string | number;
  defaultFromAddress?: ShippingAddressFields;
}): string | null {
  const mergedFrom = input.defaultFromAddress
    ? mergeShipFromAddress(input.fromAddress, input.defaultFromAddress)
    : input.fromAddress;
  if (!isShippingAddressComplete(mergedFrom)) {
    return "Complete the ship-from address (street, city, state, ZIP).";
  }
  return getShippingToPackageBlockReason(input);
}

export function getPrintLabelBlockReason(input: {
  fromAddress: ShippingAddressFields;
  toAddress: ShippingAddressFields;
  weightLbs: string | number;
  weightOz?: string | number;
  lengthIn?: string | number;
  widthIn?: string | number;
  heightIn?: string | number;
  selectedRateId?: string;
  selectedService?: string;
  defaultFromAddress?: ShippingAddressFields;
}): string | null {
  const ratesReason = getShippingRatesBlockReason(input);
  if (ratesReason) return ratesReason;
  if (!input.selectedRateId && !input.selectedService?.trim()) {
    return "Get rates and select a shipping option.";
  }
  return null;
}
