const state = { view: 'overview', data: { customers: [], plans: [], memberships: [], payments: [] }, config: {
  url: '',
  key: ''
}, planFilters: { service: '', duration: '' }, membershipFilter: 'active', membershipSearch: '', customerFilter: 'all', customerSearch: '', financeFilters: { startDate: '', endDate: '', account: 'all' }, paymentFilters: { startDate: '', endDate: '', method: '', status: '' }, loading: false };
try {
  const savedConfig = JSON.parse(localStorage.getItem('studioGymConfig') || 'null');
  if (savedConfig && typeof savedConfig.url === 'string' && typeof savedConfig.key === 'string') {
    state.config = savedConfig;
  }
} catch (error) {
  console.error('Konfigurasi Supabase lokal tidak dapat dibaca:', error);
}
const $ = (selector) => document.querySelector(selector);
const money = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0));
const date = (value) => value ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`)) : '-';
const initials = (name) => name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
const customerName = (id) => state.data.customers.find((item) => item.id === id)?.full_name || 'Pelanggan';
const planById = (id) => state.data.plans.find((item) => item.id === id);
const planName = (id) => planById(id)?.name || 'Paket membership';
const membershipById = (id) => state.data.memberships.find((item) => item.id === id);
const collectionFor = (type) => type === 'customer' ? 'customers' : type === 'membership' ? 'memberships' : type === 'payment' ? 'payments' : 'payments';
function planService(plan) { const value = `${plan?.name || ''} ${plan?.access_label || ''}`.toLowerCase(); if (value.includes('all access') || value.includes('all services') || value.includes('gym +')) return 'All Access'; if (value.includes('functional')) return 'Functional Training'; if (value.includes('women')) return 'Women Only'; if (value.includes('pilates')) return 'Pilates'; if (value.includes('zumba')) return 'Zumba'; if (value.includes('yoga')) return 'Yoga'; if (value.includes('gym')) return 'Gym'; return 'Other'; }
function durationLabel(months) { return Number(months) === 1 ? 'Monthly' : Number(months) === 3 ? 'Quarterly' : Number(months) === 12 ? 'Annual' : `${months} Months`; }
function addMonths(value, months) { const result = new Date(`${value}T00:00:00`); const originalDay = result.getDate(); result.setMonth(result.getMonth() + Number(months)); if (result.getDate() !== originalDay) result.setDate(0); return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, '0')}-${String(result.getDate()).padStart(2, '0')}`; }
function escapeHtml(text) { return String(text ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function showToast(message, isError = false) { const toast = $('#toast'); toast.textContent = message; toast.classList.toggle('error', isError); toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3000); }
function apiReady() { return Boolean(state.config.url && state.config.key); }
async function supabase(table, options = {}) { const response = await fetch(`${state.config.url}/rest/v1/${table}${options.query || ''}`, { method: options.method || 'GET', headers: { apikey: state.config.key, Authorization: `Bearer ${state.config.key}`, 'Content-Type': 'application/json', ...(options.method !== 'GET' ? { Prefer: 'return=representation' } : {}) }, body: options.body ? JSON.stringify(options.body) : undefined }); if (!response.ok) throw new Error(await response.text()); return response.status === 204 ? null : response.json(); }
async function supabaseAll(table) {
  const pageSize = 500;
  const rows = [];
  let offset = 0;
  while (true) {
    const response = await fetch(`${state.config.url}/rest/v1/${table}?select=*&order=created_at.asc,id.asc`, {
      method: 'GET',
      headers: {
        apikey: state.config.key,
        Authorization: `Bearer ${state.config.key}`,
        'Content-Type': 'application/json',
        Prefer: 'count=exact',
        'Range-Unit': 'items',
        Range: `${offset}-${offset + pageSize - 1}`
      }
    });
    if (!response.ok) throw new Error(await response.text());
    const page = await response.json();
    rows.push(...page);
    if (!page.length) break;
    const range = /^\d+-(\d+)\/(\d+|\*)$/.exec(response.headers.get('Content-Range') || '');
    if (range) {
      const nextOffset = Number(range[1]) + 1;
      if (range[2] !== '*' && nextOffset >= Number(range[2])) break;
      if (nextOffset <= offset) throw new Error(`Pagination Supabase ${table} tidak bergerak.`);
      offset = nextOffset;
      continue;
    }
    if (page.length < pageSize) break;
    offset += page.length;
  }
  return rows;
}
async function loadData(notify = true) {
  if (!apiReady()) { $('#connectionLabel').textContent = 'Belum dikonfigurasi'; return; }
  state.loading = true;
  $('#connectionLabel').textContent = 'Memuat data Supabase';
  render();
  try {
    const [customers, plans, memberships, payments] = await Promise.all(['customers', 'membership_plans', 'memberships', 'payments'].map(supabaseAll));
    state.data = { customers, plans, memberships, payments };
    state.loading = false;
    $('#connectionLabel').textContent = 'Supabase tersambung';
    render();
    if (notify) showToast('Data Supabase diperbarui');
  } catch (error) {
    state.loading = false;
    $('#connectionLabel').textContent = 'Koneksi gagal';
    render();
    if (notify) showToast(`Supabase belum dapat diakses: ${supabaseError(error)}`, true);
    throw error;
  }
}
function statCard(label, value, foot, accent = false) { return `<article class="stat-card ${accent ? 'accent' : ''}"><div class="stat-label"><span>${label}</span><span>↗</span></div><div class="stat-value">${value}</div><div class="stat-foot"><span class="up">●</span>${foot}</div></article>`; }
function actionButtons(type, id) { return `<div class="row-actions"><button class="table-action" data-action="edit" data-type="${type}" data-id="${escapeHtml(id)}" title="Edit data">Edit</button><button class="table-action danger" data-action="delete" data-type="${type}" data-id="${escapeHtml(id)}" title="Hapus data">Hapus</button></div>`; }
function supabaseError(error) { try { const details = JSON.parse(error.message); return details.message || details.details || details.hint || error.message; } catch (parseError) { return error.message || 'Kesalahan Supabase tidak diketahui.'; } }
function statusLabel(status) { return status === 'paid' ? 'Lunas' : status === 'pending' ? 'Pending' : status === 'refunded' ? 'Refund' : status; }
function paymentMethodLabel(method) { return method === 'qris' ? 'QRIS' : method === 'cash' ? 'Cash' : 'Transfer'; }
function paymentRevenueType(payment) {
  const note = String(payment?.notes || '');
  const marker = note.match(/^\[FORME:non-membership:(trial|day_pass)\]/i);
  if (marker) return marker[1].toLowerCase();
  if (payment?.membership_id) return 'membership';
  const source = `${payment?.reference || ''} ${note}`.toLowerCase();
  if (/\bday[ _-]?pass\b/.test(source)) return 'day_pass';
  if (/\btrial\b/.test(source)) return 'trial';
  return 'non_membership';
}
function paymentRevenueLabel(type) { return type === 'trial' ? 'Trial' : type === 'day_pass' ? 'Day Pass' : 'Non-Membership'; }
function taggedNonMembershipNotes(type, notes = '') {
  const cleaned = String(notes).replace(/^\[FORME:non-membership:(trial|day_pass)\]\s*/i, '').trim();
  return `[FORME:non-membership:${type}]${cleaned ? ` ${cleaned}` : ''}`;
}
function cleanPaymentNotes(notes = '') { return String(notes).replace(/^\[FORME:non-membership:(trial|day_pass)\]\s*/i, '').trim(); }
function monthKey(value) { const parsed = value instanceof Date ? value : new Date(`${value}T00:00:00`); return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`; }
function monthStart(key) { return new Date(`${key}-01T00:00:00`); }
function monthEnd(key) { const start = monthStart(key); return new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59); }
function dateKey(value) { const parsed = value instanceof Date ? value : new Date(`${value}T00:00:00`); return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`; }
function monthOffset(from, to) { const start = monthStart(from); const end = monthStart(to); return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth(); }
function recognitionDate(key, membership, payment) {
  const candidates = [`${key}-01`];
  if (monthKey(membership.start_date) === key) candidates.push(membership.start_date);
  if (monthKey(payment.payment_date) === key) candidates.push(payment.payment_date);
  return candidates.sort().at(-1);
}
function monthlyRecognition(membership) { const duration = Number(planById(membership.plan_id)?.duration_months || 0); return duration > 0 ? Number(membership.amount || 0) / duration : 0; }
function recognitionSchedule(payment) {
  if (!payment || payment.status !== 'paid') return [];
  const membership = membershipById(payment.membership_id);
  const duration = Number(planById(membership?.plan_id)?.duration_months || 0);
  if (!membership || !duration) return [];
  const startKey = monthKey(membership.start_date);
  const endKey = monthKey(membership.end_date);
  const servicePeriods = Math.min(duration, monthOffset(startKey, endKey) + 1);
  const paymentKey = monthKey(payment.payment_date);
  const firstPeriod = Math.max(monthOffset(startKey, paymentKey), 0);
  const remainingPeriods = servicePeriods - firstPeriod;
  if (remainingPeriods <= 0) return [];
  const amountCents = Math.round(Number(payment.amount || 0) * 100);
  const regularCents = Math.floor(amountCents / remainingPeriods);
    return Array.from({ length: remainingPeriods }, (_, index) => ({
      month: monthKey(addMonths(`${startKey}-01`, firstPeriod + index)),
      amount: (index === remainingPeriods - 1 ? amountCents - regularCents * (remainingPeriods - 1) : regularCents) / 100
    })).filter((period) => period.amount > 0);
}
function accountingRows(asOf = new Date()) {
  const asOfDate = dateKey(asOf);
  const asOfMonth = monthKey(asOf);
  const rows = [];
  const addEntry = (entryId, sourceId, entryDate, reference, description, account, debit, credit) => {
    rows.push({ entryId, sourceId, date: entryDate, reference, description, ...account, debit, credit });
  };
  state.data.payments.filter((payment) => payment.status === 'paid' && payment.payment_date <= asOfDate).forEach((payment) => {
    const membership = membershipById(payment.membership_id);
    const revenueType = paymentRevenueType(payment);
    const amount = Number(payment.amount || 0);
    const service = planService(planById(membership?.plan_id));
    const reference = payment.reference || `PAY-${String(payment.id).replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    if (revenueType !== 'membership') {
      const label = paymentRevenueLabel(revenueType);
      const description = `Penerimaan ${label} - ${customerName(payment.customer_id)}`;
      addEntry(`PAY-${payment.id}`, payment.id, payment.payment_date, reference, description, { code: '1.1.01', name: 'Kas', service: label }, amount, 0);
      addEntry(`PAY-${payment.id}`, payment.id, payment.payment_date, reference, description, { code: '4.2.01', name: 'Pendapatan Non-Membership', service: label }, 0, amount);
      return;
    }
    const description = `Penerimaan membership - ${customerName(payment.customer_id)} - ${planName(membership?.plan_id)}`;
    addEntry(`PAY-${payment.id}`, payment.id, payment.payment_date, reference, description, { code: '1.1.01', name: 'Kas', service }, amount, 0);
    addEntry(`PAY-${payment.id}`, payment.id, payment.payment_date, reference, description, { code: '2.1.01', name: 'Pendapatan Diterima di Muka', service }, 0, amount);
    recognitionSchedule(payment).filter((period) => period.month <= asOfMonth && recognitionDate(period.month, membership, payment) <= asOfDate).forEach((period) => {
      const entryId = `REV-${payment.id}-${period.month}`;
      const entryDate = recognitionDate(period.month, membership, payment);
      const entryDescription = `Pengakuan pendapatan membership - ${customerName(payment.customer_id)} - ${planName(membership?.plan_id)}`;
      addEntry(entryId, payment.id, entryDate, entryId, entryDescription, { code: '2.1.01', name: 'Pendapatan Diterima di Muka', service }, period.amount, 0);
      addEntry(entryId, payment.id, entryDate, entryId, entryDescription, { code: '4.1.01', name: 'Pendapatan Membership', service }, 0, period.amount);
    });
  });
  return rows.sort((left, right) => left.date.localeCompare(right.date) || left.entryId.localeCompare(right.entryId) || left.code.localeCompare(right.code));
}
function recognizedToDate(membership, asOf = new Date()) {
  const asOfDate = dateKey(asOf);
  return state.data.payments.filter((payment) => payment.membership_id === membership?.id && payment.status === 'paid' && payment.payment_date <= asOfDate)
    .reduce((sum, payment) => sum + recognitionSchedule(payment)
      .filter((period) => period.month <= monthKey(asOf) && recognitionDate(period.month, membership, payment) <= asOfDate)
      .reduce((periodTotal, period) => periodTotal + period.amount, 0), 0);
}
function recognizedForMonth(key) { return accountingRows().filter((row) => ['4.1.01', '4.2.01'].includes(row.code) && row.credit > 0 && monthKey(row.date) === key).reduce((sum, row) => sum + row.credit, 0); }
function accountingTotals(asOf = new Date()) {
  const rows = accountingRows(asOf);
  const totalFor = (code, field) => rows.filter((row) => row.code === code).reduce((sum, row) => sum + row[field], 0);
  const recognizedMembership = totalFor('4.1.01', 'credit') - totalFor('4.1.01', 'debit');
  const recognizedNonMembership = totalFor('4.2.01', 'credit') - totalFor('4.2.01', 'debit');
  return {
    cash: totalFor('1.1.01', 'debit') - totalFor('1.1.01', 'credit'),
    recognizedMembership,
    recognizedNonMembership,
    recognized: recognizedMembership + recognizedNonMembership,
    deferred: totalFor('2.1.01', 'credit') - totalFor('2.1.01', 'debit')
  };
}
function accountingSummaryMarkup() { const totals = accountingTotals(); return `<div class="accounting-strip"><div><span class="accounting-label">PENDAPATAN DIAKUI</span><strong>${money(recognizedForMonth(monthKey(new Date())))}</strong><small>Bulan berjalan</small></div><div><span class="accounting-label">KAS DITERIMA</span><strong>${money(totals.cash)}</strong><small>Akumulasi pembayaran lunas</small></div><div><span class="accounting-label">PENDAPATAN DITERIMA DI MUKA</span><strong>${money(totals.deferred)}</strong><small>Saldo kewajiban layanan</small></div></div>`; }
function paymentJournalMarkup(payment) {
  if (!payment || payment.status !== 'paid') return '';
  const rows = accountingRows().filter((row) => row.sourceId === payment.id);
  const entries = [...new Map(rows.map((row) => [row.entryId, rows.filter((entry) => entry.entryId === row.entryId)])).values()];
  return `<section class="journal-section"><div class="eyebrow">ACCOUNTING ENTRY</div><h3>Jurnal pembayaran</h3>${entries.map((entry) => `<div class="journal-block"><strong>${escapeHtml(entry[0].description)} · ${date(entry[0].date)}</strong>${entry.map((row) => `<div><span>${row.debit ? 'Dr' : 'Cr'} ${escapeHtml(row.name)}</span><b>${money(row.debit || row.credit)}</b></div>`).join('')}</div>`).join('')}</section>`;
}
function paidAmountForMembership(membershipId, asOf = dateKey(new Date())) {
  return state.data.payments.filter((payment) => payment.membership_id === membershipId && payment.status === 'paid' && payment.payment_date <= asOf)
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
}
function withinPeriod(value, filters) { return (!filters.startDate || value >= filters.startDate) && (!filters.endDate || value <= filters.endDate); }
function periodFilterMarkup(filters = state.financeFilters) {
  return `<div class="toolbar period-filters"><label class="form-row"><span>DARI</span><input class="form-input" type="date" data-period-filter="startDate" value="${escapeHtml(filters.startDate)}"></label><label class="form-row"><span>SAMPAI</span><input class="form-input" type="date" data-period-filter="endDate" value="${escapeHtml(filters.endDate)}"></label></div>`;
}
function membershipIsActive(membership, asOf = new Date()) {
  const today = dateKey(asOf);

  return (
    membership.status === 'active' &&
    membership.start_date <= today &&
    membership.end_date >= today
  );
}
function planAccessDescription(plan) { return plan?.access_label || planService(plan); }
function customerMembershipState(customerId, asOf = new Date()) {
  const records = state.data.memberships.filter((membership) => membership.customer_id === customerId);
  if (!records.length) return 'non_member';
  if (records.some((membership) => membershipIsActive(membership, asOf))) return 'active';
  if (records.some((membership) => membership.status === 'pending' || membership.status === 'active' && membership.start_date > dateKey(asOf))) return 'pending';
  return 'expired';
}
function memberStatusLabel(status) {
  return ({ active: 'Member Aktif', pending: 'Member Mendatang', expired: 'Member Expired', non_member: 'Non-Member' })[status] || status;
}
function effectiveMembershipStatus(membership, asOf = new Date()) {
  if (membership.status === 'cancelled') return 'Cancelled';
  if (membership.status === 'pending') return 'Pending';
  if (membershipIsActive(membership, asOf)) return 'Active';
  if (membership.status === 'active' && membership.start_date > dateKey(asOf)) return 'Pending';
  return 'Expired';
}
function revenueTrendMarkup() {
  const current = monthStart(monthKey(new Date()));
  const months = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(current);
    month.setMonth(month.getMonth() - 5 + index);
    return monthKey(month);
  });
  const values = months.map((month) => ({ month, amount: recognizedForMonth(month) }));
  const maximum = Math.max(...values.map((item) => item.amount), 0);
  return `<section class="panel"><div class="panel-header"><div><h2 class="panel-title">Revenue Trend</h2><p class="panel-subtitle">Pendapatan membership yang diakui per bulan</p></div><button class="text-button" data-view="reports">Laporan →</button></div><div class="chart-scroll"><div class="revenue-chart">${values.map(({ month, amount }) => `<div class="revenue-bar"><div class="revenue-bar-track"><span style="height:${maximum ? Math.max(amount ? 5 : 0, amount / maximum * 100) : 0}%"></span></div><strong>${money(amount)}</strong><small>${new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(monthStart(month))}</small></div>`).join('')}</div></div></section>`;
}
function membershipOverviewMarkup() {
  const activeMemberships = state.data.memberships.filter((membership) => membershipIsActive(membership));

  const counts = activeMemberships.reduce((totals, membership) => {
    totals.set(
      membership.plan_id,
      (totals.get(membership.plan_id) || 0) + 1
    );
    return totals;
  }, new Map());

  const plans = state.data.plans.filter((plan) => counts.has(plan.id));

  return `
    <section class="panel membership-overview-panel">
      <div class="panel-header">
        <div>
          <h2 class="panel-title">Membership Overview</h2>
          <p class="panel-subtitle">Member aktif berdasarkan paket</p>
        </div>
        <button class="text-button" data-action="view-active-memberships">
          View all memberships →
        </button>
      </div>

      ${
        plans.length
          ? `
            <div class="plan-list membership-overview-list">
              ${plans
                .map(
                  (plan) => `
                    <div class="plan-row">
                      <div>
                        <div class="plan-name">
                          ${escapeHtml(plan.name)}
                        </div>
                        <span class="plan-meta">
                          ${escapeHtml(planAccessDescription(plan))}
                        </span>
                      </div>

                      <div class="plan-total">
                        ${counts.get(plan.id)}
                        <small>member aktif</small>
                      </div>
                    </div>
                  `
                )
                .join('')}
            </div>
          `
          : '<div class="empty-state">Belum ada membership aktif.</div>'
      }
    </section>
  `;
}
function expiringMembershipMarkup() {
  const today = dateKey(new Date());
  const limit = new Date(`${today}T00:00:00`);
  limit.setDate(limit.getDate() + 30);
  const limitDate = dateKey(limit);
  const ending = state.data.memberships.filter((membership) => membershipIsActive(membership) && membership.end_date <= limitDate)
    .sort((left, right) => left.end_date.localeCompare(right.end_date));
  return `<section class="panel expiring-membership-panel"><div class="panel-header"><div><h2 class="panel-title">Segera Berakhir</h2><p class="panel-subtitle">Membership aktif dalam 30 hari</p></div><button class="text-button" data-action="view-active-memberships">Lihat semua →</button></div>${ending.length ? `<div class="active-membership-list">${ending.map((membership) => { const daysRemaining = Math.max(0, Math.round((new Date(`${membership.end_date}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000)); return `<div class="active-membership-row"><div class="customer"><span class="customer-avatar">${initials(customerName(membership.customer_id))}</span><div><span class="customer-name">${escapeHtml(customerName(membership.customer_id))}</span><span class="customer-id">${escapeHtml(planName(membership.plan_id))}</span></div></div><span class="service-label">Berakhir: ${date(membership.end_date)}</span><span class="badge pending">${daysRemaining} hari lagi</span></div>`; }).join('')}</div>` : '<div class="empty-state">Tidak ada membership yang segera berakhir.</div>'}</section>`;
}
function renderOverview() {
  const { customers, memberships, payments, plans } = state.data;
  const today = dateKey(new Date());
  const currentMonth = monthKey(new Date());
  const active = memberships.filter((membership) => membershipIsActive(membership));
  const newMemberships = memberships.filter((membership) => membership.start_date <= today && monthKey(membership.start_date) === currentMonth).length;
  const recognizedThisMonth = recognizedForMonth(currentMonth);
  const totals = accountingTotals();
  const limit = new Date(`${today}T00:00:00`);
  limit.setDate(limit.getDate() + 30);
  const expiringCount = memberships.filter((membership) => membershipIsActive(membership) && membership.end_date <= dateKey(limit)).length;
  const expiredCount = memberships.filter((membership) => membership.status === 'expired' || membership.status === 'active' && membership.end_date < today).length;
  const paidTransactionCount = payments.filter((payment) => payment.status === 'paid' && payment.payment_date <= today).length;
  const recentPayments = [...payments].sort((left, right) => right.payment_date.localeCompare(left.payment_date)).slice(0, 5);
  return `<div class="page-heading"><div><div class="eyebrow">FORME / FINANCIAL OVERVIEW</div><h1>Dashboard</h1><p>Aktivitas customer, kontrak membership, dan posisi keuangan studio.</p></div><div class="date-chip">${date(today)}</div></div><div class="stats-grid dashboard-stat-grid">${statCard('CUSTOMERS', customers.length, 'customer terdaftar')}${statCard('ACTIVE MEMBERS', new Set(active.map((membership) => membership.customer_id)).size, `${active.length} kontrak aktif`, true)}${statCard('MEMBERSHIP CONTRACTS', memberships.length, 'seluruh kontrak tercatat')}${statCard('NEW MEMBERSHIPS', newMemberships, 'mulai pada bulan ini')}${statCard('EXPIRING SOON', expiringCount, 'berakhir dalam 30 hari')}${statCard('EXPIRED MEMBERSHIPS', expiredCount, 'status atau tanggal akhir')}${statCard('CASH RECEIVED', money(totals.cash), `${paidTransactionCount} transaksi lunas`)}${statCard('RECOGNIZED REVENUE', money(recognizedThisMonth), 'diakui bulan berjalan')}${statCard('UNEARNED REVENUE', money(totals.deferred), 'saldo kewajiban layanan')}${statCard('PAID TRANSACTIONS', paidTransactionCount, 'penerimaan sampai hari ini')}</div><div class="dashboard-secondary-grid">${revenueTrendMarkup()}${membershipOverviewMarkup()}</div><div class="content-grid"><section class="panel"><div class="panel-header"><div><h2 class="panel-title">Recent Payments</h2><p class="panel-subtitle">Pembayaran membership terbaru</p></div><button class="text-button" data-view="payments">Lihat semua →</button></div>${paymentTable(recentPayments, true)}</section>${expiringMembershipMarkup()}</div><section class="panel dashboard-plans"><div class="panel-header"><div><h2 class="panel-title">Membership Plans</h2><p class="panel-subtitle">Paket aktif dari katalog Supabase</p></div><button class="text-button" data-view="plans">Lihat semua →</button></div><div class="plan-list">${plans.filter((plan) => plan.is_active !== false).slice(0, 6).map((plan) => `<div class="plan-row"><div><div class="plan-name">${escapeHtml(plan.name)}</div><span class="plan-meta">${durationLabel(plan.duration_months)} · ${escapeHtml(planAccessDescription(plan))}</span></div><div class="plan-total">${money(plan.price)}<small>${memberships.filter((membership) => membership.plan_id === plan.id).length} kontrak</small></div></div>`).join('') || '<div class="empty-state">Belum ada membership plan.</div>'}</div></section>`;
}
function paymentTable(rows, compact = false) { if (!rows.length) return '<div class="empty-state">Belum ada pembayaran.</div>'; return `<div class="table-wrap"><table><thead><tr><th>TANGGAL</th><th>REFERENSI</th><th>CUSTOMER</th><th>MEMBERSHIP / TIPE</th><th>NOMINAL</th><th>METODE</th><th>STATUS</th>${compact ? '' : '<th>AKSI</th>'}</tr></thead><tbody>${rows.map((item) => { const kind = paymentRevenueType(item); const membership = membershipById(item.membership_id); return `<tr><td>${date(item.payment_date)}</td><td class="amount">${escapeHtml(item.reference || 'Tanpa referensi')}</td><td><div class="customer"><span class="customer-avatar">${initials(customerName(item.customer_id))}</span><span class="customer-name">${escapeHtml(customerName(item.customer_id))}</span></div></td><td>${kind === 'membership' ? escapeHtml(planName(membership?.plan_id)) : escapeHtml(paymentRevenueLabel(kind))}</td><td class="amount">${money(item.amount)}</td><td>${paymentMethodLabel(item.payment_method)}</td><td><span class="badge ${item.status}">${statusLabel(item.status)}</span></td>${compact ? '' : `<td>${actionButtons('payment', item.id)}</td>`}</tr>`; }).join('')}</tbody></table></div>`; }
function customerTable(customers) {
  if (!customers.length) return '<div class="empty-state">Belum ada customer yang sesuai filter.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>CUSTOMER</th><th>TIPE</th><th>MEMBERSHIP / PLAN</th><th>PERIODE MEMBERSHIP</th><th>STATUS</th><th>AKSI</th></tr></thead><tbody>${customers.map((customer) => {
    const memberships = state.data.memberships.filter((membership) => membership.customer_id === customer.id)
      .sort((left, right) => right.start_date.localeCompare(left.start_date));
    const memberState = customerMembershipState(customer.id);
    const membershipDetails = memberships.map((membership) => {
      const status = effectiveMembershipStatus(membership);
      return `<div class="customer-membership-item"><div><strong>${escapeHtml(planName(membership.plan_id))}</strong><small>${date(membership.start_date)} — ${date(membership.end_date)}</small></div><span class="badge ${status.toLowerCase()}">${status}</span><div class="membership-row-actions">${actionButtons('membership', membership.id)}</div></div>`;
    }).join('');
    const status = memberships.length ? memberships.map((membership) => `<span class="badge ${effectiveMembershipStatus(membership).toLowerCase()}">${effectiveMembershipStatus(membership)}</span>`).join(' ') : '<span class="badge">Non-member</span>';
    return `<tr><td><div class="customer"><span class="customer-avatar">${initials(customer.full_name)}</span><div><span class="customer-name">${escapeHtml(customer.full_name)}</span><span class="customer-id">${escapeHtml(customer.member_code)} · ${escapeHtml(customer.email || customer.phone || 'Tanpa kontak')}</span><span class="customer-note">Bergabung ${date(customer.join_date)}${customer.notes ? ` · ${escapeHtml(customer.notes)}` : ''}</span></div></div></td><td><span class="badge ${memberState}">${memberStatusLabel(memberState)}</span></td><td>${membershipDetails || '<span class="muted-note">Belum pernah memiliki membership</span>'}</td><td>${memberships.length ? memberships.map((membership) => `<div class="membership-period-item">${date(membership.start_date)} — ${date(membership.end_date)}</div>`).join('') : '-'}</td><td>${status}</td><td>${actionButtons('customer', customer.id)}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}
function visibleCustomers() {
  const query = state.customerSearch.trim().toLowerCase();
  return state.data.customers.filter((customer) => {
    const memberState = customerMembershipState(customer.id);
    const matchesFilter = state.customerFilter === 'all' || state.customerFilter === memberState;
    const membershipText = state.data.memberships.filter((membership) => membership.customer_id === customer.id).map((membership) => planName(membership.plan_id)).join(' ');
    const searchable = `${customer.full_name} ${customer.member_code} ${customer.email} ${customer.phone} ${customer.notes} ${membershipText}`.toLowerCase();
    return matchesFilter && (!query || searchable.includes(query));
  });
}
function membershipTable(items) {
  if (!items.length) return '<div class="empty-state">Belum ada membership.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>PELANGGAN</th><th>PAKET</th><th>SERVICE</th><th>PERIODE</th><th>NOMINAL</th><th>STATUS MEMBERSHIP</th><th>STATUS PAYMENT</th><th>AKSI</th></tr></thead><tbody>${items.map((item) => {
    const plan = planById(item.plan_id);
    const today = dateKey(new Date());
    const status = item.status === 'active' && item.end_date < today ? 'expired' : item.status === 'active' && item.start_date > today ? 'pending' : item.status;
    const paid = paidAmountForMembership(item.id);
    const paymentStatus = paid <= 0 ? 'Belum dibayar' : paid + 0.005 >= Number(item.amount) ? 'Lunas' : 'Sebagian';
    const paymentBadge = paid <= 0 ? 'pending' : paymentStatus === 'Lunas' ? 'paid' : 'pending';
    return `<tr><td><div class="customer"><span class="customer-avatar">${initials(customerName(item.customer_id))}</span><span class="customer-name">${escapeHtml(customerName(item.customer_id))}</span></div></td><td>${escapeHtml(planName(item.plan_id))}</td><td>${escapeHtml(planService(plan))}</td><td>${date(item.start_date)} — ${date(item.end_date)}</td><td class="amount">${money(item.amount)}</td><td><span class="badge ${status}">${status}</span></td><td><span class="badge ${paymentBadge}">${paymentStatus}</span></td><td>${actionButtons('membership', item.id)}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}
