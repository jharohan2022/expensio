-- ═══════════════════════════════════════════════════
-- EXPENSE.io — Complete Database Schema
-- Run this in Railway MySQL Query tab (or phpMyAdmin)
-- ═══════════════════════════════════════════════════

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS support_messages;
DROP TABLE IF EXISTS trips;
DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS user_sessions;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- ── USERS ──────────────────────────────────────────
CREATE TABLE users (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    name                 VARCHAR(120)  NOT NULL,
    email                VARCHAR(180)  NOT NULL UNIQUE,
    password_hash        VARCHAR(255)  NOT NULL,
    role                 ENUM('employee','manager') NOT NULL DEFAULT 'employee',
    phone                VARCHAR(30)   DEFAULT NULL,
    date_of_birth        DATE          DEFAULT NULL,
    gender               VARCHAR(20)   DEFAULT NULL,
    company              VARCHAR(120)  DEFAULT NULL,
    department           VARCHAR(80)   DEFAULT NULL,
    job_title            VARCHAR(100)  DEFAULT NULL,
    employee_id          VARCHAR(60)   DEFAULT NULL,
    address              VARCHAR(255)  DEFAULT NULL,
    city                 VARCHAR(80)   DEFAULT NULL,
    state                VARCHAR(80)   DEFAULT NULL,
    postal_code          VARCHAR(20)   DEFAULT NULL,
    country              VARCHAR(80)   DEFAULT NULL,
    default_currency     VARCHAR(20)   DEFAULT 'EUR (€)',
    approval_threshold   DECIMAL(10,2) DEFAULT 500.00,
    email_notifications  TINYINT(1)    DEFAULT 1,
    onboarding_complete  TINYINT(1)    DEFAULT 0,
    is_active            TINYINT(1)    DEFAULT 1,
    last_login_at        DATETIME      DEFAULT NULL,
    created_at           DATETIME      DEFAULT CURRENT_TIMESTAMP,
    updated_at           DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── USER SESSIONS ───────────────────────────────────
CREATE TABLE user_sessions (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    user_id       INT          NOT NULL,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    ip_address    VARCHAR(60)  DEFAULT NULL,
    is_valid      TINYINT(1)   DEFAULT 1,
    expires_at    DATETIME     NOT NULL,
    created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── EXPENSES ────────────────────────────────────────
CREATE TABLE expenses (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    user_id           INT             NOT NULL,
    subject           VARCHAR(200)    NOT NULL,
    category          VARCHAR(60)     NOT NULL DEFAULT 'Other',
    amount            DECIMAL(10,2)   NOT NULL,
    expense_date      DATE            NOT NULL,
    receipt_data      LONGTEXT        DEFAULT NULL,
    status            ENUM('pending','approved','rejected') DEFAULT 'pending',
    reject_reason     TEXT            DEFAULT NULL,
    reviewed_by       INT             DEFAULT NULL,
    reviewed_at       DATETIME        DEFAULT NULL,
    action_by         VARCHAR(120)    DEFAULT NULL,
    created_at        DATETIME        DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── TRIPS ───────────────────────────────────────────
CREATE TABLE trips (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT             NOT NULL,
    destination VARCHAR(200)    NOT NULL,
    purpose     VARCHAR(500)    NOT NULL,
    start_date  DATE            NOT NULL,
    end_date    DATE            NOT NULL,
    budget      DECIMAL(10,2)   DEFAULT 0.00,
    status      VARCHAR(40)     DEFAULT 'Planned',
    created_at  DATETIME        DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── SUPPORT MESSAGES ────────────────────────────────
CREATE TABLE support_messages (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    user_id      INT          DEFAULT NULL,
    sender_email VARCHAR(180) DEFAULT NULL,
    subject      VARCHAR(255) NOT NULL,
    category     VARCHAR(80)  DEFAULT 'General Inquiry',
    message      TEXT         NOT NULL,
    status       VARCHAR(30)  DEFAULT 'open',
    created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── DEMO ACCOUNTS ───────────────────────────────────
-- Password for both accounts: password
INSERT INTO users (name, email, password_hash, role, onboarding_complete, company, department, job_title)
VALUES
  ('Alex Johnson', 'employee@expensio.com',
   '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
   'employee', 1, 'Acme Corp', 'Marketing', 'Marketing Executive'),

  ('Sarah Manager', 'manager@expensio.com',
   '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
   'manager', 1, 'Acme Corp', 'Finance', 'Finance Manager');
