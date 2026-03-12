/**
 * ═══════════════════════════════════════════════════════════════
 * SUE DAT AZZ — Master Sales Funnel Dashboard JS
 * James Consumer Law Group | Jamaree R. James, Esq.
 * Built: March 6, 2026
 * ═══════════════════════════════════════════════════════════════
 */

// ─── Revenue Chart (Chart.js) ───────────────────────────────
let revenueChart = null;

function initChart() {
  const ctx = document.getElementById('revenueChart');
  if (!ctx) return;
  revenueChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Litigation', 'Defense Retainers', 'MFSN', 'Legal Shield', 'Education', 'B2B Consulting', 'B2B Retainers'],
      datasets: [{
        data: [0,0,0,0,0,0,0],
        backgroundColor: [
          'rgba(232,69,69,0.85)',
          'rgba(252,92,101,0.85)',
          'rgba(78,205,196,0.85)',
          'rgba(245,200,66,0.85)',
          'rgba(162,155,254,0.85)',
          'rgba(108,92,231,0.85)',
          'rgba(130,88,255,0.85)',
        ],
        borderWidth: 0,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#9090A8',
            font: { size: 11, family: 'Inter' },
            padding: 12,
            usePointStyle: true,
            pointStyleWidth: 8,
          }
        },
        tooltip: {
          callbacks: {
            label: function(ctx) {
              const val = ctx.parsed;
              if (val === 0) return null;
              return ` ${ctx.label}: ${formatCurrency(val)}/mo`;
            }
          },
          backgroundColor: '#1A1A26',
          borderColor: 'rgba(245,200,66,0.3)',
          borderWidth: 1,
          titleColor: '#fff',
          bodyColor: '#9090A8',
          padding: 12,
          cornerRadius: 8,
        }
      }
    }
  });
}

