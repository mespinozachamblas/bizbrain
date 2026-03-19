# Data Model and API Contracts

## 1. Core Tables
### users
- id
- email
- role
- created_at
- updated_at

### source_configs
- id
- source_type
- enabled
- niche_modes
- config_json
- created_at
- updated_at

### source_config_versions
- id
- source_config_id
- version_number
- config_json
- changed_by_user_id
- change_reason
- created_at

### raw_signals
- id
- source_type
- source_record_id
- source_url
- title
- body
- author_name
- occurred_at
- ingested_at
- dedupe_hash

### source_health_checks
- id
- source_config_id
- check_type
- check_status
- response_summary
- checked_at

### source_runs
- id
- source_config_id
- job_run_id
- logical_date
- run_status
- records_read
- records_written
- warnings_json
- errors_json
- started_at
- finished_at

### enriched_signals
- id
- raw_signal_id
- normalized_text
- keywords_json
- entities_json
- pain_points_json
- intent_phrases_json
- category_tags_json
- confidence_json
- created_at

### trend_clusters
- id
- slug
- title
- summary
- primary_category
- tags_json
- first_seen_at
- last_seen_at
- signal_count
- score_total
- score_frequency
- score_momentum
- score_intent
- score_whitespace
- score_fit
- score_complexity
- score_feasibility
- status
- created_at
- updated_at

### cluster_memberships
- id
- cluster_id
- raw_signal_id
- enriched_signal_id
- membership_reason
- similarity_score
- created_at

### ideas
- id
- cluster_id
- title
- category
- subcategory
- target_customer
- problem_summary
- solution_concept
- monetization_angle
- gtm_json
- validation_questions_json
- evidence_summary
- risk_notes
- score_snapshot
- status
- notes_markdown
- created_at
- updated_at

### digests
- id
- digest_date
- digest_key
- subject
- markdown_body
- html_body
- selection_json
- status
- created_at
- sent_at

### digest_recipients
- id
- email
- enabled
- is_owner_default
- created_at
- updated_at

### email_deliveries
- id
- digest_id
- recipient_id
- provider
- recipient_email
- delivery_key
- provider_message_id
- send_status
- error_text
- attempted_at

### retry_records
- id
- entity_type
- entity_id
- retry_key
- retry_reason
- forced
- requested_by_user_id
- created_at

### job_runs
- id
- job_name
- logical_date
- run_status
- started_at
- finished_at
- records_read
- records_written
- warnings_json
- errors_json

## 2. Recommended Indexing
- raw_signals on `(source_type, source_record_id)`
- raw_signals on `dedupe_hash`
- trend_clusters on `score_total desc`
- trend_clusters on `(primary_category, score_total desc)`
- ideas on `(status, category, updated_at desc)`
- digests on `digest_date`
- job_runs on `(job_name, logical_date)`

## 3. HTTP / Internal API Contracts
### GET `/api/ideas`
Filters:
- `status`
- `category`
- `subcategory`
- `minScore`
- `q`
- `limit`
- `cursor`

### GET `/api/ideas/:id`
Returns:
- idea
- related cluster summary
- evidence links
- latest status notes

### PATCH `/api/ideas/:id`
Updates:
- status
- notes
- tags
- priority flags

### GET `/api/clusters`
Filters:
- `category`
- `minScore`
- `status`
- `q`

### POST `/api/admin/jobs/:jobName/run`
- admin only
- optional `logicalDate`
- optional `dryRun`
- optional `force`

### GET `/api/admin/job-runs`
Filters:
- `jobName`
- `logicalDate`
- `status`

### POST `/api/admin/digests/:digestDate/send`
- resend daily digest for a selected date
- admin only
- optional `force`

### GET `/api/admin/sources/health`
Filters:
- `sourceType`
- `status`
- `limit`

### GET `/api/admin/digest-recipients`
Returns:
- configured recipients
- enabled status
- owner default flag

### POST `/api/admin/digest-recipients`
Creates:
- recipient email
- enabled state

### PATCH `/api/admin/digest-recipients/:id`
Updates:
- enabled
- email

## 4. LLM Contract Schemas
### cluster summary schema
- `title`
- `summary`
- `primaryCategory`
- `keyPainPoints[]`
- `notableEvidence[]`
- `confidence`

### idea schema
- `title`
- `category`
- `subcategory`
- `targetCustomer`
- `problemSummary`
- `solutionConcept`
- `monetizationAngle`
- `goToMarket[]`
- `validationQuestions[]`
- `riskNotes[]`

### digest item schema
- `sectionTitle`
- `items[]`
- `alerts[]`
- `plainLanguageSummary`

## 5. Retry and Idempotency Keys
- digest record key: `digest:{date}`
- digest send key: `digest:{date}:{recipient}`
- job lock key: `job:{jobName}:{logicalDate}`
- ingestion dedupe key: `source:{sourceType}:{sourceRecordId}`
