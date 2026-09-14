/** This demo must never accept or transmit real provider credentials. */
export function encrypt(_value: string): never { throw new Error("Provider credentials are not supported in this demo."); }
