-- SPA対応システム用データベーススキーマ
-- PostgreSQL 15 対応

-- データベース設定
SET timezone = 'Asia/Tokyo';
SET client_encoding = 'UTF8';

-- テーブル作成

-- 1. シフトテーブル
CREATE TABLE IF NOT EXISTS shift (
    shift_id SERIAL PRIMARY KEY,
    workset_id INTEGER NOT NULL DEFAULT 1,
    employee_id INTEGER NOT NULL,
    employee_name VARCHAR(100) NOT NULL,
    shift_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    kinmu_pattern_id INTEGER,
    status VARCHAR(20) DEFAULT 'active',
    work_hours DECIMAL(4,2),
    overtime_hours DECIMAL(4,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_by VARCHAR(50)
);

-- 2. 勤務パターンマスタ
CREATE TABLE IF NOT EXISTS kinmupattern (
    kinmu_pattern_id SERIAL PRIMARY KEY,
    workset_id INTEGER NOT NULL DEFAULT 1,
    pattern_name VARCHAR(50) NOT NULL,
    pattern_code VARCHAR(10) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_minutes INTEGER DEFAULT 0,
    work_hours DECIMAL(4,2) NOT NULL,
    color_code VARCHAR(7) DEFAULT '#4CAF50',
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. 休日マスタ
CREATE TABLE IF NOT EXISTS kyujitumaster (
    kyujitu_id SERIAL PRIMARY KEY,
    workset_id INTEGER NOT NULL DEFAULT 1,
    kyujitu_date DATE NOT NULL,
    kyujitu_name VARCHAR(100) NOT NULL,
    kyujitu_type VARCHAR(20) DEFAULT 'holiday',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. タスクテーブル
CREATE TABLE IF NOT EXISTS task (
    task_id SERIAL PRIMARY KEY,
    workset_id INTEGER NOT NULL DEFAULT 1,
    task_name VARCHAR(200) NOT NULL,
    task_code VARCHAR(20),
    employee_id INTEGER,
    assigned_date DATE,
    due_date DATE,
    status VARCHAR(20) DEFAULT 'pending',
    priority INTEGER DEFAULT 3,
    description TEXT,
    estimated_hours DECIMAL(4,2),
    actual_hours DECIMAL(4,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_by VARCHAR(50)
);

-- 5. 作業テーブル
CREATE TABLE IF NOT EXISTS sagyo (
    sagyo_id SERIAL PRIMARY KEY,
    workset_id INTEGER NOT NULL DEFAULT 1,
    sagyo_name VARCHAR(200) NOT NULL,
    sagyo_code VARCHAR(20),
    sagyo_type VARCHAR(50),
    location VARCHAR(100),
    responsible_employee_id INTEGER,
    start_datetime TIMESTAMP,
    end_datetime TIMESTAMP,
    status VARCHAR(20) DEFAULT 'planning',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50),
    updated_by VARCHAR(50)
);

-- インデックス作成
CREATE INDEX idx_shift_workset_date ON shift(workset_id, shift_date);
CREATE INDEX idx_shift_employee ON shift(employee_id);
CREATE INDEX idx_kinmupattern_workset ON kinmupattern(workset_id);
CREATE INDEX idx_kyujitumaster_workset_date ON kyujitumaster(workset_id, kyujitu_date);
CREATE INDEX idx_task_workset_employee ON task(workset_id, employee_id);
CREATE INDEX idx_sagyo_workset_datetime ON sagyo(workset_id, start_datetime);

-- PostgreSQL NOTIFY/LISTEN用トリガー関数
CREATE OR REPLACE FUNCTION notify_shift_changes()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'shift_updated_' || COALESCE(NEW.workset_id, OLD.workset_id)::text,
        json_build_object(
            'operation', TG_OP,
            'table', 'shift',
            'workset_id', COALESCE(NEW.workset_id, OLD.workset_id),
            'shift_id', COALESCE(NEW.shift_id, OLD.shift_id),
            'employee_id', COALESCE(NEW.employee_id, OLD.employee_id),
            'shift_date', COALESCE(NEW.shift_date, OLD.shift_date)::text,
            'timestamp', extract(epoch from now())
        )::text
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_kinmupattern_changes()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'kinmupattern_updated_' || COALESCE(NEW.workset_id, OLD.workset_id)::text,
        json_build_object(
            'operation', TG_OP,
            'table', 'kinmupattern',
            'workset_id', COALESCE(NEW.workset_id, OLD.workset_id),
            'kinmu_pattern_id', COALESCE(NEW.kinmu_pattern_id, OLD.kinmu_pattern_id),
            'timestamp', extract(epoch from now())
        )::text
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_kyujitu_changes()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'kyujitu_updated_' || COALESCE(NEW.workset_id, OLD.workset_id)::text,
        json_build_object(
            'operation', TG_OP,
            'table', 'kyujitumaster',
            'workset_id', COALESCE(NEW.workset_id, OLD.workset_id),
            'kyujitu_id', COALESCE(NEW.kyujitu_id, OLD.kyujitu_id),
            'timestamp', extract(epoch from now())
        )::text
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_task_changes()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'task_updated_' || COALESCE(NEW.workset_id, OLD.workset_id)::text,
        json_build_object(
            'operation', TG_OP,
            'table', 'task',
            'workset_id', COALESCE(NEW.workset_id, OLD.workset_id),
            'task_id', COALESCE(NEW.task_id, OLD.task_id),
            'timestamp', extract(epoch from now())
        )::text
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_sagyo_changes()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'sagyo_updated_' || COALESCE(NEW.workset_id, OLD.workset_id)::text,
        json_build_object(
            'operation', TG_OP,
            'table', 'sagyo',
            'workset_id', COALESCE(NEW.workset_id, OLD.workset_id),
            'sagyo_id', COALESCE(NEW.sagyo_id, OLD.sagyo_id),
            'timestamp', extract(epoch from now())
        )::text
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- トリガー作成
DROP TRIGGER IF EXISTS shift_notify_trigger ON shift;
CREATE TRIGGER shift_notify_trigger
    AFTER INSERT OR UPDATE OR DELETE ON shift
    FOR EACH ROW EXECUTE FUNCTION notify_shift_changes();

DROP TRIGGER IF EXISTS kinmupattern_notify_trigger ON kinmupattern;
CREATE TRIGGER kinmupattern_notify_trigger
    AFTER INSERT OR UPDATE OR DELETE ON kinmupattern
    FOR EACH ROW EXECUTE FUNCTION notify_kinmupattern_changes();

DROP TRIGGER IF EXISTS kyujitu_notify_trigger ON kyujitumaster;
CREATE TRIGGER kyujitu_notify_trigger
    AFTER INSERT OR UPDATE OR DELETE ON kyujitumaster
    FOR EACH ROW EXECUTE FUNCTION notify_kyujitu_changes();

DROP TRIGGER IF EXISTS task_notify_trigger ON task;
CREATE TRIGGER task_notify_trigger
    AFTER INSERT OR UPDATE OR DELETE ON task
    FOR EACH ROW EXECUTE FUNCTION notify_task_changes();

DROP TRIGGER IF EXISTS sagyo_notify_trigger ON sagyo;
CREATE TRIGGER sagyo_notify_trigger
    AFTER INSERT OR UPDATE OR DELETE ON sagyo
    FOR EACH ROW EXECUTE FUNCTION notify_sagyo_changes();

-- 初期データ投入

-- 勤務パターンマスタの初期データ
INSERT INTO kinmupattern (workset_id, pattern_name, pattern_code, start_time, end_time, work_hours, color_code, display_order) VALUES
(1, '通常勤務', 'REG', '09:00:00', '18:00:00', 8.0, '#4CAF50', 1),
(1, '早番', 'EARLY', '06:00:00', '15:00:00', 8.0, '#2196F3', 2),
(1, '遅番', 'LATE', '13:00:00', '22:00:00', 8.0, '#FF9800', 3),
(1, '夜勤', 'NIGHT', '22:00:00', '07:00:00', 8.0, '#9C27B0', 4),
(1, '半日午前', 'HALF_AM', '09:00:00', '13:00:00', 4.0, '#03A9F4', 5),
(1, '半日午後', 'HALF_PM', '13:00:00', '17:00:00', 4.0, '#00BCD4', 6),
(1, '休み', 'OFF', NULL, NULL, 0.0, '#F44336', 7),
(1, '有給', 'PAID_LEAVE', NULL, NULL, 0.0, '#E91E63', 8);

-- サンプル社員データ
INSERT INTO shift (workset_id, employee_id, employee_name, shift_date, start_time, end_time, kinmu_pattern_id, work_hours) VALUES
(1, 1, '田中太郎', CURRENT_DATE, '09:00:00', '18:00:00', 1, 8.0),
(1, 2, '佐藤花子', CURRENT_DATE, '09:00:00', '18:00:00', 1, 8.0),
(1, 3, '鈴木一郎', CURRENT_DATE, '06:00:00', '15:00:00', 2, 8.0),
(1, 4, '高橋美咲', CURRENT_DATE, '13:00:00', '22:00:00', 3, 8.0),
(1, 5, '山田健太', CURRENT_DATE, NULL, NULL, 7, 0.0);

-- 休日マスタサンプル
INSERT INTO kyujitumaster (workset_id, kyujitu_date, kyujitu_name, kyujitu_type) VALUES
(1, '2025-01-01', '元日', 'national_holiday'),
(1, '2025-01-13', '成人の日', 'national_holiday'),
(1, '2025-02-11', '建国記念の日', 'national_holiday'),
(1, '2025-02-23', '天皇誕生日', 'national_holiday');

-- 権限設定
GRANT ALL PRIVILEGES ON DATABASE shift_db TO spa_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO spa_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO spa_user;

-- 完了メッセージ
SELECT 'Database initialization completed successfully!' as status;