function filteredMemberships() {
  const today = dateKey(new Date());
  const query = state.membershipSearch.trim().toLowerCase();
  return state.data.memberships.filter((membership) => {
    if (state.membershipFilter === 'active' && !membershipIsActive(membership)) return false;
    if (state.membershipFilter === 'expired' && membership.status !== 'expired' && !(membership.status === 'active' && membership.end_date < today)) return false;
    if (state.membershipFilter === 'pending' && membership.status !== 'pending' && !(membership.status === 'active' && membership.start_date > today)) return false;
    if (!['all', 'active', 'expired', 'pending'].includes(state.membershipFilter) && membership.status !== state.membershipFilter) return false;
    return !query || `${customerName(membership.customer_id)} ${planName(membership.plan_id)} ${planService(planById(membership.plan_id))}`.toLowerCase().includes(query);
  });
}
function renderMembers() { return `<div class="page-heading"><div><div class="eyebrow">CUSTOMER DIRECTORY / 02</div><h1>Customer</h1><p>Customer tetap tercatat meskipun belum memiliki membership.</p><div class="customer-page-actions"><button class="primary-button" data-action="add-customer">+ Tambah customer</button><button class="secondary-button" data-action="add-membership">+ Tambah membership</button></div></div></div><div class="toolbar customer-filters"><select class="select-input" id="customerFilter"><option value="all" ${state.customerFilter === 'all' ? 'selected' : ''}>Semua Customer</option><option value="active" ${state.customerFilter === 'active' ? 'selected' : ''}>Member Aktif</option><option value="pending" ${state.customerFilter === 'pending' ? 'selected' : ''}>Member Mendatang</option><option value="expired" ${state.customerFilter === 'expired' ? 'selected' : ''}>Member Expired</option><option value="non_member" ${state.customerFilter === 'non_member' ? 'selected' : ''}>Non-Member</option></select><input class="search-input" id="customerSearch" placeholder="Cari nama, kode, kontak, atau plan..." value="${escapeHtml(state.customerSearch)}"></div><section class="panel" id="customerPanel">${customerTable(visibleCustomers())}</section>`; }
function renderMemberships() {
  const filtered = filteredMemberships();
  return `<div class="page-heading"><div><div class="eyebrow">MEMBERSHIP REGISTER / 03</div><h1>Active Memberships</h1><p>Kontrak layanan berdasarkan status dan periode membership.</p></div><button class="primary-button" data-action="add-membership">+ Tambah membership</button></div><div class="toolbar membership-toolbar"><select class="select-input" id="membershipStatusFilter"><option value="active" ${state.membershipFilter === 'active' ? 'selected' : ''}>Aktif</option><option value="all" ${state.membershipFilter === 'all' ? 'selected' : ''}>Semua status</option><option value="expired" ${state.membershipFilter === 'expired' ? 'selected' : ''}>Berakhir</option><option value="pending" ${state.membershipFilter === 'pending' ? 'selected' : ''}>Pending</option><option value="cancelled" ${state.membershipFilter === 'cancelled' ? 'selected' : ''}>Dibatalkan</option></select><input class="search-input" id="membershipSearch" placeholder="Cari customer, plan, atau service..." value="${escapeHtml(state.membershipSearch)}"></div><section class="panel" id="membershipPanel">${membershipTable(filtered)}</section>`;
}
function renderPayments() {
  const filters = state.paymentFilters;
  const payments = state.data.payments.filter((payment) => withinPeriod(payment.payment_date, filters) && (!filters.method || payment.payment_method === filters.method) && (!filters.status || payment.status === filters.status));
  payments.sort((left, right) => right.payment_date.localeCompare(left.payment_date));
  return `<div class="page-heading"><div><div class="eyebrow">REVENUE REGISTER / 04</div><h1>Payments</h1><p>Riwayat penerimaan kas untuk membership.</p></div><button class="primary-button" data-action="add-payment">+ Catat payment</button></div><div class="toolbar payment-filters"><label class="form-row"><span>DARI</span><input class="form-input" type="date" data-payment-filter="startDate" value="${escapeHtml(filters.startDate)}"></label><label class="form-row"><span>SAMPAI</span><input class="form-input" type="date" data-payment-filter="endDate" value="${escapeHtml(filters.endDate)}"></label><label class="form-row"><span>METODE</span><select class="select-input" data-payment-filter="method"><option value="">Semua</option>${['cash', 'transfer', 'qris'].map((method) => `<option value="${method}" ${filters.method === method ? 'selected' : ''}>${paymentMethodLabel(method)}</option>`).join('')}</select></label><label class="form-row"><span>STATUS</span><select class="select-input" data-payment-filter="status"><option value="">Semua</option>${['paid', 'pending', 'refunded'].map((status) => `<option value="${status}" ${filters.status === status ? 'selected' : ''}>${statusLabel(status)}</option>`).join('')}</select></label></div><section class="panel payment-history-panel"><div class="panel-header"><div><h2 class="panel-title">Payment History</h2><p class="panel-subtitle">${payments.length} dari ${state.data.payments.length} transaksi</p></div></div>${paymentTable(payments)}</section>`;
}
function renderPlans() { const services = ['Gym', 'Pilates', 'Yoga', 'Zumba', 'Functional Training', 'Women Only', 'All Access']; const filtered = state.data.plans.filter((plan) => (!state.planFilters.service || planService(plan) === state.planFilters.service) && (!state.planFilters.duration || durationLabel(plan.duration_months) === state.planFilters.duration)); return `<div class="page-heading"><div><div class="eyebrow">MASTER DATA / 05</div><h1>Membership Plans</h1><p>Plan aktual dari membership_plans untuk pencatatan kontrak.</p></div></div><div class="plans-toolbar"><select class="select-input" id="planServiceFilter"><option value="">All services</option>${services.map((service) => `<option value="${service}" ${state.planFilters.service === service ? 'selected' : ''}>${service}</option>`).join('')}</select><select class="select-input" id="planDurationFilter"><option value="">All durations</option>${['Monthly', 'Quarterly', 'Annual'].map((duration) => `<option value="${duration}" ${state.planFilters.duration === duration ? 'selected' : ''}>${duration}</option>`).join('')}</select></div><section class="panel"><div class="panel-header"><div><h2 class="panel-title">Available Plans</h2><p class="panel-subtitle">${filtered.length} dari ${state.data.plans.length} paket</p></div></div><div class="plan-list">${filtered.map((plan) => `<div class="plan-row plan-row-detailed"><div><div class="plan-name">${escapeHtml(plan.name)}</div><span class="plan-meta"><span class="plan-service-label">${escapeHtml(planService(plan))}</span> · ${durationLabel(plan.duration_months)}</span><span class="plan-access">${escapeHtml(planAccessDescription(plan))}</span></div><div class="plan-total">${money(plan.price)}<small>${state.data.memberships.filter((item) => item.plan_id === plan.id).length} kontrak · ${plan.is_active === false ? 'Inactive' : 'Active'}</small></div></div>`).join('') || '<div class="empty-state">Tidak ada plan yang sesuai filter.</div>'}</div></section>`; }
function reportPaymentForMembership(membershipId, asOf = dateKey(new Date())) { return state.data.payments.find((payment) => payment.membership_id === membershipId && payment.status === 'paid' && payment.payment_date <= asOf); }
function renderRevenueReport() {
  const today = dateKey(new Date());
  const reportDate = state.financeFilters.endDate && state.financeFilters.endDate < today ? state.financeFilters.endDate : today;
  const asOf = new Date(`${reportDate}T23:59:59`);
  const allRows = accountingRows(asOf);
  const periodRows = allRows.filter((row) => withinPeriod(row.date, state.financeFilters));
  const paidPayments = state.data.payments.filter((payment) => payment.status === 'paid' && withinPeriod(payment.payment_date, state.financeFilters) && payment.payment_date <= reportDate);
  const cashReceived = paidPayments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const revenueCodes = ['4.1.01', '4.2.01'];
  const recognized = periodRows.filter((row) => revenueCodes.includes(row.code) && row.credit > 0).reduce((sum, row) => sum + row.credit, 0);
  const totalsAtEnd = accountingTotals(asOf);
  const revenueByService = new Map();
  periodRows.filter((row) => revenueCodes.includes(row.code) && row.credit > 0).forEach((row) => revenueByService.set(row.service, (revenueByService.get(row.service) || 0) + row.credit));
  const services = ['Gym', 'Pilates', 'Yoga', 'Zumba', 'Functional Training', 'Women Only', 'All Access', 'Trial', 'Day Pass', 'Non-Membership', 'Other'];
  const reportRows = state.data.memberships.filter((membership) => paidAmountForMembership(membership.id, reportDate) > 0 && (!state.financeFilters.startDate || membership.end_date >= state.financeFilters.startDate) && (!state.financeFilters.endDate || membership.start_date <= reportDate)).map((membership) => {
    const plan = planById(membership.plan_id);
    const payment = reportPaymentForMembership(membership.id, reportDate);
    const received = paidAmountForMembership(membership.id, reportDate);
    const recognizedToPeriod = recognizedToDate(membership, asOf);
    return { membership, plan, payment, received, recognized: recognizedToPeriod, deferred: Math.max(received - recognizedToPeriod, 0) };
  });
  const months = [...new Set(periodRows.filter((row) => revenueCodes.includes(row.code) && row.credit > 0).map((row) => monthKey(row.date)))].sort();
  const transactionCount = new Set(paidPayments.map((payment) => payment.id)).size;
  return `<div class="page-heading"><div><div class="eyebrow">REVENUE RECOGNITION / FINANCE</div><h1>Revenue &amp; Reports</h1><p>Laporan pendapatan membership dan non-membership pada periode terpilih.</p></div></div>${periodFilterMarkup()}<div class="report-summary-grid">${statCard('PAID TRANSACTIONS', transactionCount, 'dalam periode terpilih', true)}${statCard('CASH RECEIVED', money(cashReceived), 'payment lunas dalam periode')}${statCard('TOTAL RECOGNIZED REVENUE', money(recognized), 'membership + non-membership')}${statCard('UNEARNED REVENUE', money(totalsAtEnd.deferred), `saldo per ${date(reportDate)}`)}</div><section class="panel report-panel"><div class="panel-header"><div><h2 class="panel-title">Revenue by Service &amp; Type</h2><p class="panel-subtitle">Membership recognition serta penerimaan langsung trial/day pass.</p></div></div><div class="table-wrap"><table><thead><tr><th>JENIS LAYANAN / TRANSAKSI</th><th>KODE AKUN</th><th>AKUN</th><th>PENDAPATAN DIAKUI</th></tr></thead><tbody>${services.map((service) => { const nonMembership = ['Trial', 'Day Pass', 'Non-Membership'].includes(service); return `<tr><td>${service}</td><td>${nonMembership ? '4.2.01' : '4.1.01'}</td><td>${nonMembership ? 'Pendapatan Non-Membership' : 'Pendapatan Membership'}</td><td class="amount">${money(revenueByService.get(service) || 0)}</td></tr>`; }).join('')}<tr><td colspan="3"><strong>TOTAL RECOGNIZED REVENUE</strong></td><td class="amount"><strong>${money(recognized)}</strong></td></tr></tbody></table></div></section><section class="panel report-history"><div class="panel-header"><div><h2 class="panel-title">Revenue by Period</h2><p class="panel-subtitle">Total pengakuan dari akun membership dan non-membership.</p></div></div><div class="revenue-month-list">${months.map((month) => `<div><span>${date(`${month}-01`)}</span><strong>${money(periodRows.filter((row) => revenueCodes.includes(row.code) && row.credit > 0 && monthKey(row.date) === month).reduce((sum, row) => sum + row.credit, 0))}</strong></div>`).join('') || '<div class="empty-state">Belum ada pendapatan yang diakui pada periode ini.</div>'}</div></section><section class="panel report-panel"><div class="panel-header"><div><h2 class="panel-title">Membership Revenue Detail</h2><p class="panel-subtitle">Kontrak, penerimaan kas, pendapatan terakui, dan saldo diterima di muka.</p></div></div><div class="table-wrap"><table><thead><tr><th>CUSTOMER</th><th>MEMBERSHIP</th><th>PERIODE LAYANAN</th><th>NILAI KONTRAK</th><th>DITERIMA</th><th>PENDAPATAN / BULAN</th><th>SUDAH DIAKUI</th><th>DITERIMA DI MUKA</th><th>JURNAL</th></tr></thead><tbody>${reportRows.map(({ membership, plan, payment, received, recognized: recognizedAmount, deferred }) => `<tr><td>${escapeHtml(customerName(membership.customer_id))}</td><td>${escapeHtml(plan?.name || 'Membership')}</td><td>${date(membership.start_date)} — ${date(membership.end_date)}</td><td class="amount">${money(membership.amount)}</td><td class="amount">${money(received)}</td><td class="amount">${money(monthlyRecognition(membership))}</td><td class="amount">${money(recognizedAmount)}</td><td class="amount">${money(deferred)}</td><td>${payment ? `<button class="table-action" data-action="view-journal" data-id="${escapeHtml(payment.id)}">Lihat jurnal</button>` : '<span class="muted-note">Belum paid</span>'}</td></tr>`).join('') || '<tr><td colspan="9"><div class="empty-state">Tidak ada membership berbayar pada periode ini.</div></td></tr>'}</tbody></table></div><div class="panel-header"><div><h2 class="panel-title">Non-Membership Transactions</h2><p class="panel-subtitle">Penerimaan trial dan day pass yang diakui langsung.</p></div></div>${paymentTable(state.data.payments.filter((payment) => payment.payment_date <= reportDate && withinPeriod(payment.payment_date, state.financeFilters) && payment.status === 'paid' && paymentRevenueType(payment) !== 'membership'))}</section>`;
}
function renderJournal() {
  const rows = accountingRows().filter((row) => withinPeriod(row.date, state.financeFilters));
  const transactionCount = new Set(rows.map((row) => row.entryId)).size;
  return `<div class="page-heading"><div><div class="eyebrow">FINANCE / JOURNAL</div><h1>Journal</h1><p>Jurnal sistem dari penerimaan payment dan pengakuan pendapatan bulanan.</p></div></div>${periodFilterMarkup()}<section class="panel"><div class="panel-header"><div><h2 class="panel-title">Jurnal Umum</h2><p class="panel-subtitle">Setiap transaksi otomatis berpasangan dan seimbang.</p></div><span class="record-count">${transactionCount} transaksi</span></div>${rows.length ? `<div class="table-wrap"><table><thead><tr><th>TANGGAL</th><th>NOMOR BUKTI</th><th>KETERANGAN</th><th>KODE AKUN</th><th>AKUN</th><th>DEBIT</th><th>KREDIT</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${date(row.date)}</td><td class="amount">${escapeHtml(row.reference)}</td><td>${escapeHtml(row.description)}</td><td>${row.code}</td><td>${escapeHtml(row.name)}</td><td class="amount">${row.debit ? money(row.debit) : '-'}</td><td class="amount">${row.credit ? money(row.credit) : '-'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">Tidak ada jurnal pada periode ini.</div>'}</section>`;
}
function renderLedger() {
  const rows = accountingRows();
  const accounts = [
    { code: '1.1.01', name: 'Kas', normal: 'debit' },
    { code: '2.1.01', name: 'Pendapatan Diterima di Muka', normal: 'credit' },
    { code: '4.1.01', name: 'Pendapatan Membership', normal: 'credit' },
    { code: '4.2.01', name: 'Pendapatan Non-Membership', normal: 'credit' }
  ];
  const visibleAccounts = state.financeFilters.account === 'all' ? accounts : accounts.filter((account) => account.code === state.financeFilters.account);
  return `<div class="page-heading"><div><div class="eyebrow">FINANCE / GENERAL LEDGER</div><h1>General Ledger</h1><p>Mutasi, saldo awal, dan running balance dari jurnal sistem.</p></div></div><div class="toolbar ledger-filters"><label class="form-row"><span>AKUN</span><select class="select-input" data-finance-account><option value="all">Semua akun</option>${accounts.map((account) => `<option value="${account.code}" ${state.financeFilters.account === account.code ? 'selected' : ''}>${account.code} · ${account.name}</option>`).join('')}</select></label>${periodFilterMarkup()}</div>${visibleAccounts.map((account) => {
    const allAccountRows = rows.filter((row) => row.code === account.code);
    const openingRows = state.financeFilters.startDate ? allAccountRows.filter((row) => row.date < state.financeFilters.startDate) : [];
    let balance = openingRows.reduce((sum, row) => sum + (account.normal === 'debit' ? row.debit - row.credit : row.credit - row.debit), 0);
    const periodRows = allAccountRows.filter((row) => withinPeriod(row.date, state.financeFilters));
    const openingRow = state.financeFilters.startDate ? `<tr class="opening-balance-row"><td>${date(state.financeFilters.startDate)}</td><td>-</td><td>Saldo awal periode</td><td>-</td><td>-</td><td class="amount">${money(balance)}</td></tr>` : '';
    const accountRows = periodRows.map((row) => {
      balance += account.normal === 'debit' ? row.debit - row.credit : row.credit - row.debit;
      return `<tr><td>${date(row.date)}</td><td class="amount">${escapeHtml(row.reference)}</td><td>${escapeHtml(row.description)}</td><td class="amount">${row.debit ? money(row.debit) : '-'}</td><td class="amount">${row.credit ? money(row.credit) : '-'}</td><td class="amount">${money(balance)}</td></tr>`;
    }).join('');
    return `<section class="panel report-panel"><div class="panel-header"><div><h2 class="panel-title">${account.code} · ${account.name}</h2><p class="panel-subtitle">Saldo normal ${account.normal === 'debit' ? 'debit' : 'kredit'}</p></div><span class="record-count">Saldo ${money(balance)}</span></div>${accountRows || openingRow ? `<div class="table-wrap"><table><thead><tr><th>TANGGAL</th><th>NOMOR BUKTI</th><th>KETERANGAN</th><th>DEBIT</th><th>KREDIT</th><th>SALDO</th></tr></thead><tbody>${openingRow}${accountRows}</tbody></table></div>` : '<div class="empty-state">Belum ada mutasi untuk akun ini pada periode terpilih.</div>'}</section>`;
  }).join('')}`;
}
function renderSettings() { return `<div class="page-heading"><div><div class="eyebrow">SYSTEM CONFIGURATION</div><h1>Pengaturan</h1><p>Hubungkan dashboard ke project Supabase PostgreSQL Anda.</p></div></div><div class="settings-grid"><section class="panel form-card"><h3>Koneksi Supabase</h3><p>Gunakan Project URL dan Publishable Key dari pengaturan API project. Nilai disimpan hanya di browser ini.</p><form id="settingsForm"><div class="form-row"><label for="projectUrl">PROJECT URL</label><input class="form-input" id="projectUrl" type="url" placeholder="https://project-ref.supabase.co" value="${escapeHtml(state.config.url || '')}" required></div><div class="form-row"><label for="publishableKey">PUBLISHABLE KEY</label><input class="form-input" id="publishableKey" type="password" placeholder="sb_publishable_..." value="${escapeHtml(state.config.key || '')}" required></div><button class="primary-button" type="submit">Simpan & sinkronkan</button></form></section><aside class="help-box"><h3>Empat entitas, satu alur.</h3><p>customers, membership_plans, memberships, dan payments terhubung untuk pencatatan pendapatan membership.</p><p>Jalankan schema di SQL Editor Supabase, aktifkan RLS, lalu isi kredensial di sini.</p></aside></div>`; }
const dashboardHeaderMarkup = `<section class="dashboard-banner"><div class="dashboard-banner-copy"><div class="eyebrow">INTERNAL ACCOUNTING</div><h1>FORME</h1><p>Fitness &amp; wellness studio finance</p><span>Staff workspace · Membership &amp; revenue</span></div><img src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=700&q=75" alt="Area latihan FORMÉ" loading="eager"></section>`;
const spaces = { gym: { title: 'Gym Area', icon: '✦', intro: 'Strength and cardio service represented by the available membership plans.', items: ['Strength Training', 'Cardio', 'Gym Floor'] }, pilates: { title: 'Pilates', icon: '◌', intro: 'Core and mobility service represented by Pilates membership plans.', items: ['Core training', 'Mobility', 'Controlled movement'] }, yoga: { title: 'Yoga', icon: '⌁', intro: 'Balance and flexibility service represented by Yoga membership plans.', items: ['Balance', 'Flexibility', 'Mindfulness'] }, zumba: { title: 'Zumba', icon: '◉', intro: 'Dance and cardio service represented by Zumba membership plans.', items: ['Dance cardio', 'Rhythm', 'Cardio conditioning'] }, functional: { title: 'Functional Training', icon: '＋', intro: 'Movement and performance service represented by Functional Training plans.', items: ['Movement', 'Performance', 'Strength & endurance'] }, women: { title: 'Women Only', icon: '♡', intro: 'Dedicated women-only service represented by Women Only membership plans.', items: ['Dedicated area', 'Comfortable training', 'Women wellness'] } };
function activeMembershipMarkup() { const active = state.data.memberships.filter((item) => membershipIsActive(item)); return `<section class="panel active-memberships-panel"><div class="panel-header"><div><h2 class="panel-title">Active Memberships</h2><p class="panel-subtitle">Current customer plans</p></div><button class="text-button" data-action="view-active-memberships">View all →</button></div>${active.length ? `<div class="active-membership-list">${active.map((item) => { const plan = planById(item.plan_id); return `<div class="active-membership-row"><div class="customer"><span class="customer-avatar">${initials(customerName(item.customer_id))}</span><div><span class="customer-name">${escapeHtml(customerName(item.customer_id))}</span><span class="customer-id">${escapeHtml(planName(item.plan_id))}</span></div></div><span class="service-label">${escapeHtml(planService(plan))}</span><span class="badge active">Active</span></div>`; }).join('')}</div>` : '<div class="empty-state">Belum ada membership aktif.</div>'}</section>`; }
const servicesMarkup = `<section class="services-section"><div class="section-heading"><div><div class="eyebrow">STUDIO CONTEXT</div><h2>Studio Services</h2><p>Services represented through the available membership plans.</p></div></div><div class="services-grid"><article class="service-card" data-action="view-space" data-space="gym" tabindex="0" role="button"><span class="service-icon">✦</span><div><h3>Gym</h3><p>Strength · Cardio</p></div></article><article class="service-card" data-action="view-space" data-space="pilates" tabindex="0" role="button"><span class="service-icon">◌</span><div><h3>Pilates</h3><p>Core · Mobility</p></div></article><article class="service-card" data-action="view-space" data-space="yoga" tabindex="0" role="button"><span class="service-icon">⌁</span><div><h3>Yoga</h3><p>Balance · Flexibility</p></div></article><article class="service-card" data-action="view-space" data-space="zumba" tabindex="0" role="button"><span class="service-icon">◉</span><div><h3>Zumba</h3><p>Dance · Cardio</p></div></article><article class="service-card" data-action="view-space" data-space="functional" tabindex="0" role="button"><span class="service-icon">＋</span><div><h3>Functional Training</h3><p>Movement · Performance</p></div></article><article class="service-card" data-action="view-space" data-space="women" tabindex="0" role="button"><span class="service-icon">♡</span><div><h3>Women Only</h3><p>Dedicated · Comfortable</p></div></article></div></section>`;
function render() {
  const content = $('#appContent');
  const titles = { overview: 'DASHBOARD', members: 'CUSTOMER', memberships: 'MEMBERSHIP', payments: 'PAYMENTS', reports: 'REVENUE & REPORTS', plans: 'MEMBERSHIP PLANS', journal: 'JURNAL UMUM', ledger: 'BUKU BESAR', settings: 'SETTINGS' };
  $('#pageKicker').textContent = titles[state.view] || state.view.toUpperCase();
  const pages = {
    overview: () => dashboardHeaderMarkup + renderOverview() + servicesMarkup,
    members: renderMembers,
    memberships: renderMemberships,
    payments: renderPayments,
    plans: renderPlans,
    reports: renderRevenueReport,
    journal: renderJournal,
    ledger: renderLedger,
    settings: renderSettings
  };
  content.innerHTML = (pages[state.view] || renderSettings)();
  content.setAttribute('aria-busy', String(state.loading));
  if (state.loading) content.insertAdjacentHTML('afterbegin', '<div class="loading-banner" role="status">Memuat data terbaru dari Supabase...</div>');
}
function optionList(items, label) { return items.map((item) => `<option value="${item.id}">${escapeHtml(label(item))}</option>`).join(''); }
function paymentMembershipOptions(customerId, selectedId = '') { return `<option value="">Pilih membership</option>${state.data.memberships.filter((item) => !customerId || item.customer_id === customerId).map((item) => `<option value="${item.id}" ${item.id === selectedId ? 'selected' : ''}>${escapeHtml(customerName(item.customer_id))} · ${escapeHtml(planName(item.plan_id))} · ${money(item.amount)}</option>`).join('')}`; }
function inputValue(value) { return escapeHtml(value || ''); }
function syncMembershipFields(form) { if (!form || form.dataset.type !== 'membership') return; const plan = planById(form.elements.plan_id?.value); const start = form.elements.start_date?.value; const info = form.querySelector('#selectedPlanInfo'); if (info) info.innerHTML = plan ? `<div class="plan-info-grid"><span><b>Service</b>${escapeHtml(planService(plan))}</span><span><b>Duration</b>${durationLabel(plan.duration_months)}</span><span><b>Price</b>${money(plan.price)}</span><span><b>Access</b>${escapeHtml(planAccessDescription(plan))}</span></div>` : ''; if (plan && form.elements.amount && !form.dataset.id) form.elements.amount.value = plan.price; if (plan && start && form.elements.end_date) form.elements.end_date.value = addMonths(start, plan.duration_months); }
function syncPaymentFields(form) {
  if (!form || form.dataset.type !== 'payment') return;
  const paymentKind = form.elements.payment_kind?.value || 'membership';
  const membershipSelect = form.elements.membership_id;
  if (membershipSelect) {
    membershipSelect.disabled = paymentKind !== 'membership';
    membershipSelect.required = paymentKind === 'membership';
    if (paymentKind !== 'membership') membershipSelect.value = '';
  }
  form.querySelector('.journal-section')?.remove();
  if (paymentKind !== 'membership') {
    if (!form.dataset.id && form.elements.amount) form.elements.amount.value = '';
    const payment = state.data.payments.find((item) => item.id === form.dataset.id);
    if (payment && paymentRevenueType(payment) === paymentKind) form.insertAdjacentHTML('beforeend', paymentJournalMarkup(payment));
    return;
  }
  const membership = membershipById(form.elements.membership_id?.value);
  if (membership) {
    const customerField = form.elements.customer_id;
    if (customerField) customerField.value = membership.customer_id;
    if (form.elements.amount && !form.dataset.id) {
      const alreadyPaid = paidAmountForMembership(membership.id);
      form.elements.amount.value = Math.max(Number(membership.amount) - alreadyPaid, 0);
    }
  }
  const payment = state.data.payments.find((item) => item.id === form.dataset.id);
  if (payment && paymentRevenueType(payment) === paymentKind) form.insertAdjacentHTML('beforeend', paymentJournalMarkup(payment));
}
function enhancePaymentKindForm(form) {
  if (!form || form.dataset.type !== 'payment' || form.elements.payment_kind) return;
  const payment = state.data.payments.find((item) => item.id === form.dataset.id);
  const selectedKind = payment ? paymentRevenueType(payment) : 'membership';
  const membershipRow = form.elements.membership_id?.closest('.form-row');
  if (!membershipRow) return;
  membershipRow.insertAdjacentHTML('beforebegin', `<div class="form-row"><label for="paymentKind">JENIS PENERIMAAN</label><select class="select-input" id="paymentKind" name="payment_kind"><option value="membership">Membership</option><option value="trial">Trial</option><option value="day_pass">Day Pass</option><option value="non_membership">Non-Membership lainnya</option></select></div>`);
  form.elements.payment_kind.value = selectedKind;
  syncPaymentFields(form);
}
function openModal(type, item = null) { const editing = Boolean(item); const labels = { customer: 'customer', membership: 'membership', payment: 'payment' }; $('#modalTitle').textContent = `${editing ? 'Edit' : 'Tambah'} ${labels[type] || type}`; const customerOptions = optionList(state.data.customers, (customer) => `${customer.full_name} · ${customer.member_code}`).replace(`value="${item?.customer_id || ''}"`, `value="${item?.customer_id || ''}" selected`); const planOptions = optionList(state.data.plans, (plan) => `${plan.name} · ${money(plan.price)}`).replace(`value="${item?.plan_id || ''}"`, `value="${item?.plan_id || ''}" selected`); const paymentCustomerOptions = optionList(state.data.customers, (customer) => `${customer.full_name} · ${customer.member_code}`).replace(`value="${item?.customer_id || ''}"`, `value="${item?.customer_id || ''}" selected`); const paymentMembershipOptions = paymentMembershipOptionsFor(item?.customer_id || '', item?.membership_id || ''); const fields = type === 'customer' ? `<div class="inline-form"><div class="form-row"><label>KODE MEMBER</label><input class="form-input" name="member_code" value="${inputValue(item?.member_code)}" placeholder="SG-1004" required></div><div class="form-row"><label>NAMA LENGKAP</label><input class="form-input" name="full_name" value="${inputValue(item?.full_name)}" placeholder="Nama customer" required></div></div><div class="form-row"><label>EMAIL</label><input class="form-input" type="email" name="email" value="${inputValue(item?.email)}" placeholder="nama@email.com"></div><div class="form-row"><label>TELEPON</label><input class="form-input" name="phone" value="${inputValue(item?.phone)}" placeholder="+62 ..."></div>` : type === 'membership' ? `<div class="form-row"><label>CUSTOMER</label><select class="select-input" name="customer_id" required>${customerOptions}</select></div><div class="form-row"><label>MEMBERSHIP PLAN</label><select class="select-input" name="plan_id" required>${planOptions}</select><div id="selectedPlanInfo"></div></div><div class="inline-form"><div class="form-row"><label>START DATE</label><input class="form-input" type="date" name="start_date" value="${inputValue(item?.start_date || new Date().toISOString().slice(0, 10))}" required></div><div class="form-row"><label>END DATE</label><input class="form-input" type="date" name="end_date" value="${inputValue(item?.end_date)}" required></div></div><div class="inline-form"><div class="form-row"><label>AMOUNT</label><input class="form-input" type="number" min="1" name="amount" value="${inputValue(item?.amount)}" placeholder="350000" required></div><div class="form-row"><label>STATUS</label><select class="select-input" name="status"><option value="active" ${item?.status === 'active' ? 'selected' : ''}>Active</option><option value="pending" ${item?.status === 'pending' ? 'selected' : ''}>Pending</option><option value="expired" ${item?.status === 'expired' ? 'selected' : ''}>Expired</option><option value="cancelled" ${item?.status === 'cancelled' ? 'selected' : ''}>Cancelled</option></select></div></div>` : `<div class="form-row"><label>CUSTOMER</label><select class="select-input" name="customer_id" required>${paymentCustomerOptions}</select></div><div class="form-row"><label>MEMBERSHIP</label><select class="select-input" name="membership_id" required>${paymentMembershipOptions}</select></div><div class="inline-form"><div class="form-row"><label>AMOUNT</label><input class="form-input" type="number" min="1" name="amount" value="${inputValue(item?.amount)}" placeholder="350000" required></div><div class="form-row"><label>PAYMENT DATE</label><input class="form-input" type="date" name="payment_date" value="${inputValue(item?.payment_date || new Date().toISOString().slice(0, 10))}" required></div></div><div class="inline-form"><div class="form-row"><label>PAYMENT METHOD</label><select class="select-input" name="payment_method"><option value="transfer" ${item?.payment_method === 'transfer' ? 'selected' : ''}>Transfer</option><option value="qris" ${item?.payment_method === 'qris' ? 'selected' : ''}>QRIS</option><option value="cash" ${item?.payment_method === 'cash' ? 'selected' : ''}>Cash</option></select></div><div class="form-row"><label>STATUS</label><select class="select-input" name="status"><option value="paid" ${item?.status === 'paid' ? 'selected' : ''}>Lunas</option><option value="pending" ${item?.status === 'pending' ? 'selected' : ''}>Pending</option><option value="refunded" ${item?.status === 'refunded' ? 'selected' : ''}>Refund</option></select></div></div><div class="form-row"><label>REFERENCE</label><input class="form-input" name="reference" value="${inputValue(item?.reference)}" placeholder="PAY-0001"></div><div class="form-row"><label>NOTES</label><textarea class="form-input" name="notes" rows="3" placeholder="Catatan pembayaran">${inputValue(item?.notes)}</textarea></div>`; $('#entryForm').innerHTML = `${fields}<div class="modal-footer"><button type="button" class="secondary-button" id="cancelModal">Batal</button><button class="primary-button" type="submit">Simpan data</button></div>`; $('#entryForm').dataset.type = type; $('#entryForm').dataset.id = item?.id || ''; $('#modalBackdrop').hidden = false; syncMembershipFields($('#entryForm')); syncPaymentFields($('#entryForm')); }
document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-action="add-customer"], [data-action="edit"][data-type="customer"]');
  if (!trigger) return;
  queueMicrotask(() => {
    const form = $('#entryForm');
    if (form?.dataset.type !== 'customer' || form.elements.notes) return;
    const customer = state.data.customers.find((item) => item.id === form.dataset.id);
    form.querySelector('.modal-footer')?.insertAdjacentHTML('beforebegin', `<div class="form-row"><label for="customerNotes">CATATAN</label><textarea class="form-input" id="customerNotes" name="notes" rows="3" placeholder="Catatan internal customer">${escapeHtml(customer?.notes || '')}</textarea></div>`);
  });
});
function paymentMembershipOptionsFor(customerId, selectedId = '') { return paymentMembershipOptions(customerId, selectedId); }
function validateEntry(type, body, id, paymentKind = 'membership') {
  if (type === 'customer') {
    if (!body.member_code || !body.full_name) return 'Kode member dan nama wajib diisi.';
    const duplicateCode = state.data.customers.some((item) => item.id !== id && item.member_code.trim().toLowerCase() === body.member_code.trim().toLowerCase());
    const duplicateEmail = body.email && state.data.customers.some((item) => item.id !== id && item.email?.trim().toLowerCase() === body.email.trim().toLowerCase());
    if (duplicateCode) return 'Kode member sudah digunakan.';
    if (duplicateEmail) return 'Email sudah digunakan.';
  }
  if (type === 'membership' && (!body.customer_id || !body.plan_id || !body.start_date || !body.end_date)) return 'Customer, plan, dan tanggal wajib diisi.';
  if (type === 'payment' && (!body.customer_id || paymentKind === 'membership' && !body.membership_id || !body.payment_date || !body.payment_method || !body.status)) return 'Customer, kategori payment, tanggal, metode, dan status wajib diisi.';
  if ((type === 'membership' || type === 'payment') && (!Number.isFinite(Number(body.amount)) || Number(body.amount) <= 0)) return 'Amount harus berupa angka lebih dari 0.';
  if (type === 'membership' && body.end_date < body.start_date) return 'End date tidak boleh sebelum start date.';
  if (type === 'payment') {
    if (paymentKind === 'membership') {
      const membership = membershipById(body.membership_id);
      if (!membership || membership.customer_id !== body.customer_id) return 'Membership harus milik customer yang dipilih.';
      if (body.status === 'paid') {
        const otherPayments = state.data.payments.filter((payment) => payment.membership_id === body.membership_id && payment.status === 'paid' && payment.id !== id);
        const alreadyPaid = otherPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
        if (alreadyPaid + Number(body.amount) > Number(membership.amount) + 0.005) return 'Total pembayaran lunas tidak boleh melebihi nilai membership.';
      }
    }
  }
  return '';
}
async function submitEntry(event) {
  event.preventDefault();
  if (!apiReady()) { showToast('Hubungkan Supabase terlebih dahulu untuk menyimpan data.', true); return; }
  const formElement = event.target;
  if (formElement.dataset.submitting === 'true') return;
  const type = formElement.dataset.type;
  const id = formElement.dataset.id;
  const body = Object.fromEntries(new FormData(formElement).entries());
  let paymentKind = 'membership';
  if (type === 'payment') {
    paymentKind = body.payment_kind || 'membership';
    delete body.payment_kind;
    if (paymentKind === 'membership') {
      body.notes = cleanPaymentNotes(body.notes);
      body.membership_id = body.membership_id || null;
    } else {
      body.membership_id = null;
      body.notes = ['trial', 'day_pass'].includes(paymentKind) ? taggedNonMembershipNotes(paymentKind, body.notes) : cleanPaymentNotes(body.notes);
    }
  }
  if (type === 'membership' || type === 'payment') body.amount = Number(body.amount);
  const validationError = validateEntry(type, body, id, paymentKind);
  if (validationError) { showToast(validationError, true); return; }
  const table = collectionFor(type);
  formElement.dataset.submitting = 'true';
  const submitButton = formElement.querySelector('[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  try {
    if (id) {
      const updatedRows = await supabase(table, { method: 'PATCH', query: `?id=eq.${encodeURIComponent(id)}&select=*`, body });
      if (!Array.isArray(updatedRows) || updatedRows.length === 0) throw new Error('Data tidak ditemukan atau tidak dapat diperbarui.');
    } else {
      const insertedRows = await supabase(table, { method: 'POST', body });
      if (!Array.isArray(insertedRows) || insertedRows.length === 0) throw new Error('Supabase tidak mengembalikan data hasil penyimpanan.');
    }
    $('#modalBackdrop').hidden = true;
  } catch (error) {
    console.error('Gagal menyimpan data:', error);
    showToast(`Gagal ${id ? 'mengedit' : 'menyimpan'} data: ${supabaseError(error)}`, true);
    formElement.dataset.submitting = 'false';
    if (submitButton) submitButton.disabled = false;
    return;
  }
  try {
    await loadData(false);
    render();
    showToast(`${labelsForType(type)} berhasil ${id ? 'diperbarui' : 'ditambahkan'}.`);
  } catch (error) {
    console.error('Data tersimpan tetapi sinkronisasi ulang gagal:', error);
    render();
    showToast(`${labelsForType(type)} tersimpan, tetapi data terbaru gagal dimuat: ${supabaseError(error)}`, true);
  } finally {
    formElement.dataset.submitting = 'false';
    if (submitButton) submitButton.disabled = false;
  }
}
function labelsForType(type) { return type === 'customer' ? 'Customer' : type === 'membership' ? 'Membership' : 'Payment'; }
async function deleteEntry(type, id) {
  if (!apiReady()) { showToast('Hubungkan Supabase terlebih dahulu untuk menghapus data.', true); return; }
  const label = labelsForType(type);
  if (!window.confirm(`Hapus ${label} ini? Tindakan ini tidak dapat dibatalkan.`)) return;
  const table = collectionFor(type);
  try {
    const deletedRows = await supabase(table, { method: 'DELETE', query: `?id=eq.${encodeURIComponent(id)}&select=*` });
    if (!Array.isArray(deletedRows) || deletedRows.length === 0) throw new Error('Data tidak ditemukan atau tidak dapat dihapus.');
  } catch (error) {
    console.error('Gagal menghapus data:', error);
    showToast(`Data gagal dihapus: ${supabaseError(error)}`, true);
    return;
  }
  try {
    await loadData(false);
    render();
    showToast(`${label} berhasil dihapus.`);
  } catch (error) {
    console.error('Data terhapus tetapi sinkronisasi ulang gagal:', error);
    render();
    showToast(`${label} terhapus, tetapi data terbaru gagal dimuat: ${supabaseError(error)}`, true);
  }
}
document.addEventListener('click', (event) => { const target = event.target.closest('[data-action="view-active-memberships"]'); if (!target) return; state.view = 'members'; state.customerFilter = 'active'; document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === 'members')); render(); });
document.addEventListener('click', (event) => { const nav = event.target.closest('[data-view]'); if (nav) { state.view = nav.dataset.view; document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item === nav)); render(); return; } const target = event.target.closest('[data-action]'); if (!target) return; const action = target.dataset.action; if (action === 'add-customer') openModal('customer'); if (action === 'add-membership') openModal('membership'); if (action === 'add-payment') openModal('payment'); if (action === 'view-payments') { state.view = 'payments'; render(); } if (action === 'view-membership-plans') { state.view = 'plans'; document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === 'plans')); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); } if (action === 'edit') openModal(target.dataset.type, state.data[collectionFor(target.dataset.type)].find((item) => item.id === target.dataset.id)); if (action === 'delete') void deleteEntry(target.dataset.type, target.dataset.id); if (action === 'view-space') openSpaceDetail(target.dataset.space); });
document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-action="add-payment"], [data-action="edit"][data-type="payment"]');
  if (trigger) queueMicrotask(() => enhancePaymentKindForm($('#entryForm')));
});
document.addEventListener('click', (event) => { const journalTrigger = event.target.closest('[data-action="view-journal"]'); if (!journalTrigger) return; state.view = 'journal'; document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === 'journal')); render(); });
document.addEventListener('keydown', (event) => { if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.service-card')) { event.preventDefault(); openSpaceDetail(event.target.dataset.space); } });
document.addEventListener('change', (event) => {
  const target = event.target;
  if (target.name === 'payment_kind') { syncPaymentFields(target.form); return; }
  if (target.id === 'customerFilter') { state.customerFilter = target.value; render(); return; }
  if (target.dataset.periodFilter) {
    const nextFilters = { ...state.financeFilters, [target.dataset.periodFilter]: target.value };
    if (nextFilters.startDate && nextFilters.endDate && nextFilters.startDate > nextFilters.endDate) {
      showToast('Tanggal awal tidak boleh setelah tanggal akhir.', true);
      target.value = state.financeFilters[target.dataset.periodFilter];
      return;
    }
    state.financeFilters = nextFilters;
    render();
    return;
  }
  if (target.dataset.paymentFilter) { state.paymentFilters[target.dataset.paymentFilter] = target.value; render(); return; }
  if (target.dataset.financeAccount) { state.financeFilters.account = target.value; render(); return; }
  if (target.id === 'planServiceFilter') { state.planFilters.service = target.value; render(); }
  if (target.id === 'planDurationFilter') { state.planFilters.duration = target.value; render(); }
  if (target.id === 'membershipStatusFilter') { state.membershipFilter = target.value; render(); }
  if (target.name === 'plan_id' || target.name === 'start_date') syncMembershipFields(target.form);
  if (target.name === 'customer_id' && target.form?.dataset.type === 'payment') {
    const membershipSelect = target.form.elements.membership_id;
    membershipSelect.innerHTML = paymentMembershipOptions(target.value);
    syncPaymentFields(target.form);
  }
  if (target.name === 'membership_id') syncPaymentFields(target.form);
});
$('#quickAddButton').addEventListener('click', () => { openModal('payment'); queueMicrotask(() => enhancePaymentKindForm($('#entryForm'))); });
$('#refreshButton').addEventListener('click', () => { void loadData().catch((error) => console.error('Gagal memuat ulang data Supabase:', error)); });
$('#closeModal').addEventListener('click', () => { $('#modalBackdrop').hidden = true; });
document.addEventListener('click', (event) => { if (event.target.id === 'cancelModal') $('#modalBackdrop').hidden = true; });
document.addEventListener('submit', (event) => {
  if (event.target.id === 'entryForm') { void submitEntry(event); return; }
  if (event.target.id !== 'settingsForm') return;
  event.preventDefault();
  const nextConfig = { url: $('#projectUrl').value.replace(/\/$/, ''), key: $('#publishableKey').value.trim() };
  try {
    localStorage.setItem('studioGymConfig', JSON.stringify(nextConfig));
    state.config = nextConfig;
    void loadData().catch((error) => console.error('Gagal menyinkronkan konfigurasi Supabase:', error));
  } catch (error) {
    console.error('Konfigurasi Supabase tidak dapat disimpan:', error);
    showToast('Konfigurasi tidak dapat disimpan di browser ini.', true);
  }
});
document.addEventListener('input', (event) => {
  if (event.target.id === 'customerSearch') {
    state.customerSearch = event.target.value;
    $('#customerPanel').innerHTML = customerTable(visibleCustomers());
  }
  if (event.target.id === 'membershipSearch') {
    state.membershipSearch = event.target.value;
    $('#membershipPanel').innerHTML = membershipTable(filteredMemberships());
  }
});
$('#todayLabel').textContent = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
render();
loadData().catch((error) => console.error('Gagal memuat data Supabase:', error));
