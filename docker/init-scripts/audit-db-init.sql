-- Audit Database Initialization Script

-- Create audit database if it doesn't exist
SELECT 'CREATE DATABASE nepa_audit'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nepa_audit')\gexec

-- Connect to audit database
\c nepa_audit;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create indexes for better performance
-- These will be created by Prisma, but we can add additional ones here

-- Performance optimization indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_desc ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created_at ON audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created_at ON audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_created_at ON audit_logs (resource, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity_created_at ON audit_logs (severity, created_at DESC);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_action_date ON audit_logs (user_id, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_action_date ON audit_logs (resource, action, created_at DESC);

-- Full-text search index for descriptions
CREATE INDEX IF NOT EXISTS idx_audit_logs_description_gin ON audit_logs USING gin (to_tsvector('english', description));

-- Event sourcing indexes
CREATE INDEX IF NOT EXISTS idx_audit_events_aggregate_timestamp ON audit_events (aggregate_id, aggregate_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_event_type_timestamp ON audit_events (event_type, timestamp DESC);

-- Compliance report indexes
CREATE INDEX IF NOT EXISTS idx_compliance_reports_type_date ON compliance_reports (report_type, start_date, end_date);

-- Create a function to automatically set retention dates
CREATE OR REPLACE FUNCTION set_audit_retention_date()
RETURNS TRIGGER AS $$
DECLARE
    retention_days INTEGER;
BEGIN
    -- Get retention policy for the resource type
    SELECT retention_days INTO retention_days
    FROM audit_retention_policies
    WHERE resource_type = NEW.resource AND is_active = true;
    
    -- If no specific policy found, use default
    IF retention_days IS NULL THEN
        SELECT retention_days INTO retention_days
        FROM audit_retention_policies
        WHERE resource_type = 'default' AND is_active = true;
    END IF;
    
    -- Set retention date (default to 90 days if no policy found)
    NEW.retention_date = NEW.created_at + INTERVAL '1 day' * COALESCE(retention_days, 90);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set retention dates
-- This will be created after Prisma creates the tables

-- Create a function for audit log cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_audit_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_logs
    WHERE retention_date < NOW() AND is_archived = false;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a function for audit log archival
CREATE OR REPLACE FUNCTION archive_old_audit_logs(days_old INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    UPDATE audit_logs
    SET is_archived = true
    WHERE created_at < (NOW() - INTERVAL '1 day' * days_old)
    AND is_archived = false;
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Create a view for audit statistics
CREATE OR REPLACE VIEW audit_statistics AS
SELECT
    COUNT(*) as total_logs,
    COUNT(*) FILTER (WHERE status = 'SUCCESS') as success_count,
    COUNT(*) FILTER (WHERE status = 'FAILURE') as failure_count,
    COUNT(*) FILTER (WHERE severity = 'HIGH') as high_severity_count,
    COUNT(*) FILTER (WHERE severity = 'CRITICAL') as critical_severity_count,
    COUNT(*) FILTER (WHERE is_archived = true) as archived_count,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT resource) as unique_resources,
    MIN(created_at) as oldest_log,
    MAX(created_at) as newest_log
FROM audit_logs;

-- Create a view for daily audit summary
CREATE OR REPLACE VIEW daily_audit_summary AS
SELECT
    DATE(created_at) as log_date,
    COUNT(*) as total_events,
    COUNT(*) FILTER (WHERE status = 'SUCCESS') as success_events,
    COUNT(*) FILTER (WHERE status = 'FAILURE') as failure_events,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT action) as unique_actions,
    COUNT(DISTINCT resource) as unique_resources
FROM audit_logs
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY log_date DESC;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO postgres;

-- Log the initialization
INSERT INTO audit_logs (
    id,
    action,
    resource,
    description,
    severity,
    status,
    created_at
) VALUES (
    uuid_generate_v4(),
    'SYSTEM_MAINTENANCE',
    'audit',
    'Audit database initialized',
    'LOW',
    'SUCCESS',
    NOW()
) ON CONFLICT DO NOTHING;