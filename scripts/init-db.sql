-- Initialize PostgreSQL for PrivacyOps development
-- This runs on first docker-compose up

-- Create separate database for Temporal
CREATE DATABASE temporal;
CREATE DATABASE temporal_visibility;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