// ─── Format helpers ──────────────────────────────────────────
function formatCurrency(num) {
  if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`;
  return `$${Math.round(num).toLocaleString()}`;
}
function formatComma(num) {
  return `$${Math.round(num).toLocaleString()}`;
}

// ─── Revenue Calculator ──────────────────────────────────────
function calcRevenue() {
  // Get all inputs
  const cases        = +document.getElementById('cases').value;
  const caseVal      = +document.getElementById('case-value').value;
  const retainers    = +document.getElementById('retainers').value;
  const retVal       = +document.getElementById('retainer-value').value;
  const mfsnSubs     = +document.getElementById('mfsn-subs').value;
  const mfsnComm     = +document.getElementById('mfsn-comm').value;
  const shieldMem    = +document.getElementById('shield-members').value;
  const eduSales     = +document.getElementById('edu-sales').value;
  const b2bEng       = +document.getElementById('b2b-eng').value;
  const b2bVal       = +document.getElementById('b2b-value').value;
  const b2bRet       = +document.getElementById('b2b-ret').value;

  // Update display values
  document.getElementById('cases-val').textContent = cases;
  document.getElementById('case-value-val').textContent = `$${caseVal.toLocaleString()}`;
  document.getElementById('retainers-val').textContent = retainers;
  document.getElementById('retainer-value-val').textContent = `$${retVal.toLocaleString()}`;
  document.getElementById('mfsn-subs-val').textContent = mfsnSubs.toLocaleString();
  document.getElementById('mfsn-comm-val').textContent = `$${(+mfsnComm).toFixed(2)}`;
  document.getElementById('shield-members-val').textContent = shieldMem.toLocaleString();
  document.getElementById('edu-sales-val').textContent = eduSales;
  document.getElementById('b2b-eng-val').textContent = b2bEng;
  document.getElementById('b2b-value-val').textContent = `$${b2bVal.toLocaleString()}`;
  document.getElementById('b2b-ret-val').textContent = b2bRet;

  // Calculate streams
  const revLegal    = cases * caseVal;
  const revRet      = retainers * retVal;
  const revMFSN     = mfsnSubs * mfsnComm;
  const revShield   = shieldMem * 49;
  const revEdu      = eduSales * 67;   // avg of $37–$97
  const revB2B      = b2bEng * b2bVal;
  const revB2BRet   = b2bRet * 3750;  // avg $2,500–$5,000

  const total = revLegal + revRet + revMFSN + revShield + revEdu + revB2B + revB2BRet;
  const annual = total * 12;

  // Update totals
  document.getElementById('total-revenue').textContent = formatComma(total);
  document.getElementById('annual-revenue').textContent = `${formatCurrency(annual)} annually`;

  // Update bar chart (percentage of max)
  const streams = [
    { id: 'legal', val: revLegal },
    { id: 'ret',   val: revRet },
    { id: 'mfsn',  val: revMFSN },
    { id: 'shield',val: revShield },
    { id: 'edu',   val: revEdu },
    { id: 'b2b',   val: revB2B },
    { id: 'b2b-ret', val: revB2BRet },
  ];
  const maxStream = Math.max(...streams.map(s => s.val), 1);
  streams.forEach(s => {
    const bar = document.getElementById(`bar-${s.id}`);
    const amt = document.getElementById(`rev-${s.id}`);
    if (bar) bar.style.width = `${(s.val / maxStream) * 100}%`;
    if (amt) amt.textContent = formatComma(s.val);
  });

  // Update donut chart
  if (revenueChart) {
    revenueChart.data.datasets[0].data = [
      revLegal, revRet, revMFSN, revShield, revEdu, revB2B, revB2BRet
    ];
    revenueChart.update('none');
  }
}

// ─── Stage Accordion ─────────────────────────────────────────
function toggleStage(num) {
  const card = document.querySelector(`.stage-card[data-stage="${num}"]`);
  const body = document.getElementById(`stage-body-${num}`);
  if (!card || !body) return;
  const isOpen = card.classList.contains('open');
  // Close all
  document.querySelectorAll('.stage-card').forEach(c => c.classList.remove('open'));
  document.querySelectorAll('.stage-body').forEach(b => b.classList.remove('open'));
  // Open clicked (if wasn't open)
  if (!isOpen) {
    card.classList.add('open');
    body.classList.add('open');
    // Smooth scroll
    setTimeout(() => {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  }
}

// ─── Task Tracker ─────────────────────────────────────────────
const taskCounts = { w1: 5, w2: 5, w3: 5, w4: 5 };

function toggleTask(el, week) {
  el.classList.toggle('completed');
  updateWeekProgress(week);
  updateTotalProgress();
}

function updateWeekProgress(week) {
  const container = document.getElementById(`${week}-tasks`);
  const total = taskCounts[week];
  const done = container ? container.querySelectorAll('.task-item.completed').length : 0;
  const el = document.getElementById(`${week}-progress`);
  if (el) el.textContent = `${done}/${total}`;
}

function updateTotalProgress() {
  let totalDone = 0;
  const totalAll = 20;
  ['w1','w2','w3','w4'].forEach(w => {
    const container = document.getElementById(`${w}-tasks`);
    if (container) totalDone += container.querySelectorAll('.task-item.completed').length;
  });
  const bar = document.getElementById('total-progress-bar');
  const count = document.getElementById('total-progress-count');
  if (bar) bar.style.width = `${(totalDone / totalAll) * 100}%`;
  if (count) count.textContent = `${totalDone} / ${totalAll} tasks complete`;
}

// ─── KPI Updaters ─────────────────────────────────────────────
// KPIs 1-4 are percentages with defined targets
const kpiTargets = {
  1: 35,   // Lead magnet conversion
  2: 40,   // Email open rate
  3: 70,   // Show rate
  4: 65,   // Close rate
};

function updateKPI(num) {
  const input = document.getElementById(`kpi-${num}`);
  const status = document.getElementById(`kpi-status-${num}`);
  const bar = document.getElementById(`kpi-bar-${num}`);
  if (!input) return;
  const val = parseFloat(input.value);
  const target = kpiTargets[num];
  if (isNaN(val) || input.value === '') {
    if (status) { status.textContent = '—'; status.className = 'kpi-status'; }
    if (bar) bar.style.width = '0%';
    return;
  }
  const pct = Math.min((val / 100) * 100, 100);
  if (bar) bar.style.width = `${pct}%`;
  const ratio = val / target;
  if (ratio >= 1) {
    if (status) { status.textContent = `✅ On Track (${val}% vs ${target}% target)`; status.className = 'kpi-status status-on-track'; }
    if (bar) bar.style.background = 'linear-gradient(90deg, #26de81, #2ed573)';
  } else if (ratio >= 0.7) {
    if (status) { status.textContent = `⚠️ Needs Work (${val}% vs ${target}% target)`; status.className = 'kpi-status status-needs-work'; }
    if (bar) bar.style.background = 'linear-gradient(90deg, #fed330, #ffd428)';
  } else {
    if (status) { status.textContent = `🔴 Critical (${val}% vs ${target}% target)`; status.className = 'kpi-status status-critical'; }
    if (bar) bar.style.background = 'linear-gradient(90deg, #fc5c65, #ff6b6b)';
  }
}

function updateKPISubs() {
  const input = document.getElementById('kpi-5');
  const status = document.getElementById('kpi-status-5');
  const bar = document.getElementById('kpi-bar-5');
  if (!input) return;
  const val = parseInt(input.value);
  if (isNaN(val) || input.value === '') {
    if (status) { status.textContent = '—'; status.className = 'kpi-status'; }
    if (bar) bar.style.width = '0%';
    return;
  }
  const target = 500;
  const pct = Math.min((val / target) * 100, 100);
  if (bar) bar.style.width = `${pct}%`;
  const ratio = val / target;
  if (ratio >= 1) {
    if (status) { status.textContent = `✅ On Track — ${val.toLocaleString()} / ${target} target`; status.className = 'kpi-status status-on-track'; }
    if (bar) bar.style.background = 'linear-gradient(90deg, #26de81, #2ed573)';
  } else if (ratio >= 0.5) {
    if (status) { status.textContent = `⚠️ Building — ${val.toLocaleString()} / ${target} target`; status.className = 'kpi-status status-needs-work'; }
    if (bar) bar.style.background = 'linear-gradient(90deg, #fed330, #ffd428)';
  } else {
    if (status) { status.textContent = `🔴 Early stage — ${val.toLocaleString()} / ${target} target`; status.className = 'kpi-status status-critical'; }
    if (bar) bar.style.background = 'linear-gradient(90deg, #fc5c65, #ff6b6b)';
  }
}

function updateKPIMRR() {
  const input = document.getElementById('kpi-6');
  const status = document.getElementById('kpi-status-6');
  const bar = document.getElementById('kpi-bar-6');
  if (!input) return;
  const val = parseInt(input.value);
  if (isNaN(val) || input.value === '') {
    if (status) { status.textContent = '—'; status.className = 'kpi-status'; }
    if (bar) bar.style.width = '0%';
    return;
  }
  const target = 10000;
  const pct = Math.min((val / target) * 100, 100);
  if (bar) bar.style.width = `${pct}%`;
  if (val >= target) {
    if (status) { status.textContent = `✅ Target Hit — ${formatComma(val)} / $10K target`; status.className = 'kpi-status status-on-track'; }
    if (bar) bar.style.background = 'linear-gradient(90deg, #26de81, #2ed573)';
  } else if (val >= 5000) {
    if (status) { status.textContent = `⚠️ Halfway There — ${formatComma(val)} / $10K target`; status.className = 'kpi-status status-needs-work'; }
    if (bar) bar.style.background = 'linear-gradient(90deg, #fed330, #ffd428)';
  } else {
    if (status) { status.textContent = `🔴 Building MRR — ${formatComma(val)} / $10K target`; status.className = 'kpi-status status-critical'; }
    if (bar) bar.style.background = 'linear-gradient(90deg, #fc5c65, #ff6b6b)';
  }
}

function updateKPICase() {
  const input = document.getElementById('kpi-7');
  const status = document.getElementById('kpi-status-7');
  const bar = document.getElementById('kpi-bar-7');
  if (!input) return;
  const val = parseInt(input.value);
  if (isNaN(val) || input.value === '') {
    if (status) { status.textContent = '—'; status.className = 'kpi-status'; }
    if (bar) bar.style.width = '0%';
    return;
  }
  const pct = Math.min((val / 15000) * 100, 100);
  if (bar) bar.style.width = `${pct}%`;
  if (val >= 7500) {
    if (status) { status.textContent = `✅ Strong — avg case value ${formatComma(val)}`; status.className = 'kpi-status status-on-track'; }
    if (bar) bar.style.background = 'linear-gradient(90deg, #26de81, #2ed573)';
  } else if (val >= 3000) {
    if (status) { status.textContent = `⚠️ Solid — push for higher-value cases ${formatComma(val)}`; status.className = 'kpi-status status-needs-work'; }
    if (bar) bar.style.background = 'linear-gradient(90deg, #fed330, #ffd428)';
  } else {
    if (status) { status.textContent = `Track weekly trend — ${formatComma(val)} current avg`; status.className = 'kpi-status'; }
  }
}

// ─── Copy Command ─────────────────────────────────────────────
function copyCommand(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => showToast(`Copied: "${text}"`));
  } else {
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast(`Copied: "${text}"`);
  }
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-msg');
  if (!toast) return;
  if (msgEl) msgEl.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ─── Active Nav Highlighting ──────────────────────────────────
function initActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach(link => {
          link.style.color = link.getAttribute('href') === `#${id}` 
            ? 'var(--gold)' 
            : '';
        });
      }
    });
  }, { threshold: 0.4 });
  sections.forEach(s => observer.observe(s));
}

