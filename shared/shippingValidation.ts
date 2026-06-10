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

export function getShippingRatesBlockReason(input: {
  fromAddress: ShippingAddressFields;
  toAddress: ShippingAddressFields;
  weightLbs: string | number;
  weightOz?: string | number;
}): string | null {
  if (!isShippingAddressComplete(input.fromAddress)) {
    return "Complete the ship-from address (street, city, state, ZIP).";
  }
  if (!isShippingAddressComplete(input.toAddress)) {
    return "Complete the ship-to address (street, city, state, ZIP).";
  }
  if (!isShippingWeightValid(input.weightLbs, input.weightOz ?? 0)) {
    return "Enter a package weight greater than 0.";
  }
  return null;
}

export function getPrintLabelBlockReason(input: {
  fromAddress: ShippingAddressFields;
  toAddress: ShippingAddressFields;
  weightLbs: string | number;
  weightOz?: string | number;
  selectedRateId?: string;
  selectedService?: string;
}): string | null {
  const ratesReason = getShippingRatesBlockReason(input);
  if (ratesReason) return ratesReason;
  if (!input.selectedRateId && !input.selectedService?.trim()) {
    return "Get rates and select a shipping option.";
  }
  return null;
}
