export function isStripeTestSecretKey(key: unknown): key is string {
  return typeof key === 'string' && key.length > 16 &&
    (key.startsWith('sk_test_') || key.startsWith('rk_test_')) &&
    !/[^A-Za-z0-9]/.test(key.slice(8))
}
