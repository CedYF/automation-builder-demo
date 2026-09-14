/** Demo adapter: never obtains a provider credential. */
export async function getFacebookToken(): Promise<{ token: string | null; error?: string }> { return { token: null, error: "Provider execution is unavailable in the standalone demo." }; }
