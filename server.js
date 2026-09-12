const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cookieSession = require('cookie-session');
const Database = require('better-sqlite3');

const app = express();
const port = Number(process.env.PORT || 3000);
const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'payflow.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'payroll_admin', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS employees (id INTEGER PRIMARY KEY, employee_code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, location TEXT NOT NULL DEFAULT 'Al Khuwair', bank_name TEXT, bank_account_last4 TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS payroll_runs (id INTEGER PRIMARY KEY, period TEXT UNIQUE NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_by INTEGER NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(created_by) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY, run_id INTEGER NOT NULL, employee_id INTEGER NOT NULL, method TEXT NOT NULL, salary_amount REAL NOT NULL, days_worked REAL NOT NULL, period_days REAL NOT NULL, extra_hours REAL NOT NULL DEFAULT 0, extra_income REAL NOT NULL DEFAULT 0, other_earnings REAL NOT NULL DEFAULT 0, deductions REAL NOT NULL DEFAULT 0, social_security REAL NOT NULL DEFAULT 0, net_salary REAL NOT NULL, notes TEXT, status TEXT NOT NULL DEFAULT 'draft', created_by INTEGER NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(run_id) REFERENCES payroll_runs(id), FOREIGN KEY(employee_id) REFERENCES employees(id));
CREATE TABLE IF NOT EXISTS audit_events (id INTEGER PRIMARY KEY, user_id INTEGER, action TEXT NOT NULL, entity TEXT NOT NULL, entity_id INTEGER, details TEXT, created_at TEXT NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id));
`);
const now = () => new Date().toISOString();
const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => ({ salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') });
const verifyPassword = (password, encoded) => { const [salt, hash] = encoded.split(':'); const actual = crypto.scryptSync(password, salt, 64); return crypto.timingSafeEqual(actual, Buffer.from(hash, 'hex')); };
let seededUser = db.prepare('SELECT id FROM users WHERE email = ?').get('payroll@company.om');
if (!seededUser) { const password = hashPassword(process.env.DEMO_PASSWORD || 'payflow'); const result = db.prepare('INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)').run('payroll@company.om', 'Ahmed Khalid', `${password.salt}:${password.hash}`, now()); seededUser = { id: result.lastInsertRowid }; }
if (!db.prepare('SELECT id FROM payroll_runs WHERE period = ?').get('2026-07')) db.prepare('INSERT INTO payroll_runs (period, created_by, created_at) VALUES (?, ?, ?)').run('2026-07', seededUser.id, now());

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieSession({ name: 'payflow_session', keys: [process.env.SESSION_SECRET || 'change-this-session-secret'], httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 60 * 60 * 1000 }));
const requireAuth = (req, res, next) => req.session?.userId ? next() : res.status(401).json({ error: 'Authentication required' });
const audit = (userId, action, entity, entityId, details = {}) => db.prepare('INSERT INTO audit_events (user_id, action, entity, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(userId, action, entity, entityId, JSON.stringify(details), now());
const calculate = (body) => { const salary = Math.max(Number(body.salaryAmount) || 0, 0); const worked = Math.max(Number(body.daysWorked) || 0, 0); const period = Math.max(Number(body.periodDays) || 1, 1); const base = salary * Math.min(worked, period) / period; const additions = (Number(body.extraIncome) || 0) + (Number(body.otherEarnings) || 0); const deductions = (Number(body.deductions) || 0) + (Number(body.socialSecurity) || 0); return Math.max(0, Number((base + additions - deductions).toFixed(3))); };

app.post('/api/auth/login', (req, res) => { const record = db.prepare('SELECT id, email, name, role, password_hash FROM users WHERE email = ?').get(String(req.body.email || '').trim().toLowerCase()); if (!record || !verifyPassword(String(req.body.password || ''), record.password_hash)) return res.status(401).json({ error: 'Invalid email or password' }); req.session.userId = record.id; audit(record.id, 'login', 'user', record.id); res.json({ user: { id: record.id, email: record.email, name: record.name, role: record.role } }); });
app.post('/api/auth/logout', requireAuth, (req, res) => { audit(req.session.userId, 'logout', 'user', req.session.userId); req.session = null; res.status(204).end(); });
app.get('/api/dashboard', requireAuth, (req, res) => { const run = db.prepare('SELECT * FROM payroll_runs WHERE period = ?').get('2026-07'); const payments = db.prepare('SELECT p.*, e.name, e.employee_code, e.location FROM payments p JOIN employees e ON e.id = p.employee_id WHERE p.run_id = ? ORDER BY p.id DESC').all(run.id); const employees = db.prepare('SELECT COUNT(*) AS count FROM employees WHERE active = 1').get().count; res.json({ run, payments, employees }); });
app.post('/api/payments', requireAuth, (req, res) => { const body = req.body || {}; if (!body.name || !body.employeeCode) return res.status(400).json({ error: 'Employee name and ID are required' }); const timestamp = now(); const result = db.transaction(() => { let employee = db.prepare('SELECT id FROM employees WHERE employee_code = ?').get(body.employeeCode); if (!employee) { const inserted = db.prepare('INSERT INTO employees (employee_code, name, location, created_at) VALUES (?, ?, ?, ?)').run(body.employeeCode, body.name, body.location || 'New location', timestamp); employee = { id: inserted.lastInsertRowid }; } const run = db.prepare('SELECT id FROM payroll_runs WHERE period = ?').get(body.period || '2026-07'); const net = calculate(body); const inserted = db.prepare('INSERT INTO payments (run_id, employee_id, method, salary_amount, days_worked, period_days, extra_hours, extra_income, other_earnings, deductions, social_security, net_salary, notes, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(run.id, employee.id, body.method === 'calendar' ? 'Calendar days' : 'Working days', Number(body.salaryAmount) || 0, Number(body.daysWorked) || 0, Number(body.periodDays) || 1, Number(body.extraHours) || 0, Number(body.extraIncome) || 0, Number(body.otherEarnings) || 0, Number(body.deductions) || 0, Number(body.socialSecurity) || 0, net, body.notes || null, req.session.userId, timestamp); audit(req.session.userId, 'create', 'payment', inserted.lastInsertRowid, { employeeCode: body.employeeCode, netSalary: net }); return db.prepare('SELECT p.*, e.name, e.employee_code, e.location FROM payments p JOIN employees e ON e.id = p.employee_id WHERE p.id = ?').get(inserted.lastInsertRowid); })(); res.status(201).json({ payment: result }); });
app.use(express.static(__dirname));
app.listen(port, () => console.log(`Payflow Oman running at http://localhost:${port}`));
