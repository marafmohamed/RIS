// MongoDB initialization script
db = db.getSiblingDB('ris_db');

// Create collections with validation
db.createCollection('users');
db.createCollection('reports');
db.createCollection('settings');
db.createCollection('templates');
db.createCollection('clinics');

// Create indexes for better performance
db.users.createIndex({ email: 1 }, { unique: true });
db.reports.createIndex({ studyInstanceUID: 1 });
db.reports.createIndex({ createdAt: -1 });
db.reports.createIndex({ userId: 1 });
db.templates.createIndex({ name: 1 });
db.clinics.createIndex({ name: 1 });

print('MongoDB initialization completed successfully');
