/** Category comparison verified against the vendors' official product pages. */
export const SITE_COMPARE = {
  label: 'Compare',
  headlineDisplay: 'Different tools watch different layers',
  headlineAccentPeriod: true,
  headline: 'Different tools watch different layers.',
  mobileLabel: 'How SonarQube, UptimeRobot, Datadog Synthetic Monitoring, and FixFlags differ.',
  capabilityLabel: 'Capability',
  subline: 'Use the right tool for the failure you need to catch.',
  legend: 'Check means supported in the scoped product. X means it is not part of that product.',
  sourceNote: 'Official product descriptions checked October 9, 2026.',
  columns: [
    { id: 'sonarqube', label: 'SonarQube', shortLabel: 'Sonar', source: 'https://www.sonarsource.com/products/sonarqube/' },
    { id: 'uptimerobot', label: 'UptimeRobot', shortLabel: 'Uptime', source: 'https://uptimerobot.com/website-monitoring/' },
    { id: 'datadog', label: 'Datadog Synthetics', shortLabel: 'Datadog', source: 'https://docs.datadoghq.com/synthetics/browser_tests/' },
    { id: 'fixflags', label: 'FixFlags', shortLabel: 'FixFlags', source: '/how-it-works' },
  ] as const,
  rows: [
    {
      id: 'code-analysis',
      capability: 'Static code analysis',
      values: {
        sonarqube: { supported: true },
        uptimerobot: { supported: false },
        datadog: { supported: false },
        fixflags: { supported: false },
      },
    },
    {
      id: 'availability',
      capability: 'Public URL availability',
      values: {
        sonarqube: { supported: false },
        uptimerobot: { supported: true },
        datadog: { supported: true },
        fixflags: { supported: true },
      },
    },
    {
      id: 'checkout',
      capability: 'Browser checkout journey',
      values: {
        sonarqube: { supported: false },
        uptimerobot: { supported: false },
        datadog: { supported: true, qualifier: 'Authored' },
        fixflags: { supported: true, qualifier: 'Supported' },
      },
    },
    {
      id: 'signup',
      capability: 'Signup journey',
      values: {
        sonarqube: { supported: false },
        uptimerobot: { supported: false },
        datadog: { supported: true, qualifier: 'Authored' },
        fixflags: { supported: true, qualifier: 'Configured' },
      },
    },
    {
      id: 'recheck',
      capability: 'Fresh live-site recheck',
      values: {
        sonarqube: { supported: false },
        uptimerobot: { supported: true, qualifier: 'Endpoint' },
        datadog: { supported: true, qualifier: 'Test' },
        fixflags: { supported: true, qualifier: 'Same outcome' },
      },
    },
  ] as const,
} as const
