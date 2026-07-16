-- =====================================================================
-- Admissions Flow / "Конвейер Приема" — PostgreSQL schema
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
    parents_info JSONB NOT NULL, -- {father: {name, phone, email}, mother: {name, phone, email}}
    current_stage INT DEFAULT 0, -- 0 to 6
    stage_statuses JSONB DEFAULT '{"0": "In_Progress", "1": "Not_Started", "2": "Not_Started", "3": "Not_Started", "4": "Not_Started", "5": "Not_Started", "6": "Not_Started"}'::jsonb,
    iop_score NUMERIC(3, 2) DEFAULT 0.00, -- Weighted Index of Educational Partnership
    route_status route_type DEFAULT 'Standard',
    risk_flags VARCHAR[] DEFAULT '{}', -- e.g., ['CONSUMER', 'HYPER_CUSTODY', 'HIGH_ANXIETY']
    risk_evidence JSONB DEFAULT '{}'::jsonb, -- { FLAG: [{stage, quote, source, created_at}] } — powers the drill-down in the Family Passport
    stage0_data JSONB DEFAULT '{}'::jsonb, -- call tags, transcript, first questions
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Evaluations per Stage (competency ratings + notes, filled by staff)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stage_evaluations (
    id SERIAL PRIMARY KEY,
    family_id INT REFERENCES families(id) ON DELETE CASCADE,
    stage_number INT NOT NULL,
    evaluator_name VARCHAR(255) NOT NULL,
    competency_scores JSONB, -- {"responsibility": 3, "error_tolerance": 2, ...} Normalized to 0-4 scale
    raw_notes TEXT, -- Quotes, behavioral evidence
    custom_flags VARCHAR[] DEFAULT '{}', -- ['RISK', 'RESOURCE', 'CONTRACT', 'FOLLOW']
    is_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- SJT (Situational Judgment Tests) & Questionnaire Answers
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS questionnaire_responses (
    id SERIAL PRIMARY KEY,
    family_id INT REFERENCES families(id) ON DELETE CASCADE,
    stage_number INT NOT NULL, -- 1 or 3
    respondent_type VARCHAR(50) NOT NULL, -- 'mother', 'father', 'joint'
    q_and_a JSONB NOT NULL, -- [{question, question_id, selected_option_id, weight, comment}]
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Contract Clauses Mapping
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contract_clauses (
    id SERIAL PRIMARY KEY,
    risk_flag VARCHAR(100) UNIQUE NOT NULL,
    clause_title VARCHAR(255) NOT NULL,
    clause_text TEXT NOT NULL
);

-- ---------------------------------------------------------------------
-- Family <-> Contract clause selection (per-family manual overrides + signature)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS family_contracts (
    id SERIAL PRIMARY KEY,
    family_id INT REFERENCES families(id) ON DELETE CASCADE UNIQUE,
    selected_clause_ids INT[] DEFAULT '{}',
    generated_file VARCHAR(255),
    is_signed BOOLEAN DEFAULT FALSE,
    signed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Stage 5: home test task submissions & review
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS test_tasks (
    id SERIAL PRIMARY KEY,
    family_id INT REFERENCES families(id) ON DELETE CASCADE UNIQUE,
    file_path VARCHAR(255),
    parent_self_report TEXT,
    independence_score INT, -- 0-4
    honesty_score INT, -- 0-4
    quality_score INT, -- 0-4
    reviewer_name VARCHAR(255),
    reviewer_notes TEXT,
    is_reviewed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Weekly Probation Logs
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS probation_weekly_logs (
    id SERIAL PRIMARY KEY,
    family_id INT REFERENCES families(id) ON DELETE CASCADE,
    week_number INT NOT NULL,
    checklist_answers JSONB NOT NULL, -- {punctuality: boolean, system_boundaries: boolean, homework_support: boolean, aggressive_complaints: boolean}
    notes TEXT,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(family_id, week_number)
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
