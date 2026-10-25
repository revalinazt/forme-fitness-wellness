const state = { view: 'overview', data: { customers: [], plans: [], memberships: [], payments: [] }, dataError: '', dataLoaded: false, plansLoaded: false, plansLoading: false, plansError: '', membershipsLoaded: false, config: {
  url: '',
  key: ''
}, planFilters: { service: '', duration: '' }, membershipFilter: 'all', membershipSearch: '', customerFilter: 'all', customerSearch: '', financeFilters: { startDate: '', endDate: '', account: 'all' }, paymentFilters: { startDate: '', endDate: '', method: '', status: '' }, loading: false, loadSequence: 0 };
try {
  const savedConfig = JSON.parse(localStorage.getItem('studioGymConfig') || 'null');
  if (savedConfig && typeof savedConfig.url === 'string' && typeof savedConfig.key === 'string') {
    state.config = savedConfig;
  }
} catch (error) {
  console.error('Konfigurasi Supabase lokal tidak dapat dibaca:', error);
}
const $ = (selector) => document.querySelector(selector);
const MEMBERSHIP_REPORT_SERVICES = ['Gym', 'Pilates', 'Yoga', 'Zumba', 'Functional Training', 'All Access'];
const money = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0));
const toCents = (value) => Number.isFinite(Number(value)) ? Math.round(Number(value) * 100) : 0;
const fromCents = (value) => value / 100;
const date = (value) => value ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`)) : '-';
const initials = (name) => name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
const sameId = (left, right) => String(left || '').toLowerCase() === String(right || '').toLowerCase();
const customerName = (id) => state.data.customers.find((item) => sameId(item.id, id))?.full_name || 'Pelanggan';
const planById = (id) => state.data.plans.find((item) => sameId(item.id, id));
const planName = (id) => planById(id)?.name || 'Paket membership';
const membershipById = (id) => state.data.memberships.find((item) => sameId(item.id, id));
const collectionFor = (type) => type === 'customer' ? 'customers' : type === 'membership' ? 'memberships' : type === 'payment' ? 'payments' : 'payments';
function planService(plan) {
  const name = String(plan?.name || '').toLowerCase();
  const access = String(plan?.access_label || '').toLowerCase();
  const identify = (value) => {
    if (value.includes('all access') || value.includes('all services') || value.includes('gym +')) return 'All Access';
    if (value.includes('functional') || value.includes('movement & performance')) return 'Functional Training';
    if (value.includes('pilates') || value.includes('core & mobility')) return 'Pilates';
    if (value.includes('zumba') || value.includes('dance & cardio')) return 'Zumba';
    if (value.includes('yoga') || value.includes('balance & flexibility')) return 'Yoga';
    if (value.includes('gym') || value.includes('women') || value.includes('strength & cardio') || value.includes('dedicated area for women')) return 'Gym';
    return '';
  };
  return identify(name) || identify(access) || 'Unclassified';
}
function isWomenOnlyPlan(plan) { return `${plan?.name || ''} ${plan?.access_label || ''}`.toLowerCase().includes('women'); }
function canonicalService(value, allowed = [...MEMBERSHIP_REPORT_SERVICES]) { return allowed.find((service) => service.toLowerCase() === String(value || '').trim().toLowerCase()) || ''; }
function durationLabel(months) { return Number(months) === 1 ? 'Monthly' : Number(months) === 3 ? 'Quarterly' : Number(months) === 12 ? 'Annual' : `${months} Months`; }
function durationDescription(months) { return Number(months) === 1 ? '1 bulan' : Number(months) === 3 ? '3 bulan' : Number(months) === 12 ? '12 bulan' : `${months} bulan`; }
function planIsActive(plan) { const value = plan?.is_active; return value === true || value === 1 || typeof value === 'string' && ['true', 't', '1'].includes(value.trim().toLowerCase()); }
function availablePlans() { return state.data.plans.filter((plan) => planIsActive(plan) && !isWomenOnlyPlan(plan)); }
function planBenefits(plan) {
  const service = planService(plan);
  if (service === 'All Access') {
    return [
      'Gym setiap hari selama jam operasional; kunjungan harian tanpa batas saat membership aktif',
      'Pilates maksimal 8 sesi per bulan',
      'Yoga maksimal 8 sesi per bulan',
      'Zumba maksimal 12 sesi per bulan',
      'Functional Training maksimal 8 sesi per bulan',
      'Kelas mengikuti jadwal, kapasitas, dan ketentuan reservasi studio'
    ];
  }
  if (service === 'Gym') return ['Akses gym setiap hari selama jam operasional dan membership aktif', 'Area gym, alat beban, dan mesin kardio', 'Kunjungan harian tanpa batas'];
  const monthlyLimit = { Pilates: 8, Yoga: 8, Zumba: 12, 'Functional Training': 8 }[service];
  if (monthlyLimit) return [`Maksimal ${monthlyLimit} sesi ${service} per bulan`, 'Kelas mengikuti jadwal, kapasitas, dan ketentuan reservasi studio'];
  return [plan?.access_label || 'Fasilitas paket belum dijelaskan.'];
}
function addMonths(value, months) {
  const result = new Date(`${value}T00:00:00`);
  const originalDay = result.getDate();
  result.setMonth(result.getMonth() + Number(months));
  if (result.getDate() !== originalDay) result.setDate(0);
  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, '0')}-${String(result.getDate()).padStart(2, '0')}`;
}
function escapeHtml(text) { return String(text ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function showToast(message, isError = false) { const toast = $('#toast'); toast.textContent = message; toast.classList.toggle('error', isError); toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3000); }
function apiReady() { return Boolean(state.config.url && state.config.key); }
async function supabase(table, options = {}) { const response = await fetch(`${state.config.url}/rest/v1/${table}${options.query || ''}`, { method: options.method || 'GET', headers: { apikey: state.config.key, Authorization: `Bearer ${state.config.key}`, 'Content-Type': 'application/json', ...(options.method !== 'GET' ? { Prefer: 'return=representation' } : {}) }, body: options.body ? JSON.stringify(options.body) : undefined }); if (!response.ok) throw new Error(await response.text()); return response.status === 204 ? null : response.json(); }
async function supabaseAll(table, query = '?select=*&order=created_at.asc,id.asc') {
  const pageSize = 500;
  const rows = [];
  let offset = 0;
  while (true) {
    const response = await fetch(`${state.config.url}/rest/v1/${table}${query}`, {
      method: 'GET',
      headers: {
        apikey: state.config.key,
        Authorization: `Bearer ${state.config.key}`,
        'Accept-Profile': 'public',
        'Content-Type': 'application/json',
        Prefer: 'count=exact',
        'Range-Unit': 'items',
        Range: `${offset}-${offset + pageSize - 1}`
      }
    });
    if (!response.ok) {
      const responseBody = await response.text();
      let details = responseBody;
      try { details = JSON.parse(responseBody).message || responseBody; } catch (parseError) {}
      throw new Error(`Supabase ${table} (${response.status}): ${details}`);
    }
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error(`Respons tabel ${table} bukan daftar data.`);
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
  const requestId = ++state.loadSequence;
  if (!apiReady()) {
    state.data = { customers: [], plans: [], memberships: [], payments: [] };
    state.dataError = '';
    state.dataLoaded = false;
    state.plansLoaded = false;
    state.membershipsLoaded = false;
    state.loading = false;
    state.plansLoading = false;
    $('#connectionLabel').textContent = 'Belum dikonfigurasi';
    render();
    return;
  }
  state.loading = true;
  state.dataError = '';
  state.plansLoading = true;
  state.plansError = '';
  $('#connectionLabel').textContent = 'Memuat data Supabase';
  render();
  try {
    const [customers, plans, memberships, payments] = await Promise.all([
      supabaseAll('customers'),
      supabaseAll('membership_plans', '?select=id,name,duration_months,price,is_active,access_label,created_at&order=name.asc,duration_months.asc,id.asc'),
      supabaseAll('memberships'),
      supabaseAll('payments')
    ]);
    if (requestId !== state.loadSequence) return;
    state.data = { customers, plans, memberships, payments };
    state.dataLoaded = true;
    state.plansLoaded = true;
    state.membershipsLoaded = true;
    state.loading = false;
    state.dataError = '';
    state.plansError = '';
    state.plansLoading = false;
    $('#connectionLabel').textContent = 'Supabase tersambung';
    render();
    if (notify) showToast('Data Supabase diperbarui');
  } catch (error) {
    if (requestId !== state.loadSequence) return;
    state.data = { customers: [], plans: [], memberships: [], payments: [] };
    state.dataLoaded = false;
    state.plansLoaded = false;
    state.membershipsLoaded = false;
    state.loading = false;
    state.dataError = supabaseError(error);
    state.plansError = state.dataError;
    state.plansLoading = false;
    $('#connectionLabel').textContent = 'Koneksi gagal';
    render();
    if (notify) showToast(`Supabase belum dapat diakses: ${supabaseError(error)}`, true);
    throw error;
  }
}
function statCard(label, value, foot, accent = false) { return `<article class="stat-card ${accent ? 'accent' : ''}"><div class="stat-label"><span>${label}</span></div><div class="stat-value">${value}</div><div class="stat-foot">${foot}</div></article>`; }
function actionButtons(type, id) { return `<div class="row-actions"><button class="table-action" data-action="edit" data-type="${type}" data-id="${escapeHtml(id)}" title="Edit data">Edit</button></div>`; }
function supabaseError(error) { try { const details = JSON.parse(error.message); return details.message || details.details || details.hint || error.message; } catch (parseError) { return error.message || 'Kesalahan Supabase tidak diketahui.'; } }
function statusLabel(status) { return status === 'paid' ? 'Lunas' : status === 'pending' ? 'Pending' : status === 'refunded' ? 'Refund' : status; }
function paymentMethodLabel(method) { return method === 'qris' ? 'QRIS' : method === 'cash' ? 'Cash' : 'Transfer'; }
function monthKey(value) { const parsed = value instanceof Date ? value : new Date(`${value}T00:00:00`); return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`; }
function monthStart(key) { return new Date(`${key}-01T00:00:00`); }
function monthEnd(key) { const start = monthStart(key); return new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59); }
function dateKey(value) { const parsed = value instanceof Date ? value : new Date(`${value}T00:00:00`); return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`; }
function membershipServicePeriods(membership, duration, contractCents) {
  if (!membership?.start_date || !membership?.end_date || membership.end_date < membership.start_date || duration <= 0) return [];
  const periods = Array.from({ length: duration }, (_, index) => {
    const startDate = index ? addMonths(membership.start_date, index) : membership.start_date;
    if (startDate > membership.end_date || index > 0 && startDate >= membership.end_date) return null;
    const anniversary = addMonths(membership.start_date, index + 1);
    return {
      index,
      recognitionDate: anniversary <= membership.end_date ? anniversary : membership.end_date
    };
  }).filter(Boolean);
  if (!periods.length) return [];
  const regularCents = Math.floor(contractCents / periods.length);
  return periods.map((period, index) => ({
    ...period,
    amountCents: index === periods.length - 1 ? contractCents - regularCents * (periods.length - 1) : regularCents
  }));
}
function recognitionDate(period, membership, payment) {
  const candidates = [period.recognitionDate];
  if (payment?.payment_date) candidates.push(payment.payment_date);
  const entryDate = candidates.sort().at(-1);
  return entryDate <= membership.end_date ? entryDate : '';
}
function monthlyRecognition(membership) {
  const duration = Number(planById(membership?.plan_id)?.duration_months || 0);
  return duration > 0 ? Number(membership.amount || 0) / duration : 0;
}
function membershipRecognitionSchedules(membership, membershipPayments = state.data.payments) {
  if (!membership?.id) return new Map();
  const duration = Number(planById(membership.plan_id)?.duration_months || 0);
  const contractCents = Math.max(0, toCents(membership?.amount));
  const periods = membershipServicePeriods(membership, duration, contractCents);
  if (!periods.length || !contractCents) return new Map();
  const paidPayments = membershipPayments
    .filter((item) => sameId(item.membership_id, membership.id) && item.status === 'paid')
    .sort((left, right) => left.payment_date.localeCompare(right.payment_date) || String(left.id).localeCompare(String(right.id)));
  let contractRemainingCents = contractCents;
  const eligiblePayments = [];
  for (const item of paidPayments) {
    const paymentCents = Math.max(0, toCents(item.amount));
    const eligibleCents = Math.min(paymentCents, contractRemainingCents);
    contractRemainingCents -= eligibleCents;
    if (eligibleCents > 0 && item.payment_date <= membership.end_date) eligiblePayments.push({ payment: item, remainingCents: eligibleCents });
  }
  const events = [...new Set([
    ...periods.map((period) => period.recognitionDate),
    ...eligiblePayments.map(({ payment }) => payment.payment_date)
  ])].sort();
  const schedules = new Map(eligiblePayments.map(({ payment }) => [payment.id, []]));
  const cash = [];
  const earned = [];
  let paymentIndex = 0;
  let periodIndex = 0;
  for (const eventDate of events) {
    while (paymentIndex < eligiblePayments.length && eligiblePayments[paymentIndex].payment.payment_date <= eventDate) {
      cash.push(eligiblePayments[paymentIndex]);
      paymentIndex += 1;
    }
    while (periodIndex < periods.length && periods[periodIndex].recognitionDate <= eventDate) {
      earned.push({ period: periods[periodIndex], remainingCents: periods[periodIndex].amountCents });
      periodIndex += 1;
    }
    let cashCursor = 0;
    let earnedCursor = 0;
    while (cashCursor < cash.length && earnedCursor < earned.length) {
      const paymentBalance = cash[cashCursor];
      const earnedBalance = earned[earnedCursor];
      const amountCents = Math.min(paymentBalance.remainingCents, earnedBalance.remainingCents);
      if (amountCents > 0) {
        const date = recognitionDate(earnedBalance.period, membership, paymentBalance.payment);
        if (date) schedules.get(paymentBalance.payment.id).push({
          period: earnedBalance.period.index,
          date,
          amount: amountCents / 100
        });
        paymentBalance.remainingCents -= amountCents;
        earnedBalance.remainingCents -= amountCents;
      }
      if (!paymentBalance.remainingCents) cashCursor += 1;
      if (!earnedBalance.remainingCents) earnedCursor += 1;
    }
  }
  return schedules;
}
function recognitionSchedule(payment, schedulesByMembership) {
  if (!payment || payment.status !== 'paid') return [];
  const membership = membershipById(payment.membership_id);
  const schedules = schedulesByMembership?.get(membership?.id) || membershipRecognitionSchedules(membership);
  return schedules.get(payment.id) || [];
}
function accountingRows(asOf = new Date()) {
  const asOfDate = dateKey(asOf);
  const rows = [];
  const paymentReferences = new Map(
    [...state.data.payments]
      .filter((payment) => payment.status === 'paid' && membershipById(payment.membership_id))
      .sort((left, right) => left.payment_date.localeCompare(right.payment_date) || String(left.id).localeCompare(String(right.id)))
      .map((payment, index) => [payment.id, `PAY-${String(index + 1).padStart(3, '0')}`])
  );
  const schedulesByMembership = new Map();
  const paymentsByMembership = new Map();
  state.data.payments.forEach((payment) => {
    if (!payment.membership_id) return;
    if (!paymentsByMembership.has(payment.membership_id)) paymentsByMembership.set(payment.membership_id, []);
    paymentsByMembership.get(payment.membership_id).push(payment);
  });
  state.data.memberships.forEach((membership) => {
    schedulesByMembership.set(membership.id, membershipRecognitionSchedules(membership, paymentsByMembership.get(membership.id) || []));
  });
  const addEntry = (entryId, sourceId, entryDate, reference, description, account, debit, credit) => {
    rows.push({ entryId, sourceId, date: entryDate, reference, description, ...account, debit, credit });
  };
  state.data.payments.filter((payment) => payment.status === 'paid' && payment.membership_id && membershipById(payment.membership_id) && payment.payment_date <= asOfDate).forEach((payment) => {
    const membership = membershipById(payment.membership_id);
    const amount = fromCents(toCents(payment.amount));
    const service = planService(planById(membership?.plan_id));
    const reference = paymentReferences.get(payment.id);
    const description = `Penerimaan membership - ${customerName(payment.customer_id)} - ${planName(membership?.plan_id)}`;
    addEntry(`PAY-${payment.id}`, payment.id, payment.payment_date, reference, description, { code: '1.1.01', name: 'Kas', service }, amount, 0);
    addEntry(`PAY-${payment.id}`, payment.id, payment.payment_date, reference, description, { code: '2.1.01', name: 'Pendapatan Diterima di Muka', service }, 0, amount);
    recognitionSchedule(payment, schedulesByMembership).filter((period) => period.date <= asOfDate).forEach((period) => {
      const entryId = `REV-${payment.id}-${period.period}`;
      const entryDate = period.date;
      const entryDescription = `Pengakuan pendapatan membership - ${customerName(payment.customer_id)} - ${planName(membership?.plan_id)}`;
      addEntry(entryId, payment.id, entryDate, entryId, entryDescription, { code: '2.1.01', name: 'Pendapatan Diterima di Muka', service }, period.amount, 0);
      addEntry(entryId, payment.id, entryDate, entryId, entryDescription, { code: '4.1.01', name: 'Pendapatan Membership', service }, 0, period.amount);
    });
  });
  rows.sort((left, right) => left.date.localeCompare(right.date) || left.entryId.localeCompare(right.entryId) || left.code.localeCompare(right.code));
  const recognitionReferences = new Map();
  rows.filter((row) => row.entryId.startsWith('REV-')).forEach((row) => {
    if (!recognitionReferences.has(row.entryId)) recognitionReferences.set(row.entryId, `REV-${String(recognitionReferences.size + 1).padStart(3, '0')}`);
    row.reference = recognitionReferences.get(row.entryId);
  });
  return rows;
}
function recognizedToDate(membership, asOf = new Date()) {
  const asOfDate = dateKey(asOf);
  const membershipPayments = state.data.payments.filter((payment) => sameId(payment.membership_id, membership?.id));
  const schedules = membershipRecognitionSchedules(membership, membershipPayments);
  return membershipPayments.filter((payment) => payment.status === 'paid' && payment.payment_date <= asOfDate)
    .reduce((sum, payment) => sum + (schedules.get(payment.id) || [])
      .filter((period) => period.date <= asOfDate)
      .reduce((periodCents, period) => periodCents + toCents(period.amount), 0), 0) / 100;
}
function recognizedForMonth(key) { return accountingRows().filter((row) => row.code === '4.1.01' && row.credit > 0 && monthKey(row.date) === key).reduce((sum, row) => sum + toCents(row.credit), 0) / 100; }
function accountingTotals(asOf = new Date()) {
  const rows = accountingRows(asOf);
  const totalFor = (code, field) => rows.filter((row) => row.code === code).reduce((sum, row) => sum + toCents(row[field]), 0);
  const recognizedMembership = totalFor('4.1.01', 'credit') - totalFor('4.1.01', 'debit');
  return {
    cash: fromCents(totalFor('1.1.01', 'debit') - totalFor('1.1.01', 'credit')),
    recognizedMembership: fromCents(recognizedMembership),
    recognized: fromCents(recognizedMembership),
    deferred: fromCents(totalFor('2.1.01', 'credit') - totalFor('2.1.01', 'debit'))
  };
}
function accountingSummaryMarkup() { const totals = accountingTotals(); return `<div class="accounting-strip"><div><span class="accounting-label">PENDAPATAN DIAKUI</span><strong>${money(recognizedForMonth(monthKey(new Date())))}</strong><small>Bulan berjalan</small></div><div><span class="accounting-label">KAS DITERIMA</span><strong>${money(totals.cash)}</strong><small>Akumulasi pembayaran lunas</small></div><div><span class="accounting-label">PENDAPATAN DITERIMA DI MUKA</span><strong>${money(totals.deferred)}</strong><small>Saldo kewajiban layanan</small></div></div>`; }
function paymentJournalMarkup(payment) {
  if (!payment || payment.status !== 'paid') return '';
  const rows = accountingRows().filter((row) => row.sourceId === payment.id);
  if (!rows.length) return '';
  const entries = [...new Map(rows.map((row) => [row.entryId, rows.filter((entry) => entry.entryId === row.entryId)])).values()];
  return `<section class="journal-section"><div class="eyebrow">ACCOUNTING ENTRY</div><h3>Jurnal pembayaran</h3>${entries.map((entry) => `<div class="journal-block"><strong>${escapeHtml(entry[0].description)} · ${date(entry[0].date)}</strong>${entry.map((row) => `<div><span>${row.debit ? 'Dr' : 'Cr'} ${escapeHtml(row.name)}</span><b>${money(row.debit || row.credit)}</b></div>`).join('')}</div>`).join('')}</section>`;
}
function paidAmountForMembership(membershipId, asOf = dateKey(new Date())) {
  return state.data.payments.filter((payment) => sameId(payment.membership_id, membershipId) && payment.status === 'paid' && payment.payment_date <= asOf)
    .reduce((sum, payment) => sum + toCents(payment.amount), 0) / 100;
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
  const records = state.data.memberships.filter((membership) => sameId(membership.customer_id, customerId));
  if (!records.length) return 'non_member';
  if (records.some((membership) => membershipIsActive(membership, asOf))) return 'active';
  const statuses = records.map((membership) => effectiveMembershipStatus(membership, asOf));
  if (statuses.includes('pending')) return 'pending';
  if (statuses.every((status) => status === 'cancelled')) return 'cancelled';
  return 'expired';
}
function memberStatusLabel(status) {
  return status === 'non_member' ? 'Non-Member' : 'Member';
}
function customerMembershipForDisplay(customerId, memberships = state.data.memberships) {
  return memberships.filter((membership) => sameId(membership.customer_id, customerId))
    .sort((left, right) => Number(membershipIsActive(right)) - Number(membershipIsActive(left)) || right.start_date.localeCompare(left.start_date))[0] || null;
}
function customerStatusLabel(customerId, asOf = new Date()) {
  const status = customerMembershipState(customerId, asOf);
  return status === 'active' ? 'Member Aktif' : status === 'expired' ? 'Berakhir' : status === 'pending' ? 'Menunggu' : status === 'cancelled' ? 'Dibatalkan' : '-';
}
function effectiveMembershipStatus(membership, asOf = new Date()) {
  const today = dateKey(asOf);
  if (membership.status === 'cancelled') return 'cancelled';
  if (membership.end_date < today || membership.status === 'expired') return 'expired';
  if (membership.start_date > today || membership.status === 'pending') return 'pending';
  return membershipIsActive(membership, asOf) ? 'active' : 'expired';
}
function membershipStatusLabel(status) {
  return status === 'active' ? 'Aktif' : status === 'pending' ? 'Menunggu' : status === 'cancelled' ? 'Dibatalkan' : 'Berakhir';
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
  const { customers, memberships, payments } = state.data;
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
  const membershipPayments = payments.filter((payment) => payment.membership_id && membershipById(payment.membership_id));
  const paidTransactionCount = membershipPayments.filter((payment) => payment.status === 'paid' && payment.payment_date <= today).length;
  const pendingTransactionCount = membershipPayments.filter((payment) => payment.status === 'pending').length;
  const refundedTransactionCount = membershipPayments.filter((payment) => payment.status === 'refunded').length;
  const recentPayments = [...membershipPayments].sort((left, right) => right.payment_date.localeCompare(left.payment_date)).slice(0, 5);
  const dataNotice = !apiReady()
    ? '<div class="catalog-status" role="status"><strong>Data belum dimuat</strong><p>Hubungkan project Supabase melalui Settings untuk menampilkan ringkasan aktual.</p><button class="secondary-button" data-action="open-settings">Buka Settings</button></div>'
    : state.dataError
      ? `<div class="catalog-status error" role="alert"><strong>Data terbaru tidak tersedia</strong><p>${escapeHtml(state.dataError)}${state.dataLoaded ? ' Ringkasan memakai data terakhir yang berhasil dimuat.' : ''}</p></div>`
      : !state.dataLoaded
        ? '<div class="catalog-status" role="status"><strong>Menyiapkan ringkasan</strong><p>Menunggu data dari Supabase.</p></div>'
        : '';
  const loadedDashboard = state.dataLoaded ? `<div class="stats-grid dashboard-stat-grid">${statCard('Pelanggan terdaftar', customers.length, 'seluruh pelanggan')}${statCard('Member aktif', new Set(active.map((membership) => membership.customer_id)).size, `${active.length} kontrak aktif`, true)}${statCard('Kontrak membership', memberships.length, 'seluruh kontrak tercatat')}${statCard('Kontrak baru', newMemberships, 'mulai pada bulan ini')}${statCard('Segera berakhir', expiringCount, 'dalam 30 hari')}${statCard('Kontrak berakhir', expiredCount, 'berdasarkan status atau tanggal')}${statCard('Kas diterima', money(totals.cash), `${paidTransactionCount} pembayaran lunas`)}${statCard('Pendapatan diakui', money(recognizedThisMonth), 'diakui bulan berjalan')}${statCard('Pendapatan diterima di muka', money(totals.deferred), 'saldo kewajiban layanan')}${statCard('Pembayaran membership', membershipPayments.length, `${paidTransactionCount} lunas · ${pendingTransactionCount} pending · ${refundedTransactionCount} refund`)}</div><div class="dashboard-secondary-grid">${revenueTrendMarkup()}${membershipOverviewMarkup()}</div><div class="content-grid"><section class="panel"><div class="panel-header"><div><h2 class="panel-title">Pembayaran terbaru</h2><p class="panel-subtitle">Riwayat transaksi terbaru</p></div><button class="text-button" data-view="payments">Lihat semua →</button></div>${paymentTable(recentPayments, true)}</section>${expiringMembershipMarkup()}</div><section class="panel dashboard-plans"><div class="panel-header"><div><h2 class="panel-title">Paket membership</h2><p class="panel-subtitle">Paket aktif dari katalog Supabase</p></div><button class="text-button" data-view="plans">Lihat semua →</button></div><div class="plan-list">${availablePlans().slice(0, 6).map((plan) => `<div class="plan-row"><div><div class="plan-name">${escapeHtml(plan.name)}</div><span class="plan-meta">${durationLabel(plan.duration_months)} · ${escapeHtml(planAccessDescription(plan))}</span></div><div class="plan-total">${money(plan.price)}<small>${memberships.filter((membership) => membership.plan_id === plan.id).length} kontrak</small></div></div>`).join('') || '<div class="empty-state">Belum ada paket aktif.</div>'}</div></section>` : '';
  return `<div class="page-heading"><div><div class="eyebrow">RINGKASAN OPERASIONAL &amp; KEUANGAN</div><h1>Dashboard</h1><p>Aktivitas pelanggan, kontrak membership, dan posisi keuangan studio.</p></div><div class="date-chip">${date(today)}</div></div>${dataNotice}${loadedDashboard}`;
}
function paymentTable(rows) {
  if (!rows.length) return '<div class="empty-state">Belum ada pembayaran.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>TANGGAL</th><th>REFERENSI</th><th>CUSTOMER</th><th>PAKET MEMBERSHIP</th><th>NOMINAL</th><th>METODE</th><th>STATUS PEMBAYARAN</th></tr></thead><tbody>${rows.map((item) => {
    const membership = membershipById(item.membership_id);
    return `<tr><td>${date(item.payment_date)}</td><td class="amount">${escapeHtml(item.reference || 'Tanpa referensi')}</td><td><div class="customer"><span class="customer-avatar">${initials(customerName(item.customer_id))}</span><span class="customer-name">${escapeHtml(customerName(item.customer_id))}</span></div></td><td>${escapeHtml(membership ? planName(membership.plan_id) : 'Belum tertaut')}</td><td class="amount">${money(item.amount)}</td><td>${paymentMethodLabel(item.payment_method)}</td><td><span class="badge ${item.status}">${statusLabel(item.status)}</span></td></tr>`;
  }).join('')}</tbody></table></div>`;
}
function customerTable(customers) {
  if (!customers.length) return '<div class="empty-state">Belum ada customer yang sesuai filter.</div>';
  return `<div class="table-wrap"><table class="customer-table"><thead><tr><th>CUSTOMER</th><th>TIPE</th><th>MEMBERSHIP / PLAN</th><th>PERIODE MEMBERSHIP</th><th>STATUS</th><th>AKSI</th></tr></thead><tbody>${customers.map((customer) => {
    const membership = customerMembershipForDisplay(customer.id);
    const memberState = customerMembershipState(customer.id);
    const typeLabel = memberStatusLabel(memberState);
    const contractStatus = customerStatusLabel(customer.id);
    const type = memberState === 'non_member' ? 'non_member' : 'active';
    return `<tr><td><div class="customer"><span class="customer-avatar">${initials(customer.full_name)}</span><div><span class="customer-name">${escapeHtml(customer.full_name)}</span><span class="customer-id">${escapeHtml(customer.member_code)} · ${escapeHtml(customer.email || customer.phone || 'Tanpa kontak')}</span><span class="customer-note">Bergabung ${date(customer.join_date)}${customer.notes ? ` · ${escapeHtml(customer.notes)}` : ''}</span></div></div></td><td><span class="badge ${type}">${typeLabel}</span></td><td>${membership ? escapeHtml(planName(membership.plan_id)) : '-'}</td><td>${membership ? `${date(membership.start_date)} — ${date(membership.end_date)}` : '-'}</td><td>${membership ? `<span class="badge ${memberState}">${contractStatus}</span>` : '-'}</td><td>${actionButtons('customer', customer.id)}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}
function visibleCustomers() {
  const query = state.customerSearch.trim().toLowerCase();
  return state.data.customers.filter((customer) => {
    const memberState = customerMembershipState(customer.id);
    const matchesFilter = state.customerFilter === 'all' ||
      state.customerFilter === 'active' && memberState === 'active' ||
      state.customerFilter === 'expired' && memberState === 'expired' ||
      state.customerFilter === 'pending' && memberState === 'pending';
    const membershipText = state.data.memberships.filter((membership) => sameId(membership.customer_id, customer.id)).map((membership) => planName(membership.plan_id)).join(' ');
    const searchable = `${customer.full_name} ${customer.member_code} ${customer.email} ${customer.phone} ${customer.notes} ${membershipText}`.toLowerCase();
    return matchesFilter && (!query || searchable.includes(query));
  });
}
function membershipTable(items) {
  if (!items.length) return '<div class="empty-state">Belum ada membership.</div>';
  return `<div class="table-wrap"><table><thead><tr><th>PELANGGAN</th><th>PAKET</th><th>SERVICE</th><th>PERIODE</th><th>NOMINAL</th><th>STATUS MEMBERSHIP</th><th>STATUS PAYMENT</th><th>AKSI</th></tr></thead><tbody>${items.map((item) => {
    const plan = planById(item.plan_id);
    const status = effectiveMembershipStatus(item);
    const paid = paidAmountForMembership(item.id);
    const paymentStatus = paid <= 0 ? 'Belum dibayar' : paid + 0.005 >= Number(item.amount) ? 'Lunas' : 'Sebagian';
    const paymentBadge = paid <= 0 ? 'pending' : paymentStatus === 'Lunas' ? 'paid' : 'pending';
    return `<tr><td><div class="customer"><span class="customer-avatar">${initials(customerName(item.customer_id))}</span><span class="customer-name">${escapeHtml(customerName(item.customer_id))}</span></div></td><td>${escapeHtml(planName(item.plan_id))}</td><td>${escapeHtml(planService(plan))}</td><td>${date(item.start_date)} — ${date(item.end_date)}</td><td class="amount">${money(item.amount)}</td><td><span class="badge ${status}">${membershipStatusLabel(status)}</span></td><td><span class="badge ${paymentBadge}">${paymentStatus}</span></td><td>${actionButtons('membership', item.id)}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}
function filteredMemberships() {
  const query = state.membershipSearch.trim().toLowerCase();
  return state.data.memberships.filter((membership) => {
    if (state.membershipFilter !== 'all' && effectiveMembershipStatus(membership) !== state.membershipFilter) return false;
    return !query || `${customerName(membership.customer_id)} ${planName(membership.plan_id)} ${planService(planById(membership.plan_id))}`.toLowerCase().includes(query);
  });
}
function renderMembers() { return `<div class="page-heading"><div><div class="eyebrow">DATA PELANGGAN / 02</div><h1>Customer</h1><p>Kelola data pelanggan, informasi kontak, dan keanggotaan.</p><div class="customer-page-actions"><button class="primary-button" data-action="add-customer">+ Tambah customer</button><button class="secondary-button" data-action="add-membership">+ Tambah membership</button></div></div></div><div class="toolbar customer-filters"><select class="select-input" id="customerFilter"><option value="all" ${state.customerFilter === 'all' ? 'selected' : ''}>Semua Customer</option><option value="active" ${state.customerFilter === 'active' ? 'selected' : ''}>Member Aktif</option><option value="expired" ${state.customerFilter === 'expired' ? 'selected' : ''}>Berakhir</option><option value="pending" ${state.customerFilter === 'pending' ? 'selected' : ''}>Menunggu</option></select><input class="search-input" id="customerSearch" placeholder="Cari nama, kode, kontak, atau plan..." value="${escapeHtml(state.customerSearch)}"></div><section class="panel" id="customerPanel">${customerTable(visibleCustomers())}</section>`; }
function renderMemberships() {
  const filtered = filteredMemberships();
  return `<div class="page-heading"><div><div class="eyebrow">MEMBERSHIP REGISTER / 03</div><h1>Membership</h1><p>Kontrak layanan berdasarkan status dan periode membership.</p></div><button class="primary-button" data-action="add-membership">+ Tambah membership</button></div><div class="toolbar membership-toolbar"><select class="select-input" id="membershipStatusFilter"><option value="all" ${state.membershipFilter === 'all' ? 'selected' : ''}>Semua Status</option><option value="active" ${state.membershipFilter === 'active' ? 'selected' : ''}>Aktif</option><option value="expired" ${state.membershipFilter === 'expired' ? 'selected' : ''}>Berakhir</option><option value="pending" ${state.membershipFilter === 'pending' ? 'selected' : ''}>Menunggu</option><option value="cancelled" ${state.membershipFilter === 'cancelled' ? 'selected' : ''}>Dibatalkan</option></select><input class="search-input" id="membershipSearch" placeholder="Cari customer, plan, atau service..." value="${escapeHtml(state.membershipSearch)}"></div><section class="panel" id="membershipPanel">${membershipTable(filtered)}</section>`;
}
function renderPayments() {
  const filters = state.paymentFilters;
  const payments = state.data.payments.filter((payment) => withinPeriod(payment.payment_date, filters) && (!filters.method || payment.payment_method === filters.method) && (!filters.status || payment.status === filters.status));
  payments.sort((left, right) => right.payment_date.localeCompare(left.payment_date));
  return `<div class="page-heading"><div><div class="eyebrow">REVENUE REGISTER / 04</div><h1>Payments</h1><p>Riwayat penerimaan kas untuk membership.</p></div><button class="primary-button" data-action="add-payment">+ Catat payment</button></div><div class="toolbar payment-filters"><label class="form-row"><span>DARI</span><input class="form-input" type="date" data-payment-filter="startDate" value="${escapeHtml(filters.startDate)}"></label><label class="form-row"><span>SAMPAI</span><input class="form-input" type="date" data-payment-filter="endDate" value="${escapeHtml(filters.endDate)}"></label><label class="form-row"><span>METODE</span><select class="select-input" data-payment-filter="method"><option value="">Semua</option>${['cash', 'transfer', 'qris'].map((method) => `<option value="${method}" ${filters.method === method ? 'selected' : ''}>${paymentMethodLabel(method)}</option>`).join('')}</select></label><label class="form-row"><span>STATUS</span><select class="select-input" data-payment-filter="status"><option value="">Semua</option>${['paid', 'pending', 'refunded'].map((status) => `<option value="${status}" ${filters.status === status ? 'selected' : ''}>${statusLabel(status)}</option>`).join('')}</select></label></div><section class="panel payment-history-panel"><div class="panel-header"><div><h2 class="panel-title">Payment History</h2><p class="panel-subtitle">${payments.length} dari ${state.data.payments.length} transaksi</p></div></div>${paymentTable(payments)}</section>`;
}
function renderPlans() {
  const services = ['Gym', 'Pilates', 'Yoga', 'Zumba', 'Functional Training', 'All Access'];
  const plans = availablePlans();
  const filtered = plans.filter((plan) =>
    (!state.planFilters.service || planService(plan) === state.planFilters.service) &&
    (!state.planFilters.duration || durationLabel(plan.duration_months) === state.planFilters.duration)
  );
  let catalogStatus = '';
  if (!apiReady()) {
    catalogStatus = '<div class="catalog-status" role="status"><strong>Katalog belum tersambung</strong><p>Hubungkan project Supabase untuk memuat paket dan harga terbaru.</p><button class="secondary-button" data-action="open-settings">Buka Settings</button></div>';
  } else if (state.plansLoading && !state.plansLoaded) {
    catalogStatus = '<div class="catalog-status" role="status"><strong>Memuat katalog</strong><p>Mengambil paket dari Supabase.</p></div>';
  } else if (state.plansError && !state.plansLoaded) {
    catalogStatus = `<div class="catalog-status error" role="alert"><strong>Katalog tidak dapat dimuat</strong><p>${escapeHtml(state.plansError)}</p><p>Periksa koneksi, izin baca RLS, dan tabel membership_plans di schema public.</p><button class="secondary-button" data-action="retry-catalog">Coba lagi</button></div>`;
  } else if (!state.plansLoaded) {
    catalogStatus = '<div class="catalog-status" role="status"><strong>Katalog menunggu data</strong><p>Data paket belum berhasil dimuat dari Supabase.</p></div>';
  } else if (state.plansError) {
    catalogStatus = `<div class="catalog-status error" role="alert"><strong>Gagal memperbarui katalog</strong><p>${escapeHtml(state.plansError)} Paket yang terakhir berhasil dimuat tetap ditampilkan.</p><button class="secondary-button" data-action="retry-catalog">Coba lagi</button></div>`;
  } else if (state.dataError) {
    catalogStatus = `<div class="catalog-status error" role="alert"><strong>Sinkronisasi data belum lengkap</strong><p>${escapeHtml(state.dataError)} Paket berhasil dimuat, tetapi sebagian data sistem mungkin belum terbaru.</p><button class="secondary-button" data-action="retry-catalog">Coba lagi</button></div>`;
  }
  const content = !apiReady() || !state.plansLoaded
    ? catalogStatus
    : `${state.dataError ? catalogStatus : ''}<section class="panel"><div class="panel-header"><div><h2 class="panel-title">Paket membership aktif</h2><p class="panel-subtitle">${filtered.length} dari ${plans.length} paket aktif tersedia</p></div></div>
      <div class="plan-list membership-plan-list">${filtered.map((plan) => {
        const duration = Number(plan.duration_months);
        const monthlyEstimate = duration > 0 ? Number(plan.price) / duration : null;
        const allAccess = planService(plan) === 'All Access';
        const benefits = planBenefits(plan);
        const contracts = state.membershipsLoaded ? state.data.memberships.filter((membership) => membership.plan_id === plan.id).length : null;
        return `<article class="plan-row plan-row-detailed membership-plan-card ${allAccess ? 'plan-row-all-access' : ''}">
          <div class="membership-plan-copy">
            <div class="plan-name">${escapeHtml(plan.name)}${allAccess ? '<span class="plan-category-badge">PAKET PREMIUM</span>' : ''}</div>
            <span class="plan-meta"><span class="plan-service-label">${escapeHtml(allAccess ? 'All Access · Paket gabungan' : planService(plan))}</span> · ${escapeHtml(durationLabel(duration))} · berlaku ${escapeHtml(durationDescription(duration))}</span>
            <ul class="plan-benefits">${benefits.map((benefit) => `<li>${escapeHtml(benefit)}</li>`).join('')}</ul>
            ${planService(plan) === 'Gym' ? '' : '<p class="plan-quota-note">Kuota kelas berlaku per bulan selama membership aktif dan tidak diakumulasikan. Pada Quarterly dan Annual, kuota diperbarui setiap bulan, bukan menjadi kuota gabungan.</p>'}
          </div>
          <div class="plan-total">${money(plan.price)}<small>Harga total paket</small>${monthlyEstimate === null ? '' : `<small>Estimasi ${money(monthlyEstimate)} / bulan</small>`}${contracts === null ? '' : `<small>${contracts} kontrak tercatat</small>`}</div>
        </article>`;
      }).join('') || `<div class="empty-state">${plans.length ? 'Tidak ada paket yang sesuai dengan filter ini.' : 'Belum ada paket aktif pada katalog Supabase.'}</div>`}</div>
      </section>`;
  return `<div class="page-heading"><div><div class="eyebrow">KATALOG MEMBERSHIP / 05</div><h1>Membership Plans</h1><p>Pilih paket membership yang sesuai dengan kebutuhanmu.</p></div></div>
    <div class="plans-toolbar"><select class="select-input" id="planServiceFilter" aria-label="Filter layanan"><option value="">Semua layanan &amp; paket</option>${services.map((service) => `<option value="${service}" ${state.planFilters.service === service ? 'selected' : ''}>${service === 'All Access' ? 'All Access · Paket gabungan' : service}</option>`).join('')}</select><select class="select-input" id="planDurationFilter" aria-label="Filter durasi"><option value="">Semua durasi</option>${['Monthly', 'Quarterly', 'Annual'].map((duration) => `<option value="${duration}" ${state.planFilters.duration === duration ? 'selected' : ''}>${duration} · ${durationDescription({ Monthly: 1, Quarterly: 3, Annual: 12 }[duration])}</option>`).join('')}</select></div>
    ${content}${state.plansLoaded ? '<p class="plan-catalog-note">Harga yang ditampilkan adalah total paket; estimasi per bulan merupakan harga total dibagi durasi. Monthly berlaku 1 bulan, Quarterly 3 bulan, dan Annual 12 bulan. Untuk layanan yang sama, perbedaannya adalah harga dan durasi, bukan fasilitas dasar. Batas sesi kelas adalah informasi paket dan belum diterapkan otomatis oleh sistem.</p>' : ''}`;
}
function reportPaymentForMembership(membershipId, asOf = dateKey(new Date())) { return state.data.payments.find((payment) => sameId(payment.membership_id, membershipId) && payment.status === 'paid' && payment.payment_date <= asOf); }
function accountRevenue(rows, code) {
  return fromCents(rows.filter((row) => row.code === code).reduce((total, row) => total + toCents(row.credit) - toCents(row.debit), 0));
}
function reportMonthKeys(rows, filters, reportDate) {
  const revenueDates = rows.filter((row) => row.code === '4.1.01' && row.credit !== row.debit).map((row) => row.date).sort();
  const firstDate = filters.startDate || revenueDates[0];
  if (!firstDate || firstDate > reportDate) return [];
  const firstMonth = monthStart(monthKey(firstDate));
  const lastMonth = monthStart(monthKey(reportDate));
  const months = [];
  for (const cursor = new Date(firstMonth); cursor <= lastMonth; cursor.setMonth(cursor.getMonth() + 1)) {
    months.push(monthKey(cursor));
  }
  return months;
}
function renderRevenueReport() {
  const today = dateKey(new Date());
  const reportDate = state.financeFilters.endDate && state.financeFilters.endDate < today ? state.financeFilters.endDate : today;
  const asOf = new Date(`${reportDate}T23:59:59`);
  const allRows = accountingRows(asOf);
  const periodRows = allRows.filter((row) => withinPeriod(row.date, state.financeFilters));
  const paidPayments = state.data.payments.filter((payment) => payment.status === 'paid' && payment.membership_id && membershipById(payment.membership_id) && withinPeriod(payment.payment_date, state.financeFilters) && payment.payment_date <= reportDate);
  const cashReceived = fromCents(paidPayments.reduce((sum, payment) => sum + toCents(payment.amount), 0));
  const membershipSubtotal = accountRevenue(periodRows, '4.1.01');
  const recognized = membershipSubtotal;
  const totalsAtEnd = accountingTotals(asOf);
  const membershipByService = new Map();
  let unclassifiedMembershipCents = 0;
  periodRows.filter((row) => row.code === '4.1.01').forEach((row) => {
    const netCents = toCents(row.credit) - toCents(row.debit);
    if (!netCents) return;
    const service = canonicalService(row.service, MEMBERSHIP_REPORT_SERVICES);
    if (!service) {
      unclassifiedMembershipCents += netCents;
      return;
    }
    membershipByService.set(service, fromCents(toCents(membershipByService.get(service)) + netCents));
  });
  const unclassifiedMembership = fromCents(unclassifiedMembershipCents);
  const hasUnclassifiedRevenue = Math.abs(unclassifiedMembershipCents) > 0;
  const reportRows = state.data.memberships.filter((membership) => paidAmountForMembership(membership.id, reportDate) > 0 && membership.start_date <= reportDate && (
    !state.financeFilters.startDate ||
    membership.end_date >= state.financeFilters.startDate ||
    paidPayments.some((payment) => sameId(payment.membership_id, membership.id))
  )).map((membership) => {
    const plan = planById(membership.plan_id);
    const payment = reportPaymentForMembership(membership.id, reportDate);
    const received = paidAmountForMembership(membership.id, reportDate);
    const recognizedToPeriod = recognizedToDate(membership, asOf);
    return { membership, plan, payment, received, recognized: recognizedToPeriod, deferred: fromCents(Math.max(toCents(received) - toCents(recognizedToPeriod), 0)) };
  });
  const months = reportMonthKeys(periodRows, state.financeFilters, reportDate);
  const transactionCount = new Set(paidPayments.map((payment) => payment.id)).size;
  const revenueTable = `
    <tr class="revenue-group-row"><th colspan="4">Membership</th></tr>
    ${MEMBERSHIP_REPORT_SERVICES.map((service) => `<tr><td>${service}</td><td>4.1.01</td><td>Pendapatan Membership</td><td class="amount">${money(membershipByService.get(service) || 0)}</td></tr>`).join('')}
    <tr class="revenue-subtotal-row"><td colspan="3"><strong>Total Pendapatan Membership</strong></td><td class="amount"><strong>${money(membershipSubtotal)}</strong></td></tr>`;
  const unclassifiedNotice = hasUnclassifiedRevenue
    ? `<div class="catalog-status error revenue-classification-warning" role="alert"><strong>Ada pendapatan membership tanpa klasifikasi layanan</strong><p>Total pendapatan tetap memasukkan jurnal akun 4.1.01, tetapi ${money(unclassifiedMembership)} belum dapat ditempatkan ke baris layanan. Verifikasi paket dan relasi membership pada data Supabase sebelum mengandalkan rincian per layanan.</p></div>`
    : '';
  return `<div class="page-heading"><div><div class="eyebrow">PENGAKUAN PENDAPATAN / KEUANGAN</div><h1>Laporan Pendapatan</h1><p>Pendapatan membership yang diakui pada periode terpilih berdasarkan jurnal.</p></div></div>${periodFilterMarkup()}<div class="report-summary-grid">${statCard('TRANSAKSI LUNAS', transactionCount, 'pembayaran membership lunas pada periode', true)}${statCard('KAS DITERIMA', money(cashReceived), 'pembayaran membership lunas pada periode')}${statCard('TOTAL PENDAPATAN DIAKUI', money(recognized), 'berdasarkan jurnal akun 4.1.01 pada periode')}${statCard('PENDAPATAN DITERIMA DI MUKA', money(totalsAtEnd.deferred), `saldo per ${date(reportDate)}`)}</div><section class="panel report-panel"><div class="panel-header"><div><h2 class="panel-title">Pendapatan Membership per Layanan</h2><p class="panel-subtitle">Bersumber dari jurnal pengakuan akun 4.1.01.</p></div></div>${unclassifiedNotice}<div class="table-wrap"><table><thead><tr><th>LAYANAN</th><th>KODE AKUN</th><th>AKUN</th><th>PENDAPATAN DIAKUI</th></tr></thead><tbody>${revenueTable}<tr class="revenue-total-row"><td colspan="3"><strong>Total Pendapatan Diakui</strong></td><td class="amount"><strong>${money(recognized)}</strong></td></tr></tbody></table></div></section><section class="panel report-history"><div class="panel-header"><div><h2 class="panel-title">Pendapatan per Bulan</h2><p class="panel-subtitle">Pendapatan membership bersih akun 4.1.01 per bulan pada periode terpilih.</p></div></div><div class="revenue-month-list">${months.map((month) => `<div><span>${new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(monthStart(month))}</span><strong>${money(accountRevenue(periodRows.filter((row) => monthKey(row.date) === month), '4.1.01'))}</strong></div>`).join('') || '<div class="empty-state">Belum ada pendapatan yang diakui pada periode ini.</div>'}</div></section><section class="panel report-panel"><div class="panel-header"><div><h2 class="panel-title">Rincian Pendapatan Membership</h2><p class="panel-subtitle">Saldo kumulatif sampai tanggal laporan; nilai kontrak dan pembayaran berasal dari kontrak serta transaksi Supabase.</p></div></div><div class="table-wrap"><table><thead><tr><th>CUSTOMER</th><th>MEMBERSHIP</th><th>PERIODE LAYANAN</th><th>NILAI KONTRAK</th><th>DITERIMA</th><th>PENDAPATAN / BULAN</th><th>SUDAH DIAKUI</th><th>DITERIMA DI MUKA</th><th>JURNAL</th></tr></thead><tbody>${reportRows.map(({ membership, plan, payment, received, recognized: recognizedAmount, deferred }) => `<tr><td>${escapeHtml(customerName(membership.customer_id))}</td><td>${escapeHtml(plan?.name || 'Membership')}</td><td>${date(membership.start_date)} — ${date(membership.end_date)}</td><td class="amount">${money(membership.amount)}</td><td class="amount">${money(received)}</td><td class="amount">${money(monthlyRecognition(membership))}</td><td class="amount">${money(recognizedAmount)}</td><td class="amount">${money(deferred)}</td><td>${payment ? `<button class="table-action" data-action="view-journal" data-id="${escapeHtml(payment.id)}">Lihat jurnal</button>` : '<span class="muted-note">Belum paid</span>'}</td></tr>`).join('') || '<tr><td colspan="9"><div class="empty-state">Tidak ada membership berbayar pada periode ini.</div></td></tr>'}</tbody></table></div></section>`;
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
    { code: '4.1.01', name: 'Pendapatan Membership', normal: 'credit' }
  ];
  const visibleAccounts = state.financeFilters.account === 'all' ? accounts : accounts.filter((account) => account.code === state.financeFilters.account);
  return `<div class="page-heading"><div><div class="eyebrow">FINANCE / GENERAL LEDGER</div><h1>General Ledger</h1><p>Mutasi, saldo awal, dan running balance dari jurnal sistem.</p></div></div><div class="toolbar ledger-filters"><label class="form-row"><span>AKUN</span><select class="select-input" data-finance-account><option value="all">Semua akun</option>${accounts.map((account) => `<option value="${account.code}" ${state.financeFilters.account === account.code ? 'selected' : ''}>${account.code} · ${account.name}</option>`).join('')}</select></label>${periodFilterMarkup()}</div>${visibleAccounts.map((account) => {
    const allAccountRows = rows.filter((row) => row.code === account.code);
    const openingRows = state.financeFilters.startDate ? allAccountRows.filter((row) => row.date < state.financeFilters.startDate) : [];
    let balanceCents = openingRows.reduce((sum, row) => sum + (account.normal === 'debit' ? toCents(row.debit) - toCents(row.credit) : toCents(row.credit) - toCents(row.debit)), 0);
    let balance = fromCents(balanceCents);
    const periodRows = allAccountRows.filter((row) => withinPeriod(row.date, state.financeFilters));
    const openingRow = state.financeFilters.startDate ? `<tr class="opening-balance-row"><td>${date(state.financeFilters.startDate)}</td><td>-</td><td>Saldo awal periode</td><td class="amount">-</td><td class="amount">-</td><td class="amount">${money(balance)}</td></tr>` : '';
    const accountRows = periodRows.map((row) => {
      balanceCents += account.normal === 'debit' ? toCents(row.debit) - toCents(row.credit) : toCents(row.credit) - toCents(row.debit);
      balance = fromCents(balanceCents);
      return `<tr><td>${date(row.date)}</td><td class="amount">${escapeHtml(row.reference)}</td><td>${escapeHtml(row.description)}</td><td class="amount">${row.debit ? money(row.debit) : '-'}</td><td class="amount">${row.credit ? money(row.credit) : '-'}</td><td class="amount">${money(balance)}</td></tr>`;
    }).join('');
    return `<section class="panel report-panel"><div class="panel-header"><div><h2 class="panel-title">${account.code} · ${account.name}</h2><p class="panel-subtitle">Saldo normal ${account.normal === 'debit' ? 'debit' : 'kredit'}</p></div><span class="record-count">Saldo ${money(balance)}</span></div>${accountRows || openingRow ? `<div class="table-wrap"><table><thead><tr><th>TANGGAL</th><th>NOMOR BUKTI</th><th>KETERANGAN</th><th>DEBIT</th><th>KREDIT</th><th>SALDO</th></tr></thead><tbody>${openingRow}${accountRows}</tbody></table></div>` : '<div class="empty-state">Belum ada mutasi untuk akun ini pada periode terpilih.</div>'}</section>`;
  }).join('')}`;
}
function renderSettings() { return `<div class="page-heading"><div><div class="eyebrow">SYSTEM CONFIGURATION</div><h1>Pengaturan</h1><p>Hubungkan dashboard ke project Supabase PostgreSQL Anda.</p></div></div><div class="settings-grid"><section class="panel form-card"><h3>Koneksi Supabase</h3><p>Gunakan Project URL dan Publishable Key dari pengaturan API project. Nilai disimpan hanya di browser ini.</p><form id="settingsForm"><div class="form-row"><label for="projectUrl">PROJECT URL</label><input class="form-input" id="projectUrl" type="url" placeholder="https://project-ref.supabase.co" value="${escapeHtml(state.config.url || '')}" required></div><div class="form-row"><label for="publishableKey">PUBLISHABLE KEY</label><input class="form-input" id="publishableKey" type="password" placeholder="sb_publishable_..." value="${escapeHtml(state.config.key || '')}" required></div><button class="primary-button" type="submit">Simpan & sinkronkan</button></form></section><aside class="help-box"><h3>Empat entitas, satu alur.</h3><p>customers, membership_plans, memberships, dan payments terhubung untuk pencatatan pendapatan membership.</p><p>Jalankan schema di SQL Editor Supabase, aktifkan RLS, lalu isi kredensial di sini.</p></aside></div>`; }
const dashboardHeaderMarkup = `<section class="dashboard-banner"><div class="dashboard-banner-copy"><div class="eyebrow">FORMÉ · FITNESS &amp; WELLNESS</div><div class="dashboard-brand-line"><img src="./forme-symbol.svg" alt=""><h1>FORMÉ</h1></div><p>Ringkasan membership dan keuangan studio.</p><span>Workspace operasional · Membership &amp; pendapatan</span></div><div class="dashboard-banner-art" aria-hidden="true"><img src="./forme-symbol.svg" alt=""></div></section>`;
const spaces = { gym: { title: 'Gym Area', icon: '✦', intro: 'Strength and cardio service represented by the available membership plans.', items: ['Strength Training', 'Cardio', 'Gym Floor'] }, pilates: { title: 'Pilates', icon: '◌', intro: 'Core and mobility service represented by Pilates membership plans.', items: ['Core training', 'Mobility', 'Controlled movement'] }, yoga: { title: 'Yoga', icon: '⌁', intro: 'Balance and flexibility service represented by Yoga membership plans.', items: ['Balance', 'Flexibility', 'Mindfulness'] }, zumba: { title: 'Zumba', icon: '◉', intro: 'Dance and cardio service represented by Zumba membership plans.', items: ['Dance cardio', 'Rhythm', 'Cardio conditioning'] }, functional: { title: 'Functional Training', icon: '＋', intro: 'Movement and performance service represented by Functional Training plans.', items: ['Movement', 'Performance', 'Strength & endurance'] } };
function activeMembershipMarkup() { const active = state.data.memberships.filter((item) => membershipIsActive(item)); return `<section class="panel active-memberships-panel"><div class="panel-header"><div><h2 class="panel-title">Active Memberships</h2><p class="panel-subtitle">Current customer plans</p></div><button class="text-button" data-action="view-active-memberships">View all →</button></div>${active.length ? `<div class="active-membership-list">${active.map((item) => { const plan = planById(item.plan_id); return `<div class="active-membership-row"><div class="customer"><span class="customer-avatar">${initials(customerName(item.customer_id))}</span><div><span class="customer-name">${escapeHtml(customerName(item.customer_id))}</span><span class="customer-id">${escapeHtml(planName(item.plan_id))}</span></div></div><span class="service-label">${escapeHtml(planService(plan))}</span><span class="badge active">Active</span></div>`; }).join('')}</div>` : '<div class="empty-state">Belum ada membership aktif.</div>'}</section>`; }
const servicesMarkup = `<section class="services-section"><div class="section-heading"><div><div class="eyebrow">STUDIO CONTEXT</div><h2>Studio Services</h2><p>Five core services available through the membership plans.</p></div></div><div class="services-grid"><article class="service-card" data-action="view-space" data-space="gym" tabindex="0" role="button"><span class="service-icon">✦</span><div><h3>Gym</h3><p>Strength · Cardio</p></div></article><article class="service-card" data-action="view-space" data-space="pilates" tabindex="0" role="button"><span class="service-icon">◌</span><div><h3>Pilates</h3><p>Core · Mobility</p></div></article><article class="service-card" data-action="view-space" data-space="yoga" tabindex="0" role="button"><span class="service-icon">⌁</span><div><h3>Yoga</h3><p>Balance · Flexibility</p></div></article><article class="service-card" data-action="view-space" data-space="zumba" tabindex="0" role="button"><span class="service-icon">◉</span><div><h3>Zumba</h3><p>Dance · Cardio</p></div></article><article class="service-card" data-action="view-space" data-space="functional" tabindex="0" role="button"><span class="service-icon">＋</span><div><h3>Functional Training</h3><p>Movement · Performance</p></div></article></div></section>`;
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
  if (state.dataError && state.view !== 'overview') {
    content.insertAdjacentHTML('afterbegin', `<div class="catalog-status error" role="alert"><strong>Data keuangan tidak tersedia</strong><p>${escapeHtml(state.dataError)}. Ringkasan dan laporan dikosongkan sampai sinkronisasi berhasil.</p></div>`);
  }
  content.setAttribute('aria-busy', String(state.loading));
  if (state.loading) content.insertAdjacentHTML('afterbegin', '<div class="loading-banner" role="status">Memuat data terbaru dari Supabase...</div>');
}
function optionList(items, label) {
  if (items === state.data.plans) {
    const active = availablePlans();
    const inactive = state.data.plans.filter((plan) => !active.some((item) => item.id === plan.id));
    return `${active.map((item) => `<option value="${item.id}">${escapeHtml(label(item))}</option>`).join('')}${inactive.map((item) => `<option value="${item.id}" hidden>${escapeHtml(label(item))} · Inactive</option>`).join('')}`;
  }
  return items.map((item) => `<option value="${item.id}">${escapeHtml(label(item))}</option>`).join('');
}
function paymentMembershipOptions(customerId, selectedId = '') { return `<option value="">Pilih membership</option>${state.data.memberships.filter((item) => !customerId || sameId(item.customer_id, customerId)).map((item) => `<option value="${item.id}" ${sameId(item.id, selectedId) ? 'selected' : ''}>${escapeHtml(customerName(item.customer_id))} · ${escapeHtml(planName(item.plan_id))} · ${money(item.amount)}</option>`).join('')}`; }
function inputValue(value) { return escapeHtml(value || ''); }
function syncMembershipFields(form, updatePeriod = false) { if (!form || form.dataset.type !== 'membership') return; const plan = planById(form.elements.plan_id?.value); const start = form.elements.start_date?.value; const info = form.querySelector('#selectedPlanInfo'); if (info) info.innerHTML = plan ? `<div class="plan-info-grid"><span><b>Layanan</b>${escapeHtml(planService(plan))}</span><span><b>Durasi</b>${durationLabel(plan.duration_months)}</span><span><b>Harga</b>${money(plan.price)}</span><span><b>Akses</b>${escapeHtml(planAccessDescription(plan))}</span></div>` : ''; if (plan && form.elements.amount && !form.dataset.id) form.elements.amount.value = plan.price; if (plan && start && form.elements.end_date && (!form.dataset.id || updatePeriod)) form.elements.end_date.value = addMonths(start, plan.duration_months); }
function syncPaymentFields(form) {
  if (!form || form.dataset.type !== 'payment') return;
  const membershipSelect = form.elements.membership_id;
  if (membershipSelect) membershipSelect.required = true;
  form.querySelector('.journal-section')?.remove();
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
  if (payment?.membership_id && sameId(payment.membership_id, membership?.id)) form.insertAdjacentHTML('beforeend', paymentJournalMarkup(payment));
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
function protectHistoricalFields(form) {
  if (!form) return;
  const id = form?.dataset.id;
  if (form.dataset.type === 'membership') {
    if (form.elements.amount) form.elements.amount.readOnly = true;
    const membership = id ? membershipById(id) : null;
    const labels = { active: 'Aktif', pending: 'Menunggu', expired: 'Berakhir', cancelled: 'Dibatalkan' };
    [...form.elements.status.options].forEach((option) => { option.textContent = labels[option.value] || option.textContent; });
    if (!membership) return;
    const hasPayments = state.data.payments.some((payment) => sameId(payment.membership_id, id));
    if (hasPayments) ['customer_id', 'plan_id', 'start_date', 'end_date'].forEach((name) => {
      if (form.elements[name]) form.elements[name].disabled = true;
    });
  }
  if (form.dataset.type === 'payment') {
    if (!id) return;
    ['customer_id', 'membership_id', 'payment_date', 'status', 'notes'].forEach((name) => {
      if (form.elements[name]) form.elements[name].disabled = true;
    });
    if (form.elements.amount) form.elements.amount.readOnly = true;
  }
}
function validateEntry(type, body, id) {
  if (type === 'customer') {
    if (!body.member_code || !body.full_name) return 'Kode member dan nama wajib diisi.';
    const duplicateCode = state.data.customers.some((item) => item.id !== id && item.member_code.trim().toLowerCase() === body.member_code.trim().toLowerCase());
    const duplicateEmail = body.email && state.data.customers.some((item) => item.id !== id && item.email?.trim().toLowerCase() === body.email.trim().toLowerCase());
    if (duplicateCode) return 'Kode member sudah digunakan.';
    if (duplicateEmail) return 'Email sudah digunakan.';
  }
  if (type === 'membership' && !id && (!body.customer_id || !body.plan_id || !body.start_date || !body.end_date)) return 'Customer, plan, dan tanggal wajib diisi.';
  if (type === 'membership') {
    const plan = planById(body.plan_id);
    const currentMembership = state.data.memberships.find((membership) => membership.id === id);
    const retainingInactivePlan = currentMembership?.plan_id === body.plan_id;
    const selectedPlan = plan || (id && currentMembership ? planById(currentMembership.plan_id) : null);
    if (!selectedPlan) return 'Paket membership tidak ditemukan.';
    if (body.plan_id && !availablePlans().some((availablePlan) => availablePlan.id === selectedPlan.id) && !retainingInactivePlan) return 'Paket ini tidak aktif dan tidak dapat dipilih untuk membership baru.';
    if (currentMembership && body.amount !== undefined && toCents(body.amount) !== toCents(currentMembership.amount)) return 'Nominal kontrak membership tidak dapat diubah.';
    if (currentMembership && state.data.payments.some((payment) => sameId(payment.membership_id, id))) {
      for (const field of ['customer_id', 'plan_id', 'start_date', 'end_date']) {
        if (body[field] !== undefined && String(body[field]) !== String(currentMembership[field])) return 'Kontrak yang memiliki riwayat pembayaran tidak dapat mengubah pelanggan, paket, atau periode.';
      }
    }
    if (!id && toCents(body.amount) !== toCents(selectedPlan.price)) return 'Nominal membership harus mengikuti harga paket yang dipilih.';
  }
  if (type === 'payment' && !id && (!body.customer_id || !body.membership_id || !body.payment_date || !body.payment_method || !body.status)) return 'Customer, membership, tanggal, metode, dan status wajib diisi.';
  if ((type === 'membership' || type === 'payment') && (body.amount !== undefined || !id) && (!Number.isFinite(Number(body.amount)) || Number(body.amount) <= 0)) return 'Amount harus berupa angka lebih dari 0.';
  if (type === 'membership' && body.end_date && body.start_date && body.end_date < body.start_date) return 'End date tidak boleh sebelum start date.';
  if (type === 'payment') {
    const currentPayment = state.data.payments.find((payment) => payment.id === id);
    if (currentPayment) {
      for (const field of ['amount', 'status', 'payment_date', 'customer_id', 'membership_id', 'notes']) {
        if (body[field] !== undefined && String(body[field] ?? '') !== String(currentPayment[field] ?? '')) return 'Nominal, status, tanggal, dan relasi pembayaran historis tidak dapat diubah.';
      }
    }
    const membership = membershipById(body.membership_id || currentPayment?.membership_id);
    const customerId = body.customer_id || currentPayment?.customer_id;
    if (!membership || !sameId(membership.customer_id, customerId)) return 'Membership harus milik customer yang dipilih.';
    if (body.status === 'paid' && !id) {
      const otherPayments = state.data.payments.filter((payment) => sameId(payment.membership_id, body.membership_id) && payment.status === 'paid');
      const alreadyPaidCents = otherPayments.reduce((sum, payment) => sum + toCents(payment.amount), 0);
      if (alreadyPaidCents + toCents(body.amount) > toCents(membership.amount)) return 'Total pembayaran lunas tidak boleh melebihi nilai membership.';
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
  if (type === 'payment') {
    const existingPayment = state.data.payments.find((payment) => payment.id === id);
    if (existingPayment) {
      if (!existingPayment.membership_id) {
        showToast('Pembayaran lama yang belum tertaut ke membership tidak dapat diubah dari form ini.', true);
        return;
      }
      delete body.membership_id;
    }
  }
  if (type === 'membership' && id) {
    const existingMembership = membershipById(id);
    if (existingMembership && body.amount === undefined) body.amount = Number(existingMembership.amount);
    else if (body.amount !== undefined) body.amount = Number(body.amount);
  } else if (type === 'membership' && body.plan_id) {
    body.amount = Number(planById(body.plan_id)?.price);
  } else if (type === 'payment' && body.amount !== undefined) body.amount = Number(body.amount);
  const validationError = validateEntry(type, body, id);
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
document.addEventListener('click', (event) => { const target = event.target.closest('[data-action="view-active-memberships"]'); if (!target) return; state.view = 'members'; state.customerFilter = 'active'; document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === 'members')); render(); });
document.addEventListener('click', (event) => { const nav = event.target.closest('[data-view]'); if (nav) { state.view = nav.dataset.view; document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item === nav)); render(); return; } const target = event.target.closest('[data-action]'); if (!target) return; const action = target.dataset.action; if (action === 'add-customer') openModal('customer'); if (action === 'add-membership') openModal('membership'); if (action === 'add-payment') openModal('payment'); if (action === 'view-payments') { state.view = 'payments'; render(); } if (action === 'view-membership-plans') { state.view = 'plans'; document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === 'plans')); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); } if (action === 'edit') openModal(target.dataset.type, state.data[collectionFor(target.dataset.type)].find((item) => item.id === target.dataset.id)); if (action === 'view-space') openSpaceDetail(target.dataset.space); });
document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  if (target.dataset.action === 'retry-catalog') void loadData().catch((error) => console.error('Gagal memuat katalog Supabase:', error));
  if (target.dataset.action === 'open-settings') {
    state.view = 'settings';
    document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === 'settings'));
    render();
  }
});
document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-action="add-membership"], [data-action="edit"][data-type="membership"], [data-action="edit"][data-type="payment"]');
  if (trigger) queueMicrotask(() => protectHistoricalFields($('#entryForm')));
});
document.addEventListener('click', (event) => { const journalTrigger = event.target.closest('[data-action="view-journal"]'); if (!journalTrigger) return; state.view = 'journal'; document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === 'journal')); render(); });
document.addEventListener('keydown', (event) => { if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.service-card')) { event.preventDefault(); openSpaceDetail(event.target.dataset.space); } });
document.addEventListener('change', (event) => {
  const target = event.target;
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
  if (target.name === 'plan_id' || target.name === 'start_date') syncMembershipFields(target.form, true);
  if (target.name === 'customer_id' && target.form?.dataset.type === 'payment') {
    const membershipSelect = target.form.elements.membership_id;
    membershipSelect.innerHTML = paymentMembershipOptions(target.value);
    syncPaymentFields(target.form);
  }
  if (target.name === 'membership_id') syncPaymentFields(target.form);
});
$('#quickAddButton').addEventListener('click', () => openModal('payment'));
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
