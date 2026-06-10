import { describe, it, expect } from "vitest";
import {
  areShippingDimensionsValid,
  getPrintLabelBlockReason,
  getShippingRatesBlockReason,
  getShippingToPackageBlockReason,
  isShippingAddressComplete,
  mergeShipFromAddress,
} from "./shippingValidation";

const completeTo = {
  name: "Buyer",
  line1: "456 Oak Ave",
  city: "New York",
  state: "NY",
  postalCode: "10001",
  country: "US",
};

const defaultFrom = {
  name: "Seller",
  line1: "123 Main",
  city: "LA",
  state: "CA",
  postalCode: "90001",
  country: "US",
};

describe("shippingValidation", () => {
  it("getShippingToPackageBlockReason passes with complete to + package", () => {
    expect(
      getShippingToPackageBlockReason({
        toAddress: completeTo,
        weightLbs: 1,
        weightOz: 0,
        lengthIn: 10,
        widthIn: 8,
        heightIn: 4,
      })
    ).toBeNull();
  });

  it("getShippingToPackageBlockReason fails when ship-to incomplete", () => {
    expect(
      getShippingToPackageBlockReason({
        toAddress: { line1: "", city: "", state: "", postalCode: "" },
        weightLbs: 1,
        lengthIn: 10,
        widthIn: 8,
        heightIn: 4,
      })
    ).toContain("ship-to");
  });

  it("mergeShipFromAddress fills gaps from defaults", () => {
    const merged = mergeShipFromAddress({ name: "Custom" }, defaultFrom);
    expect(merged.name).toBe("Custom");
    expect(merged.line1).toBe("123 Main");
    expect(isShippingAddressComplete(merged)).toBe(true);
  });

  it("getPrintLabelBlockReason requires selected rate", () => {
    expect(
      getPrintLabelBlockReason({
        fromAddress: defaultFrom,
        toAddress: completeTo,
        weightLbs: 1,
        lengthIn: 10,
        widthIn: 8,
        heightIn: 4,
      })
    ).toContain("select");
  });

  it("getShippingRatesBlockReason uses defaultFromAddress when from partial", () => {
    expect(
      getShippingRatesBlockReason({
        fromAddress: { name: "Only name" },
        toAddress: completeTo,
        weightLbs: 2,
        lengthIn: 10,
        widthIn: 8,
        heightIn: 4,
        defaultFromAddress: defaultFrom,
      })
    ).toBeNull();
  });

  it("areShippingDimensionsValid rejects zero dimensions", () => {
    expect(areShippingDimensionsValid(0, 8, 4)).toBe(false);
    expect(areShippingDimensionsValid(10, 8, 4)).toBe(true);
  });
});
