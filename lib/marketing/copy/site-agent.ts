export const SITE_AGENT_COPY = {
  title: 'Ask FixFlags', description: 'Understand this Site’s evidence and decide what to do next.',
  flagDescription: 'Understand this Flag’s evidence and plan the next check.',
  boundary: 'Answers explain recorded evidence. Only a fresh comparable check can establish recovery.',
  loading: 'Loading your conversation…', empty: 'Ask about the evidence, a Flag, or your next step.',
  question: 'Your question', placeholder: 'What needs attention, and what should I do next?',
  send: 'Send question', sending: 'Preparing your reply…', retry: 'Recover reply', newMessage: 'Start a new message',
  historyFailed: 'The conversation could not be loaded. Retry to read your saved messages.',
  interrupted: 'Your message is retained. Recover the reply before sending it again.',
  retryHistory: 'Reload conversation', sources: 'Evidence referenced', you: 'You', assistant: 'FixFlags',
  replied: 'Your reply is ready.', invalid: 'The reply could not be read. Recover it using the same request.',
  chatTitle: 'FixFlags', openChat: 'Open FixFlags chat', closeChat: 'Close FixFlags chat',
  siteQuestions: 'Site questions', support: 'Support', askAboutSite: 'Ask about this website', information: 'About Site answers',
  suggestions: ['What needs attention?', 'What should I do next?'],
  pending: 'Preparing your reply…', unread: (count: number) => `${count} unread support messages`,
  greeting: (host: string, flagTitle?: string) => flagTitle
    ? `Hi! I can help explain “${flagTitle}” on ${host} using recorded evidence. What would you like to know?`
    : `Hi! I can help you understand the recorded evidence for ${host}. What would you like to look at?`,
} as const
