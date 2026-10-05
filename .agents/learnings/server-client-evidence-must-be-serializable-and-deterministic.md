# Server/client evidence must be serializable and deterministic

Date: 2026-10-04

Two failures survived tests and an optimized build but appeared in the real authenticated browser path:

- A server component passed a Lucide component function to a client component. The dashboard returned HTTP 200, then React rejected the RSC payload.
- A client component pre-rendered a persisted instant with an implicit locale and time zone. The browser hydrated the same instant to different text and replaced the evidence line.

Prevent both at the boundary:

- Pass stable identifiers such as `SiteCardArea` through server-to-client props, then resolve components inside the client module.
- Format persisted evidence with an explicit locale and time zone whenever the same component can render on the server and hydrate in a browser.
- Treat a successful build and HTTP 200 as insufficient for interactive surfaces. Walk the authenticated page and inspect browser console errors at a desktop and phone width.
