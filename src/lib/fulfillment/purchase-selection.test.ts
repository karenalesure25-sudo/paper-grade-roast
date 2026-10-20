import { expect, test } from "bun:test";
import { assertPurchaseSelection } from "./purchase-selection";

test("an open checkout cannot change the purchased layout", () => {
  expect(() => assertPurchaseSelection({ template: "sidebar", photo: "original" }, { template: "navy-gold", photo: "original" })).toThrow("saved order");
});
test("an open checkout cannot change or remove the purchased photo", () => {
  for (const photo of ["replacement", null]) {
    expect(() => assertPurchaseSelection({ template: "sidebar", photo: "original" }, { template: "sidebar", photo })).toThrow("saved order");
  }
});
test("identical purchase selection permits retries without mutating the snapshot", () => {
  expect(() => assertPurchaseSelection({ template: "sidebar", photo: "original" }, { template: "sidebar", photo: "original" })).not.toThrow();
  expect(() => assertPurchaseSelection({ template: "plain" }, { template: "plain", photo: null })).not.toThrow();
});