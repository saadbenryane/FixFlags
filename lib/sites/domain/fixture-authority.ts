/** Site ownership does not transfer another owner's executable form secrets. */
export function fixtureOwnerCurrent(fixture: {
  configuredByUserId: string | null
  project: { userId: string }
}): boolean {
  return Boolean(fixture.configuredByUserId && fixture.configuredByUserId === fixture.project?.userId)
}
