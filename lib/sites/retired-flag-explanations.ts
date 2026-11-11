/**
 * Flags store the explanation their check produced when they were found.
 * These are fingerprints of the earlier check templates (the November 2026
 * plain-language rewrite replaced them), so a stored copy of an old template
 * shows the current wording while an explanation written for one observation
 * stays exact. Fingerprints only; the retired wording is not kept.
 */
const RETIRED_TEMPLATE_FINGERPRINTS = new Set([
  '115p50d', '120bz3k', '12z4p80', '13jn4v5', '13ygayu', '13zeguj', '143pvh6', '14821mb', '14zmsb8', '158nezl',
  '15k8c30', '16mwhki', '16rmsbw', '16w3gz', '187dj4a', '189yi58', '18zt3pu', '190en25', '197u66u', '199dre7',
  '1a5hau2', '1ap31vc', '1ap8jbn', '1bydsx5', '1c46ru', '1c5nhyl', '1cfg3pg', '1ckjch9', '1cxh80r', '1cy9vbz',
  '1e5119p', '1ewoij6', '1f8zq9p', '1fbhb4e', '1fn3chn', '1ftkrvl', '1ghftjb', '1izzr9e', '1k7g6al', '1ko7llm',
  '1m8bjwi', '1mrjvuz', '1my4rfo', '1n2wrtg', '1nmypdn', '1nsvavj', '1nttx6a', '1oes9vd', '1oriklz', '1polci1',
  '1q2k1se', '1s972cu', '1se3l04', '1srn6td', '1tc1j6r', '1tgx00m', '1tmtmfa', '1tpwnjk', '1tq57wq', '1u0e3hx',
  '1ulk4sw', '1uvom3n', '1v2c2kj', '1vd9tev', '1vy0ru8', '1w4rey1', '1w818jp', '1w9nlek', '1wkga4z', '1wzr60o',
  '1x1fq22', '1x3aehq', '1xhemf0', '1y4mnph', '1yhp1v', '27kub5', '2g1bqf', '3b8rh5', '4sa11z', '4voc09', '50osso',
  '54ubiz', '58l181', '59gcur', '62nurf', '6nasev', '73i3f8', '7b7t39', '7hii3t', '892kd1', '8pmnp5', '9vkwks',
  'a0otca', 'bnwer2', 'bpdd4j', 'ci042y', 'ct5vpb', 'dqdu0q', 'dsbyld', 'dv3f0g', 'eg4wkl', 'eyzrig', 'f2hbvm',
  'fm4iyw', 'fxuqz5', 'ido5r7', 'ie7is6', 'jtdq1f', 'kin8b9', 'kqukd', 'l882wc', 'lu3pm3', 'lwyfls', 'm2b8r6',
  'n0nu87', 'n0zd02', 'o7ppsj', 'p0afyo', 'p5qvnm', 'q2p3xw', 'qc6zb5', 'qh9bl8', 'r28md2', 'r6x0p7', 'rjjilh',
  's3wt9r', 'sgqjim', 'sheryr', 'sivkaj', 't3eru8', 'tg0mru', 'tgi1fq', 'to7lbn', 'tpqaf4', 'tr36sw', 'u3ebna',
  'u3zjuh', 'uqd2lj', 'ureg11', 'vggzeu', 'vxie3g', 'wnuea7', 'woabpv', 'wtzsfc', 'xn97lq', 'xo2edz', 'yclika',
  'ysgt9z', 'ytvur0', 'z2da6x', 'z4fjt', 'z5k8l', 'z8suhy', 'zbi6fy',
])

/** 32-bit FNV-1a, base 36. Small and synchronous, so client bundles can use it. */
export function explanationFingerprint(text: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(36)
}

export function isRetiredFlagExplanation(text: string | null | undefined): boolean {
  const value = text?.trim()
  return Boolean(value) && RETIRED_TEMPLATE_FINGERPRINTS.has(explanationFingerprint(value!))
}
