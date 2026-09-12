const loginView = document.querySelector('#loginView');
const appView = document.querySelector('#appView');
const loginForm = document.querySelector('#loginForm');
const loginMessage = document.querySelector('#loginMessage');
const dialog = document.querySelector('#calculatorDialog');
const toast = document.querySelector('#toast');

if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginMessage.textContent = '';
  const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: document.querySelector('#email').value, password: document.querySelector('#password').value }) });
  if (!response.ok) { loginMessage.textContent = 'Invalid email or password.'; return; }
  loginView.classList.add('hidden');
  appView.classList.remove('hidden');
  await loadDashboard();
});

document.querySelector('#forgotLink').addEventListener('click', (event) => {
  event.preventDefault();
  loginMessage.textContent = 'For this prototype, use the prefilled demo account.';
});

document.querySelector('#logoutButton').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  appView.classList.add('hidden');
  loginView.classList.remove('hidden');
});

document.querySelector('#openCalculator').addEventListener('click', () => dialog.showModal());
document.querySelector('#closeCalculator').addEventListener('click', () => dialog.close());
document.querySelector('#lawLink').addEventListener('click', (event) => {
  event.preventDefault();
  showToast('Keep attendance, wage, leave, and deduction records for every payment.');
});

async function loadDashboard() {
  const response = await fetch('/api/dashboard');
  if (!response.ok) return;
  const data = await response.json();
  document.querySelector('#paymentRows').innerHTML = data.payments.map(paymentRow).join('');
  document.querySelector('#dashboardTotal').textContent = money(data.payments.reduce((total, payment) => total + payment.net_salary, 0) || 18420.5);
}

function paymentRow(payment) {
  const initials = payment.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  const status = payment.status === 'draft' ? 'Draft' : 'Ready';
  return `<tr><td><span class="person"><span class="avatar peach">${initials}</span><span><strong>${payment.name}</strong><small>${payment.employee_code}</small></span></span></td><td>${payment.location}</td><td>${payment.method}</td><td>${payment.days_worked} / ${payment.period_days}</td><td><strong>${money(payment.net_salary)}</strong></td><td><span class="status-tag ${payment.status === 'draft' ? 'amber' : 'green'}">${status}</span></td><td><button class="row-menu">⋮</button></td></tr>`;
}

const fields = ['salaryAmount', 'daysWorked', 'periodDays', 'extraHours', 'extraIncome', 'otherEarnings', 'deductions', 'socialSecurity'];
const money = (value) => `OMR ${value.toLocaleString('en-OM', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
const numberValue = (id) => Number(document.querySelector(`#${id}`).value) || 0;

function calculateSalary() {
  const salary = numberValue('salaryAmount');
  const worked = numberValue('daysWorked');
  const period = Math.max(numberValue('periodDays'), 1);
  const earnings = numberValue('extraIncome') + numberValue('otherEarnings');
  const deductions = numberValue('deductions') + numberValue('socialSecurity');
  const prorated = salary * Math.min(Math.max(worked, 0), period) / period;
  const net = Math.max(0, prorated + earnings - deductions);
  document.querySelector('#netSalary').textContent = money(net);
  document.querySelector('#calculationHint').textContent = `${salary.toFixed(3)} × ${worked} / ${period} + earnings − deductions`;
}

fields.forEach((id) => document.querySelector(`#${id}`).addEventListener('input', calculateSalary));
document.querySelectorAll('input[name="method"]').forEach((input) => input.addEventListener('change', () => {
  const isCalendar = document.querySelector('input[name="method"]:checked').value === 'calendar';
  document.querySelector('#periodDays').value = isCalendar ? 31 : 26;
  calculateSalary();
}));

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 3200);
}

document.querySelector('#salaryForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = document.querySelector('#employeeName').value.trim() || 'New employee';
  const id = document.querySelector('#employeeId').value.trim() || 'OM-10501';
  const method = document.querySelector('input[name="method"]:checked').value === 'calendar' ? 'Calendar days' : 'Working days';
  const worked = numberValue('daysWorked');
  const period = numberValue('periodDays');
  const net = document.querySelector('#netSalary').textContent;
  const response = await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, employeeCode: id, period: document.querySelector('#salaryPeriod').value, method: method === 'Calendar days' ? 'calendar' : 'working', salaryAmount: numberValue('salaryAmount'), daysWorked: worked, periodDays: period, extraHours: numberValue('extraHours'), extraIncome: numberValue('extraIncome'), otherEarnings: numberValue('otherEarnings'), deductions: numberValue('deductions'), socialSecurity: numberValue('socialSecurity'), notes: document.querySelector('#notes').value }) });
  if (!response.ok) { showToast('Payment could not be saved.'); return; }
  await loadDashboard();
  dialog.close();
  showToast(`${name}'s salary payment was added as a draft.`);
});

calculateSalary();
