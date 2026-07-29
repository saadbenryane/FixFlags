## Authentication

If the editor reports `401` or `unauthorized`, confirm that the bearer token is the API key revealed by FixFlags. Create a replacement if the original value was not saved.

## Plan access

MCP is a Pro feature. The public guide remains available to everyone, while credential creation and connection testing require the appropriate plan.

## Public URL requirements

FixFlags checks deployed `http` or `https` pages. Localhost, loopback, private-network addresses, and inaccessible preview URLs are rejected for safety and accuracy.

## Timeouts and queues

A check may still be capturing, checking, judging, or finalizing. Read the current status before retrying. If a run has failed, use the recovery action shown in the product instead of creating repeated parallel checks.

## Configuration

Validate JSON or TOML before saving it. Preserve the editor's existing MCP servers and add FixFlags as one entry. If tools are missing, restart the editor and run the setup wizard's discovery test again.

## Credential recovery

API keys are revealed once. If a key is lost, revoke it and create a new editor-tagged key. Do not send credentials through support messages.

## Get help

For billing, account, privacy, failed checks, or human support, visit the [Help Center](/help).
