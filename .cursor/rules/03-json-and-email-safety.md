# JSON And Email Safety

- Model output written downstream must be schema-validated.
- Do not replace structured contracts with free-form text.
- Digest sends must be idempotent by date plus recipient.
- Persist digest content before send attempts.
- Keep non-production email delivery routed to safe recipients.
