export function shareStatusMessage(
  shareStatus: string,
): string {
  if (shareStatus === 'good_to_share') {
    return 'No critical Flags. Good to share.'
  }
  return 'Fix critical Flags before sharing.'
}
