-- =====================================================================
-- Admissions Flow / "Конвейер Приема" — PostgreSQL schema (Mezon v3.4)
-- =====================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
    CREATE TYPE stage_status AS ENUM ('Not_Started', 'In_Progress', 'Completed', 'Failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE route_type AS ENUM ('Standard', 'Preventive', 'Intense', 'Crisis');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- Staff / admission team accounts
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'admin', -- admin | interviewer | curator | teacher | principal
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Families (Core Entity)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS families (
    id SERIAL PRIMARY KEY,
    child_name VARCHAR(255) NOT NULL,
    child_class INT NOT NULL,
    target_grade VARCHAR(20) DEFAULT '1-2', -- '1-2', '3-4', '5-6', '7-8', '9-11'
    parents_info JSONB NOT NULL, -- {father: {name, phone, email}, mother: {name, phone, email}}
    current_stage INT DEFAULT 0, -- 0 to 6
    stage_statuses JSONB DEFAULT '{"0": "In_Progress", "1": "Not_Started", "2": "Not_Started", "3": "Not_Started", "4": "Not_Started", "5": "Not_Started", "6": "Not_Started"}'::jsonb,
    iop_score NUMERIC(3, 2) DEFAULT 0.00, -- Weighted Index of Educational Partnership (ИОП)
    route_status route_type DEFAULT 'Standard',
    admin_route_recommendation VARCHAR(100) DEFAULT 'Standard Route',
    risk_flags VARCHAR[] DEFAULT '{}', -- System flags: ['RESOURCE', 'CHECK', 'RISK', 'CONTRACT', 'FOLLOW'] + legacy flags
    risk_evidence JSONB DEFAULT '{}'::jsonb, -- { FLAG: [{stage, quote, source, created_at}] } — powers drill-down in Family Passport
    stage0_data JSONB DEFAULT '{}'::jsonb, -- Stage 0 full structure (questions 1-3 + categories, speech markers, etc.)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Stage 0 Detailed Record
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stage0_records (
    id SERIAL PRIMARY KEY,
    family_id INT REFERENCES families(id) ON DELETE CASCADE UNIQUE,
    admin_name VARCHAR(255),
    contact_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    contact_format VARCHAR(50) DEFAULT 'Phone', -- Phone | InPerson | Online
    applicant_identity VARCHAR(50) DEFAULT 'Mother', -- Mother | Father | Both | Guardian
    trigger_quote TEXT, -- Verbatim reason/motive for application
    primary_motive TEXT,
    alternatives_considered TEXT,
    first_questions JSONB DEFAULT '[]'::jsonb, -- [{order: 1, text: "...", category: "price|rules|schedule|discipline|teachers"}]
    dominant_pronoun VARCHAR(50) DEFAULT 'MyChild', -- MyChild | We | SchoolMust
    speech_markers VARCHAR[] DEFAULT '{}',
    prev_school_tone VARCHAR(50) DEFAULT 'Neutral', -- Positive | Neutral | Conflict | BlameSchool
    blame_attribution VARCHAR(50) DEFAULT 'School', -- School | Child | Family | Shared
    family_responsibility_recognition INT DEFAULT 2, -- 0-3 scale
    initial_indicators JSONB DEFAULT '{"request_clarity": 2, "educational_motivation": 2, "family_resource": 2, "communication_readiness": 2, "readiness_for_rules": 2, "initial_risk": 0}'::jsonb,
    admin_route VARCHAR(100) DEFAULT 'Standard Route',
    transcript TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Stage 1 & 3: Questionnaire Answers & Dual Parent Delta
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS questionnaire_responses (
    id SERIAL PRIMARY KEY,
    family_id INT REFERENCES families(id) ON DELETE CASCADE,
    stage_number INT NOT NULL, -- 1 or 3
    respondent_type VARCHAR(50) NOT NULL, -- 'mother', 'father', 'joint'
    target_grade VARCHAR(20) DEFAULT '1-2',
    block_responses JSONB DEFAULT '{}'::jsonb, -- Answers to 6 structural blocks
    q_and_a JSONB NOT NULL, -- [{question, question_id, selected_option_id, weight, justification_text, comment}]
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(family_id, stage_number, respondent_type)
);

CREATE TABLE IF NOT EXISTS parent_deltas (
    id SERIAL PRIMARY KEY,
    family_id INT REFERENCES families(id) ON DELETE CASCADE UNIQUE,
    discrepancy_score NUMERIC(3,2) DEFAULT 0.00,
    disagreements JSONB DEFAULT '[]'::jsonb, -- [{question_id, question, mother_choice, father_choice, justification_gap}]
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Stage 2: Pre-Meeting Briefing & In-Meeting Observation Logs
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stage2_briefings (
    id SERIAL PRIMARY KEY,
    family_id INT REFERENCES families(id) ON DELETE CASCADE UNIQUE,
    agenda_questions JSONB DEFAULT '[]'::jsonb, -- [{order: 1, topic: "...", suggested_question: "...", observation_goal: "..."}]
    quick_sheet_summary JSONB DEFAULT '{}'::jsonb, -- 1-page summary data for observer
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stage2_observations (
    id SERIAL PRIMARY KEY,
    family_id INT REFERENCES families(id) ON DELETE CASCADE UNIQUE,
    observer_name VARCHAR(255),
    first_minutes_log JSONB DEFAULT '{}'::jsonb, -- {who_oriented, punctuality, entrance_tone}
    child_behavior_log JSONB DEFAULT '{}'::jsonb, -- {initiative, boundaries, contact, language_freedom}
    parent_behavior_log JSONB DEFAULT '{}'::jsonb, -- {listening, role_distribution, rule_reaction, speech_tone}
    diagnostic_probe_log JSONB DEFAULT '{}'::jsonb, -- {probe_type, parent_reaction_to_difficulty}
    mezon_model_reactions JSONB DEFAULT '{}'::jsonb, -- {full_day, high_density, self_reliance, discipline, mandatory_family_role}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Evaluations per Stage (competency ratings + evidence quotes)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stage_evaluations (
    id SERIAL PRIMARY KEY,
    family_id INT REFERENCES families(id) ON DELETE CASCADE,
    stage_number INT NOT NULL,
    evaluator_name VARCHAR(255) NOT NULL,
    competency_scores JSONB, -- {"responsibility": 3, "error_tolerance": 2, ...} 0-4 scale
    proof_sources JSONB DEFAULT '{}'::jsonb, -- {"responsibility": ["quote 1", "SJT choice 2"], ...} Enforces >=2 sources for 0-1 and 3-4 scores
    raw_notes TEXT, -- Quotes, behavioral evidence
    custom_flags VARCHAR[] DEFAULT '{}', -- ['RESOURCE', 'CHECK', 'RISK', 'CONTRACT', 'FOLLOW']
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Contract Clauses Mapping & Stage 4 Agreements Protocol
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contract_clauses (
    id SERIAL PRIMARY KEY,
    risk_flag VARCHAR(100) UNIQUE NOT NULL,
    clause_title VARCHAR(255) NOT NULL,
    clause_text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS family_contracts (
    id SERIAL PRIMARY KEY,
    family_id INT REFERENCES families(id) ON DELETE CASCADE UNIQUE,
    selected_clause_ids INT[] DEFAULT '{}',
    protocol_agreements JSONB DEFAULT '[]'::jsonb, -- [{flag, title, agreement_text, is_accepted}]
    generated_file VARCHAR(255),
    is_signed BOOLEAN DEFAULT FALSE,
    signed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Stage 5: Home Test Task Submissions & Family Self-Report
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS test_tasks (
    id SERIAL PRIMARY KEY,
    family_id INT REFERENCES families(id) ON DELETE CASCADE UNIQUE,
    file_path VARCHAR(255),
    child_product_description TEXT,
    family_self_report JSONB DEFAULT '{}'::jsonb, -- {who_present, exact_help_provided, intervention_moments, honesty_statement}
    independence_score INT, -- 0-4
    honesty_score INT, -- 0-4
    quality_score INT, -- 0-4
    reviewer_name VARCHAR(255),
    reviewer_notes TEXT,
    is_reviewed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Stage 6: Weekly Probation Logs & Checkpoint Meetings
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS probation_weekly_logs (
    id SERIAL PRIMARY KEY,
    family_id INT REFERENCES families(id) ON DELETE CASCADE,
    week_number INT NOT NULL,
    checklist_answers JSONB NOT NULL, -- {punctuality: boolean, system_boundaries: boolean, homework_support: boolean, aggressive_complaints: boolean, sr_independence: boolean}
    notes TEXT,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(family_id, week_number)
);

CREATE TABLE IF NOT EXISTS probation_checkpoints (
    id SERIAL PRIMARY KEY,
    family_id INT REFERENCES families(id) ON DELETE CASCADE UNIQUE,
    checkpoint_week INT DEFAULT 4,
    summary_notes TEXT,
    final_route_assignment route_type DEFAULT 'Standard',
    curator_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- One-time access links sent to parents for stage 1 / stage 3 forms
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS access_links (
    id SERIAL PRIMARY KEY,
    family_id INT REFERENCES families(id) ON DELETE CASCADE,
    token UUID DEFAULT gen_random_uuid() UNIQUE,
    stage_number INT NOT NULL,
    respondent_type VARCHAR(50), -- mother | father | joint
    is_used BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stage_evaluations_family ON stage_evaluations(family_id);
CREATE INDEX IF NOT EXISTS idx_questionnaire_family ON questionnaire_responses(family_id);
CREATE INDEX IF NOT EXISTS idx_probation_family ON probation_weekly_logs(family_id);
CREATE INDEX IF NOT EXISTS idx_access_links_token ON access_links(token);
