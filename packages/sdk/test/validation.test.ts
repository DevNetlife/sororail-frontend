import { describe, expect, it } from "vitest";

import { isValidAccountId, isValidContractId } from "../src/utils/validation.js";

const VALID_CONTRACT = "CDKJ56S7K7QC4LG6SFF2OGDTG6N4QBCJOVRWHY7MKCWD5JPQ6MDAHRAM";
const VALID_ACCOUNT = "GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY3NXMOCLWEZDTWE47XLNZT7";

describe("isValidContractId", () => {
  it("accepts valid contract strkeys", () => {
    expect(isValidContractId(VALID_CONTRACT)).toBe(true);
  });

  it("accepts lowercase valid contract strkeys", () => {
    expect(isValidContractId(VALID_CONTRACT.toLowerCase())).toBe(true);
  });

  it("accepts contract IDs with leading/trailing whitespace", () => {
    expect(isValidContractId(`  ${VALID_CONTRACT}  `)).toBe(true);
  });

  it("rejects invalid checksums", () => {
    const badChecksum = "CDKJ56S7K7QC4LG6SFF2OGDTG6N4QBCJOVRWHY7MKCWD5JPQ6MDAHRAA";
    expect(isValidContractId(badChecksum)).toBe(false);
  });

  it("rejects non-contract strkeys", () => {
    expect(isValidContractId(VALID_ACCOUNT)).toBe(false);
  });

  it("rejects wrong-length inputs", () => {
    expect(isValidContractId("CSHORT")).toBe(false);
    expect(isValidContractId(VALID_CONTRACT + "EXTRA")).toBe(false);
  });

  it("rejects arbitrary invalid strings", () => {
    expect(isValidContractId("invalid")).toBe(false);
    expect(isValidContractId("")).toBe(false);
    expect(isValidContractId("123456")).toBe(false);
  });
});

describe("isValidAccountId", () => {
  it("rejects invalid checksums", () => {
    const badChecksum = "GBRPYHIL2CI3WHZDTOOQFC6EB4KJJGUJSY3NXMOCLWEZDTWE47XLNZT8";
    expect(isValidAccountId(badChecksum)).toBe(false);
  });

  it("rejects non-account strkeys", () => {
    expect(isValidAccountId(VALID_CONTRACT)).toBe(false);
  });

  it("rejects wrong-length inputs", () => {
    expect(isValidAccountId("GSHORT")).toBe(false);
    expect(isValidAccountId(VALID_ACCOUNT + "EXTRA")).toBe(false);
  });

  it("rejects arbitrary invalid strings", () => {
    expect(isValidAccountId("invalid")).toBe(false);
    expect(isValidAccountId("")).toBe(false);
    expect(isValidAccountId("123456")).toBe(false);
  });
});
