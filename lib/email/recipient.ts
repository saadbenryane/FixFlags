/** Reserved documentation and test domains cannot receive customer mail.
 * See https://www.iana.org/domains/reserved and RFC 2606. */
export function isReservedEmailRecipient(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@').at(-1)?.replace(/\.$/, '') ?? ''
  return ['test', 'invalid', 'localhost', 'example', 'example.com', 'example.net', 'example.org']
    .some(reserved => domain === reserved || domain.endsWith('.' + reserved))
}
