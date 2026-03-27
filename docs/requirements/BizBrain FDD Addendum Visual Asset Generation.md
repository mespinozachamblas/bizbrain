\# BizBrain FDD Addendum  
\#\# Visual Asset Generation, Creative Frameworks, and Design Tool Orchestration

\*\*Document Type:\*\* Functional Design Document Addendum    
\*\*Product:\*\* BizBrain    
\*\*Version:\*\* Addendum v1    
\*\*Status:\*\* Draft    
\*\*Purpose:\*\* This addendum extends the existing BizBrain FDD to define the functional requirements for visual asset generation, infographic production, workflow diagram generation, marketer style libraries, copy frameworks, and design-tool orchestration using image generation and design APIs.

\---

\# 1\. Background

BizBrain currently researches market signals and generates content ideas, drafts, and structured outputs for business and LinkedIn posting workflows. The next evolution of the platform is to convert research outputs into post-ready visual assets and structured copy using a mix of:

\- configurable marketer styles  
\- reusable copywriting frameworks  
\- image generation  
\- Figma / FigJam workflow diagram generation  
\- Canva infographic generation  
\- optional visual asset enhancement modes

This addendum formalizes the requirements for those capabilities so BizBrain can support more polished and scalable social content creation while preserving editability, cost control, and operational efficiency.

\---

\# 2\. Goals

The goals of this addendum are to enable BizBrain to:

1\. turn researched insights into post-ready visual assets  
2\. support reusable marketer style profiles for different content personalities  
3\. support reusable copywriting frameworks for output structuring  
4\. create workflow diagrams using Figma / FigJam rather than image generation where editability matters  
5\. create infographic assets using Canva or Figma for statistics-heavy posts  
6\. optionally generate hero visuals or supporting imagery using image generation  
7\. control cost by making visual generation optional, scoped, and mode-based  
8\. support founder-led LinkedIn content and business automation marketing use cases  
9\. make all outputs configurable through dashboard-managed records rather than hardcoded logic

\---

\# 3\. Scope

\#\# In Scope

This addendum includes functional requirements for:

\- marketer style library management  
\- framework library management  
\- visual output mode selection  
\- infographic generation workflows  
\- workflow diagram generation workflows  
\- hero image generation workflows  
\- post packaging workflows  
\- cost control settings  
\- structured creative orchestration logic  
\- output routing to email and future content destinations  
\- dashboard support for style, framework, and visual mode configuration

\#\# Out of Scope

This addendum does not include:

\- full social network publishing APIs  
\- advanced video generation  
\- enterprise DAM functionality  
\- custom illustration editing suite  
\- full document editor replacement  
\- collaborative multi-user design review workflow  
\- long-term asset rights management system

\---

\# 4\. Business Rationale

Adding visual generation and creative structure improves BizBrain’s value in three major ways:

1\. research outputs become easier to publish on LinkedIn and other channels  
2\. operators can standardize content quality through reusable frameworks and style systems  
3\. BizBrain can support service-first monetization by generating deliverables that are polished enough for productized business automation and marketing services

This is especially relevant for founder-led marketing, productized service sales, SaaS upsell funnels, and industry authority building.

\---

\# 5\. Personas

\#\# 5.1 Founder / Operator  
A solo founder or operator using BizBrain to research, draft, and package content ideas into publishable assets.

\#\# 5.2 Content Strategist  
A user who wants to generate thought-leadership posts, infographic posts, and structured copy based on market research outputs.

\#\# 5.3 Productized Service Builder  
A user who wants BizBrain to create useful client-facing or prospect-facing content based on reusable service offers and workflow designs.

\#\# 5.4 Future Team Admin  
A user who manages marketer styles, frameworks, and visual templates from the dashboard.

\---

\# 6\. Functional Summary

BizBrain shall support the following creative output layers:

1\. \*\*Research Layer\*\*    
   Extracts and summarizes useful signals, insights, examples, trends, complaints, and statistics.

2\. \*\*Structure Layer\*\*    
   Applies a selected framework to organize the output.

3\. \*\*Voice Layer\*\*    
   Applies a selected marketer style profile or house style.

4\. \*\*Visual Mode Layer\*\*    
   Determines whether the output should remain text-only or be transformed into one or more visual assets.

