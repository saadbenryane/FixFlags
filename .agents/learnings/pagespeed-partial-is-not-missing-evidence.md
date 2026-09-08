# PageSpeed-only PARTIAL is not missing customer evidence

`reportCompleteness` becomes `PARTIAL` when desktop or mobile PageSpeed is absent, even if both screenshots, metadata, and AI review succeeded. Telling the customer "some evidence is missing" in that case made a finished report look broken.

Customer copy should mention missing evidence only when a screenshot capture failed. The capture-partial Agent message already covers that. Do not drive the Report "About this capture" tooltip from PageSpeed-only PARTIAL.

Evidence: local dogfood of https://saadbenryane.com (`cmtlzww320001gqecvm5s6knq`) completed score 90 with desktop+mobile screenshots ok and both PageSpeed flags false.

Related: Flag evidence frames must use a real `border` around a capture-aspect box. An inset ring is painted under the image, so the screenshot covers it.