// ─── Animate numbers on scroll ───────────────────────────────
function animateOnScroll() {
  const hero = document.querySelector('.hero-stats');
  if (!hero) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.2 });
  document.querySelectorAll('.stream-card, .kpi-card, .command-card, .tech-item').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(el);
  });
}

// ─── Open Stage 1 by Default ─────────────────────────────────
function openDefaultStage() {
  const card = document.querySelector('.stage-card[data-stage="1"]');
  const body = document.getElementById('stage-body-1');
  if (card && body) {
    card.classList.add('open');
    body.classList.add('open');
  }
}

// ─── Smooth hash scroll fix ───────────────────────────────────
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        const offset = 80; // header height
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });
}

// ─── Init ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initChart();
  calcRevenue();
  openDefaultStage();
  initActiveNav();
  initSmoothScroll();

  // Slight delay for scroll animations
  setTimeout(animateOnScroll, 500);
  
  // Add hover effect to funnel stage blocks to expand related accordion stage
  document.querySelectorAll('.funnel-stage-block[data-stage]').forEach(block => {
    block.addEventListener('click', () => {
      const stage = block.getAttribute('data-stage');
      if (stage) {
        const stagesSection = document.getElementById('stages');
        if (stagesSection) {
          stagesSection.scrollIntoView({ behavior: 'smooth' });
          setTimeout(() => toggleStage(parseInt(stage)), 600);
        }
      }
    });
  });

  console.log('%c⚖️ SUE DAT AZZ — Master Sales Funnel Loaded', 'color: #F5C842; font-size: 14px; font-weight: bold;');
  console.log('%cJames Consumer Law Group | Jamaree R. James, Esq. | March 6, 2026', 'color: #9090A8; font-size: 11px;');
});
