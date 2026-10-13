export function escapeCsvCell(value: unknown) {
  const text = String(value ?? ''),
    safe = /^[\s\u0000-\u001f]*[=+@-]/.test(text) ? `'${text}` : text
  return '"' + safe.replaceAll('"', '""') + '"'
}
