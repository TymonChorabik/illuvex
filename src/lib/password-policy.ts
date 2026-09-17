/**
 * Password-policy constants safe to import from client components.
 *
 * Split out of src/lib/password.ts on purpose: that file does
 * `promisify(crypto.scrypt)` at module scope, which is a Node-only call.
 * A client component that imported MIN_PASSWORD_LENGTH from there pulled
 * the whole module — scrypt call included — into the browser bundle, where
 * `crypto.scrypt` doesn't exist, crashing every load of that page with
 * "The 'original' argument must be of type Function".
 */
export const MIN_PASSWORD_LENGTH = 12;
