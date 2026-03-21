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
- research_stream_ids_json
- topic_ids_json
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

### research_streams
- id
- slug
- name
- description
- enabled
- enabled_channels_json
- delivery_type
- schedule_cron
- default_copy_framework_id
- default_style_profile_id
- default_asset_mode
- created_at
- updated_at

### topics
- id
- research_stream_id
- slug
- name
- description
- enabled_channels_json
- keywords_json
- exclusions_json
- source_preferences_json
- default_copy_framework_id
- default_style_profile_id
- default_asset_mode
- enabled
- created_at
- updated_at

### copy_frameworks
- id
- slug
- name
- description
- structure_json
- enabled
- created_at
- updated_at

### style_profiles
- id
- slug
- name
- description
- inspiration_summary
- style_traits_json
- guardrails_json
- enabled
- created_at
- updated_at

### raw_signals
- id
- topic_matches_json
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
- research_stream_id
- primary_topic_id
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
- quality_score
- quality_reason
- source_attribution_json
- score_snapshot
- status
- notes_markdown
- created_at
- updated_at

### content_drafts
- id
- research_stream_id
- topic_id
- source_idea_id
- copy_framework_id
- style_profile_id
- title
- target_channel
- target_audience
- hook
- thesis
- supporting_points_json
- counterpoint
- cta
- draft_markdown
- draft_html
- visual_brief_json
- infographic_brief_json
- infographic_format
- infographic_panels_json
- asset_mode
- asset_status
- asset_candidates_json
- quality_score
- source_attribution_json
- status
- created_at
- updated_at

### digests
- id
- research_stream_id
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
- research_stream_id
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
- ideas on `(research_stream_id, quality_score desc, updated_at desc)`
- topics on `(research_stream_id, enabled)`
- content_drafts on `(research_stream_id, status, updated_at desc)`
- digests on `digest_date`
- job_runs on `(job_name, logical_date)`

## 3. HTTP / Internal API Contracts
### GET `/api/ideas`
Filters:
- `researchStream`
- `topicId`
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
- reviewer feedback state

### GET `/api/clusters`
Filters:
- `researchStream`
- `category`
- `minScore`
- `status`
- `q`

### GET `/api/admin/research-streams`
Returns:
- research streams
- enabled status
- delivery config summary

### POST `/api/admin/research-streams`
Creates:
- name
- slug
- description
- enabled state

### PATCH `/api/admin/research-streams/:id`
Updates:
- name
- enabled
- enabled channels
- delivery settings
- default content generation settings

### GET `/api/admin/topics`
Filters:
- `researchStream`
- `enabled`

### POST `/api/admin/topics`
Creates:
- research stream id
- topic name
- keywords
- exclusions
- source preferences

### PATCH `/api/admin/topics/:id`
Updates:
- name
- enabled
- enabled channels
- keywords
- exclusions
- source preferences
- default copy framework
- default style profile
- default asset mode

### GET `/api/admin/copy-frameworks`
Returns:
- configured copywriting frameworks
- enabled status

### POST `/api/admin/copy-frameworks`
Creates:
- name
- slug
- description
- structure definition

### PATCH `/api/admin/copy-frameworks/:id`
Updates:
- name
- enabled
- structure definition

### GET `/api/admin/style-profiles`
Returns:
- configured marketer-style profiles
- enabled status

### POST `/api/admin/style-profiles`
Creates:
- name
- slug
- description
- inspiration summary
- style traits
- guardrails

### PATCH `/api/admin/style-profiles/:id`
Updates:
- name
- enabled
- style traits
- guardrails

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
- optional `researchStream`
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
- research stream association

### POST `/api/admin/digest-recipients`
Creates:
- research stream id
- recipient email
- enabled state

### PATCH `/api/admin/digest-recipients/:id`
Updates:
- research stream id
- enabled
- email

### PATCH `/api/content-drafts/:id`
Updates:
- status
- reviewer feedback state
- notes

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
- `researchStream`
- `primaryTopic`
- `category`
- `subcategory`
- `targetCustomer`
- `problemSummary`
- `solutionConcept`
- `monetizationAngle`
- `goToMarket[]`
- `validationQuestions[]`
- `riskNotes[]`
- `qualityScore`
- `qualityReason`
- `sourceAttribution[]`

### social media draft schema
- `targetChannel`
- `topic`
- `targetAudience`
- `hook`
- `copyFramework`
- `styleProfile`
- `thesis`
- `supportingPoints[]`
- `counterpoint`
- `cta`
- `draftLinkedInPost`
- `draftXPost`
- `draftXThreadOutline[]`
- `visualBrief`
- `infographicBrief`
- `infographicFormat`
- `infographicPanels[]`
- `assetMode`
- `sourceAttribution[]`

### digest item schema
- `sectionTitle`
- `items[]`
- `alerts[]`
- `plainLanguageSummary`

## 5. Retry and Idempotency Keys
- digest record key: `digest:{date}:{researchStream}`
- digest send key: `digest:{date}:{researchStream}:{recipient}`
- job lock key: `job:{jobName}:{logicalDate}`
- ingestion dedupe key: `source:{sourceType}:{sourceRecordId}`
