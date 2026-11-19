/** Well-known Stellar network passphrases, so the UI can name the network it is configured for (#429). */
const KNOWN_NETWORKS: Record<string, string> = {
  "Test SDF Network ; September 2015": "Testnet",
  "Public Global Stellar Network ; September 2015": "Mainnet",
  "Test SDF Future Network ; October 2022": "Futurenet",
  "Standalone Network ; February 2017": "Standalone",
};

/** Human name for a passphrase, or `null` when it is not one of the well-known networks. */
export function networkName(passphrase: string): string | null {
  return KNOWN_NETWORKS[passphrase] ?? null;
}
