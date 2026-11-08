// Test environment. Requires a disposable PostgreSQL database in TEST_DATABASE_URL (or DATABASE_URL).
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://nh:nh@localhost:5432/nhealth_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-test-secret-test-secret-123';
process.env.PAYSTACK_SECRET_KEY = 'sk_test_dummy';
process.env.DIDIT_WEBHOOK_SECRET = 'didit_test_secret';
process.env.DIDIT_API_KEY = 'didit_key';
process.env.DIDIT_WORKFLOW_ID = 'wf';
