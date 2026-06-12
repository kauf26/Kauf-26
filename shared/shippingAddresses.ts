import type { LabelAddress } from "./shippingLabelTemplate";

export type ShippingAddress = LabelAddress;

/** Parse buyer_info from sales row (JSON object or plain-text name). */
export function parseBuyerAddress(buyerInfo?: string | null): ShippingAddress {
  if (!buyerInfo?.trim()) {
    return {
      name: "Buyer",
      line1: "",
      city: "",
      state: "",
      postalCode: "",
      country: "US",
    };
  }
  try {
    return JSON.parse(buyerInfo) as ShippingAddress;
  } catch {
    return {
      name: buyerInfo.trim(),
      line1: "",
      city: "",
      state: "",
      postalCode: "",
      country: "US",
    };
  }
}
