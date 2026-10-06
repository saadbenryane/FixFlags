# Section order needs an ordered heading contract

Date: 2026-10-06
Scope: Settings information architecture and accessibility
Confidence: high

## Discovery

The Settings test asserted that every expected heading existed but could not
detect an incorrect order. Connection-card titles also used the same heading
level as the Connections responsibility, so the accessibility tree flattened
the intended hierarchy even while the grid looked reasonable.

## Rule

When a product contract assigns meaning to section order, assert the ordered
top-level heading sequence. Card titles within a responsibility must use the
next heading level. Presence-only assertions do not protect information
architecture.

## Prevention encoded

The Site board regression now compares the exact level-two sequence and pins
Shopify, Search Console, and Analytics to level three. The acceptance document
uses the same order.