5\. \*\*Design Execution Layer\*\*    
   Routes the structured output to the appropriate tool:  
   \- Canva / Figma for infographics  
   \- Figma / FigJam for workflow diagrams  
   \- image generation for hero visuals or supporting graphics

6\. \*\*Packaging Layer\*\*    
   Returns the final result as draft copy, design-ready content spec, or generated visual asset package.

\---

\# 7\. New Functional Modules

\#\# 7.1 Marketer Style Library Module

BizBrain shall provide a dashboard-managed library of marketer style profiles.

Each style record shall support at minimum:

\- \`Name\`  
\- \`Slug\`  
\- \`Description\`  
\- \`Inspiration summary\`  
\- \`Style traits\`  
\- \`Guardrails\`  
\- \`Enabled\`

\#\#\# Functional Requirements

\- Users shall be able to create, edit, archive, enable, or disable style profiles.  
\- Users shall be able to assign a default style at stream level, topic level, or generation level.  
\- Style traits shall influence tone, emphasis, pacing, framing, CTA behavior, and copy density.  
\- Guardrails shall constrain outputs to avoid unwanted tones, claims, or style extremes.  
\- BizBrain shall support both named inspired-by styles and neutral house styles.  
\- BizBrain shall treat named styles as inspiration profiles rather than exact impersonations.

\#\#\# Example Style Use Cases

\- founder-educator  
\- direct-response clarity  
\- positioning-led B2B  
\- insight-led authority  
\- warm content marketer  
\- blunt offer-driven style

\---

\#\# 7.2 Copy Framework Library Module

BizBrain shall provide a dashboard-managed library of copywriting and content frameworks.

Each framework record shall support at minimum:

\- \`Name\`  
\- \`Slug\`  
\- \`Description\`  
\- \`Structure\`  
\- \`Enabled\`

\#\#\# Functional Requirements

\- Users shall be able to create, edit, archive, enable, or disable frameworks.  
\- A framework may be assigned as:  
  \- stream default  
  \- topic default  
  \- per-run override  
\- Frameworks shall be used to organize output sections in a predictable sequence.  
\- Frameworks shall support both short-form and longer-form outputs.

\#\#\# Supported Framework Types

Examples may include:

\- AIDA  
\- PAS  
\- BAB  
\- Hook Teach Offer  
\- Insight Proof Action  
\- Problem Solution CTA  
\- LinkedIn Insight Post  
\- Quick Demo Post  
\- Case Study Snapshot  
\- Myth Truth Action

\---

\#\# 7.3 Visual Mode Orchestration Module

BizBrain shall support configurable visual modes for content generation.

\#\#\# Required Visual Modes

\- \`none\`  
\- \`hero-image\`  
\- \`workflow-diagram\`  
\- \`infographic\`  
\- \`carousel-cover\`  
\- \`post-visual-pack\`

\#\#\# Functional Requirements

\- Users shall be able to choose visual mode at generation time or assign a default at stream/topic level.  
\- BizBrain shall route each visual mode to the correct design execution path.  
\- BizBrain shall allow text-only generation with no visual cost impact.  
\- BizBrain shall support optional visual generation rather than forcing it for every run.

\---

\#\# 7.4 Workflow Diagram Generation Module

BizBrain shall support generation of structured workflow diagrams for business process posts.

\#\#\# Design Principle

Workflow diagrams shall default to \*\*Figma / FigJam\*\* output rather than image generation.

\#\#\# Supported Use Cases

\- lead follow-up process map  
\- intake workflow diagram  
\- landlord admin workflow  
\- tenant inquiry flow  
\- maintenance coordination flow  
\- onboarding workflow  
\- SaaS automation concept diagram

\#\#\# Functional Requirements

\- BizBrain shall convert research output or workflow ideas into a structured diagram spec.  
\- The structured diagram spec shall include:  
  \- nodes  
  \- arrows / transitions  
  \- labels  
  \- grouping  
  \- title  
  \- optional notes  
\- BizBrain shall send the diagram spec to a Figma / FigJam integration or exportable intermediate format.  
\- BizBrain shall support simple flowcharts as the initial diagram type.  
\- BizBrain shall support editable output rather than flattened images wherever possible.  
\- BizBrain shall allow a visual theme to be applied to diagrams.

\#\#\# Diagram Output Fields

Diagram generation logic should support:

\- diagram title  
\- objective  
\- audience  
\- start state  
\- end state  
\- node list  
\- decision points  
\- branch labels  
\- annotations  
\- CTA footer text  
\- brand style mode

\---

\#\# 7.5 Infographic Generation Module

BizBrain shall support infographic creation for statistics-rich or research-heavy posts.

\#\#\# Design Principle

Infographic generation shall default to \*\*Canva or Figma\*\* rather than image generation.

\#\#\# Supported Use Cases

\- industry statistics summary  
\- trend breakdown  
\- market overview  
\- benchmark snapshot  
\- report digest  
\- weekly insight card  
\- comparison infographic

\#\#\# Functional Requirements

\- BizBrain shall transform extracted article or report statistics into a structured infographic brief.  
\- The infographic brief shall include:  
  \- title  
  \- subtitle  
  \- data points  
  \- short labels  
  \- source notes  
  \- layout preference  
  \- tone  
  \- CTA or takeaway  
\- BizBrain shall support rendering through Canva or Figma integrations when available.  
\- BizBrain shall preserve exact numbers and labels in structured generation mode.  
\- BizBrain shall support both single-image infographics and multi-slide infographic sequences.  
\- BizBrain shall support a review layer before publishing.

\#\#\# Infographic Layout Types

\- stat card  
\- stacked statistics  
\- comparison block  
\- trend timeline  
\- key findings list  
\- bar comparison concept  
\- quote plus statistic hybrid  
\- report summary slide

\---

\#\# 7.6 Hero Image Generation Module

BizBrain shall support optional hero-image generation using image generation models.

\#\#\# Design Principle

Hero image generation shall be used primarily for:

\- cover visuals  
\- background support imagery  
\- concept art  
\- atmosphere enhancement  
\- visual hook assets

\#\#\# Functional Requirements

\- Hero image generation shall not be the default for stats-heavy infographics or workflow diagrams.  
\- Users shall be able to generate:  
  \- one hero image  
  \- multiple variations  
  \- branded prompt variants  
\- Users shall be able to select a simple prompt style or enriched prompt style.  
\- BizBrain shall allow hero image generation to be disabled globally or by stream.  
\- Generated hero visuals shall support pairing with post copy or Figma/Canva assets.

\---

\#\# 7.7 Post Packaging Module

BizBrain shall support packaging outputs into publishable or near-publishable content bundles.

\#\#\# Output Package Types

\- text-only post draft  
\- post \+ hero image  
\- post \+ workflow diagram brief  
\- post \+ infographic brief  
\- post \+ visual pack  
\- draft \+ design instructions

\#\#\# Functional Requirements

\- BizBrain shall return a structured result package containing:  
  \- selected framework  
  \- selected style  
  \- final draft copy  
  \- visual mode  
  \- design brief  
  \- CTA recommendation  
  \- posting suggestion  
\- The user shall be able to review and refine before external publishing.

\---

\# 8\. Dashboard Configuration Requirements

\#\# 8.1 Style Management Screen

The dashboard shall support CRUD operations for marketer style profiles.

\#\#\# Minimum Fields

\- Name  
\- Slug  
\- Description  
\- Inspiration summary  
\- Style traits  
\- Guardrails  
\- Enabled

\#\#\# Behavior

\- Multi-value fields shall accept pipe-delimited values.  
\- Slug shall be unique.  
\- Disabled styles shall not appear in generation dropdowns by default.

\---

\#\# 8.2 Framework Management Screen

The dashboard shall support CRUD operations for framework records.

\#\#\# Minimum Fields

\- Name  
\- Slug  
\- Description  
\- Structure  
\- Enabled

\#\#\# Behavior

\- Multi-step framework structure shall accept pipe-delimited values.  
\- Frameworks shall be available for stream/topic defaults and per-run overrides.

\---

\#\# 8.3 Visual Mode Controls

The dashboard shall support visual mode configuration per stream/topic or per-run session.

\#\#\# Minimum Fields

Suggested controls may include:

\- Default visual mode  
\- Design tool preference  
\- Max assets per run  
\- Allow image generation  
\- Allow infographic generation  
\- Allow workflow diagram generation  
\- Cost tier  
\- Review required  
\- Brand theme  
\- Preferred aspect ratio

\---

\# 9\. Design Tool Routing Logic

BizBrain shall use the following default routing logic.

\#\# 9.1 Workflow Diagram Routing

If output type is process-oriented, step-based, or node-edge structured:  
\- route to Figma / FigJam

\#\# 9.2 Infographic Routing

If output contains statistics, report findings, numerical comparisons, or structured research summaries:  
\- route to Canva or Figma

\#\# 9.3 Hero Image Routing

If output needs an attention-grabbing cover visual or supporting art:  
\- route to image generation

\#\# 9.4 Text-Only Routing

If the user wants cheapest / fastest output:  
\- route to copy generation only

\---

\# 10\. Cost Control Requirements

Visual generation can increase API and tool costs. BizBrain shall provide controls to reduce unnecessary usage.

\#\# Functional Requirements

\- Users shall be able to run text-only mode.  
\- Users shall be able to disable visual generation by default.  
\- Users shall be able to cap assets per run.  
\- Users shall be able to define a cost tier:  
  \- low  
  \- medium  
  \- high  
\- Users shall be able to restrict high-cost modes to manual approval only.  
\- BizBrain shall support generation only for top-scoring ideas or selected records.  
\- BizBrain shall support review-before-render workflows.  
\- BizBrain shall support “brief only” mode where it creates the visual instructions but does not render the asset.

\#\# Recommended Cost Strategy

\- default mode: text-only  
\- optional mode: one visual asset  
\- premium mode: full visual pack

\---

\# 11\. Functional Workflow

\#\# 11.1 Text to Visual Workflow

1\. system gathers researched content  
2\. system scores and ranks candidate insights  
3\. user or default rules select framework  
4\. user or default rules select style  
5\. user or default rules select visual mode  
6\. BizBrain creates structured copy  
7\. BizBrain creates design brief  
8\. BizBrain routes to selected design execution tool  
9\. output bundle is returned for review  
10\. approved result is exported or distributed

\---

\#\# 11.2 Research to Infographic Workflow

1\. research extractor identifies useful statistics  
2\. system normalizes labels and numbers  
3\. system selects infographic layout type  
4\. system applies selected style and framework  
5\. system generates infographic brief  
6\. system routes to Canva or Figma  
7\. system returns asset or design draft

\---

\#\# 11.3 Research to Workflow Diagram Workflow

1\. research or idea engine identifies a workflow candidate  
2\. system converts the idea into steps and transitions  
3\. system generates diagram nodes and labels  
4\. system applies visual theme  
5\. system routes diagram spec to Figma / FigJam  
6\. system returns draft diagram or editable board output

\---

\# 12\. User Stories

\#\# Styles and Frameworks

\- As a user, I want to choose a marketer style so my outputs match a preferred marketing voice.  
\- As a user, I want to choose a framework so the structure of the post feels intentional and repeatable.  
\- As an admin, I want to manage styles and frameworks in the dashboard without code changes.

\#\# Visual Generation

\- As a user, I want to generate a workflow diagram from a business process idea.  
\- As a user, I want to generate an infographic from extracted statistics.  
\- As a user, I want to generate a hero image only when it adds value.  
\- As a user, I want to keep some runs text-only to save cost.

\#\# BizBrain Strategy Use Cases

\- As a founder, I want to turn research into LinkedIn-ready content quickly.  
\- As a productized service operator, I want to create polished visuals that support offers and demos.  
\- As a SaaS builder, I want assets that position BizBrain as a smart business automation engine.

\---

\# 13\. Data Model Additions

\#\# 13.1 Style Profile Entity

Suggested fields:

\- id  
\- name  
\- slug  
\- description  
\- inspiration\_summary  
\- style\_traits  
\- guardrails  
\- enabled  
\- created\_at  
\- updated\_at

\#\# 13.2 Framework Entity

Suggested fields:

\- id  
\- name  
\- slug  
\- description  
\- structure  
\- enabled  
\- created\_at  
\- updated\_at

\#\# 13.3 Visual Generation Profile Entity

Suggested fields:

\- id  
\- name  
\- slug  
\- visual\_mode  
\- design\_tool\_preference  
\- cost\_tier  
\- max\_assets\_per\_run  
\- review\_required  
\- aspect\_ratio  
\- brand\_theme  
\- enabled  
\- created\_at  
\- updated\_at

\#\# 13.4 Generated Asset Record

Suggested fields:

\- id  
\- source\_run\_id  
\- asset\_type  
\- style\_profile\_id  
\- framework\_id  
\- visual\_mode  
\- tool\_used  
\- prompt\_or\_spec  
\- output\_url  
\- render\_status  
\- approval\_status  
\- estimated\_cost  
\- created\_at

\---

\# 14\. Validation Rules

\- Name fields shall be required.  
\- Slug fields shall be required and unique within their entity type.  
\- Multi-value fields shall support pipe-delimited values.  
\- Disabled records shall not be used in default generation unless explicitly selected.  
\- Visual modes shall only show tool options that are compatible with that mode.  
\- Statistics-based infographic flows shall require structured data fields before rendering.  
\- Workflow diagram flows shall require at least one node and one transition before rendering.

\---

\# 15\. Permissions and Admin Controls

BizBrain should support at least these permission assumptions in future:

\- admin can create/edit/delete styles and frameworks  
\- editor can use styles and frameworks  
\- editor can trigger visual generation  
\- admin can set cost caps and global visual defaults

\---

\# 16\. Error Handling

BizBrain shall handle the following gracefully:

\- unsupported visual mode  
\- missing framework  
\- missing style  
\- design tool unavailable  
\- image generation disabled  
\- insufficient data for infographic  
\- insufficient structure for workflow diagram  
\- asset rendering failure  
\- cost cap exceeded

When an error occurs, the system shall return:

\- failure reason  
\- recommended next step  
\- whether text-only fallback is available

\---

\# 17\. Reporting and Analytics

BizBrain should log and report on:

\- most-used styles  
\- most-used frameworks  
\- most-used visual modes  
\- generation success rates  
\- infographic vs diagram usage  
\- asset approval rate  
\- average output cost  
\- highest-performing combinations over time

This will help optimize both content performance and cost efficiency.

\---

\# 18\. Acceptance Criteria

The addendum shall be considered implemented when:

1\. users can manage marketer styles in the dashboard  
2\. users can manage frameworks in the dashboard  
3\. BizBrain can generate structured text using a selected framework and style  
4\. BizBrain can generate infographic briefs from statistical research outputs  
5\. BizBrain can generate workflow diagram briefs/specs from process-oriented ideas  
6\. BizBrain can optionally generate hero images  
7\. BizBrain routes diagram jobs to Figma / FigJam by default  
8\. BizBrain routes infographic jobs to Canva or Figma by default  
9\. BizBrain supports text-only mode  
10\. BizBrain supports cost controls and asset caps  
11\. outputs can be reviewed before publishing  
12\. multi-value configuration fields support pipe-delimited entry

\---

\# 19\. Recommended Defaults

To keep BizBrain practical and cost-controlled, the recommended defaults are:

\- default generation mode: text-only  
\- default workflow diagram tool: Figma / FigJam  
\- default infographic tool: Canva  
\- default hero visual tool: image generation  
\- default asset count per run: 1  
\- default review mode: required  
\- default style: founder-educator  
\- default framework: LinkedIn Insight Post

\---

\# 20\. Future Enhancements

Future versions may add:

\- auto-generated multi-slide LinkedIn carousel packs  
\- reusable brand templates  
\- chart rendering blocks  
\- icon pack injection  
\- template-level A/B testing  
\- direct social publishing  
\- analytics-based style recommendation  
\- asset performance feedback loops  
\- client-specific white-label themes  
\- AI-assisted infographic layout selection  
\- AI-assisted diagram cleanup and simplification

\---

\# 21\. Summary

This addendum expands BizBrain from a research and draft engine into a more complete creative orchestration system. The platform will be able to combine:

\- research insights  
\- reusable frameworks  
\- reusable marketer styles  
\- infographic generation  
\- workflow diagram generation  
\- optional hero-image support  
\- cost-aware visual routing

The result is a more useful system for LinkedIn posting, business automation thought leadership, productized service marketing, and future SaaS positioning.

\---

If you want, I can turn this into a matching Technical Specification addendum next.

