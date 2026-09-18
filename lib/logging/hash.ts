/**
 * Non-cryptographic 64-bit style hash (two FNV-1a passes), enough to keep raw ids out of
 * the event stream in this demo. A production sink hashes server-side with a salted SHA-256.
 */
export function hashUserId(userId: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let index = 0; index < userId.length; index++) {
    const code = userId.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ (code + index), 0x811c9dc5) >>> 0;
  }
  return `u_${a.toString(16).padStart(8, "0")}${b.toString(16).padStart(8, "0")}`;
}
