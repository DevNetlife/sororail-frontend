// @vitest-environment jsdom
import { cleanup, render, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { NETWORK_PASSPHRASE, RPC_URL } from "../src/lib/network";
import { getDefaultRpc, type Rpc } from "../src/lib/rpc";
import { RpcProvider, useRpc } from "../src/lib/rpc-provider";

afterEach(() => cleanup());

describe("RpcProvider (#441)", () => {
  it("hands every consumer the same server instance across re-renders", () => {
    const wrapper = ({ children }: { children: ReactNode }) => <RpcProvider>{children}</RpcProvider>;
    const { result, rerender } = renderHook(() => useRpc(), { wrapper });
    const first = result.current.server;
    rerender();
    rerender();
    expect(result.current.server).toBe(first);
  });

  it("shares one server between sibling consumers of the same provider", () => {
    const seen: Rpc[] = [];
    function Consumer() {
      seen.push(useRpc());
      return null;
    }
    render(
      <RpcProvider>
        <Consumer />
        <Consumer />
      </RpcProvider>,
    );
    expect(seen).toHaveLength(2);
    expect(seen[0]!.server).toBe(seen[1]!.server);
  });

  it("gives separate providers separate servers", () => {
    const a = renderHook(() => useRpc(), { wrapper: ({ children }) => <RpcProvider>{children}</RpcProvider> });
    const b = renderHook(() => useRpc(), { wrapper: ({ children }) => <RpcProvider>{children}</RpcProvider> });
    expect(a.result.current.server).not.toBe(b.result.current.server);
  });

  it("builds client options from the configured network", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RpcProvider rpcUrl="http://localhost:8000/soroban/rpc" networkPassphrase="Standalone Network ; February 2017">
        {children}
      </RpcProvider>
    );
    const { result } = renderHook(() => useRpc(), { wrapper });
    expect(result.current.clientOptions("CID", "GKEY")).toEqual({
      contractId: "CID",
      rpcUrl: "http://localhost:8000/soroban/rpc",
      networkPassphrase: "Standalone Network ; February 2017",
      publicKey: "GKEY",
    });
    expect(result.current.clientOptions("CID", null)).not.toHaveProperty("publicKey");
  });

  it("falls back to one app-wide instance when no provider is mounted", () => {
    const { result } = renderHook(() => useRpc());
    expect(result.current).toBe(getDefaultRpc());
    expect(result.current.rpcUrl).toBe(RPC_URL);
    expect(result.current.networkPassphrase).toBe(NETWORK_PASSPHRASE);
  });
});
