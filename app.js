// ==========================================
// Productivity JABIL DR - CLOUD SYNC PRO (JSONBLOB)
// ==========================================

const globalHours = [
    "07:00 - 08:00", "08:00 - 09:00", "09:00 - 10:00", "10:00 - 11:00", 
    "11:00 - 12:00", "12:00 - 13:00", "13:00 - 14:00", "14:00 - 15:00", 
    "15:00 - 16:00", "16:00 - 17:00", "17:00 - 18:00", "18:00 - 19:00",
    "19:00 - 20:00", "20:00 - 21:00", "21:00 - 22:00", "22:00 - 23:00", "23:00 - 00:00"
];

// SERVIDOR ULTRA ESTABLE
const CLOUD_URL = "https://jsonblob.com/api/jsonBlob/019db2d4-b86a-7a84-b3a0-b612e3361427";

// --- Global Data ---
let appTechnicians = [];
let productivityData = {};
let productivityChartInstance = null;

// ------------------------------------------
// Cloud Sync Logic
// ------------------------------------------

async function syncWithCloud() {
    try {
        const response = await fetch(CLOUD_URL);
        const data = await response.json();
        
        // Si hay datos en la nube, los descargamos
        if (data && data.techs && data.techs.length > 0) {
            appTechnicians = data.techs;
            productivityData = data.productivity || {};
            localStorage.setItem('jabil_techs_list', JSON.stringify(appTechnicians));
            localStorage.setItem('jabil_proto_data', JSON.stringify(productivityData));
            refreshUI();
        } else {
            // Si la nube está vacía, subimos lo que tenemos localmente
            console.log("Nube vacía. Sincronizando datos locales hacia la nube...");
            loadLocalBackup();
            saveToCloud(); // Subir lo local para que ya no esté vacío
        }
    } catch (error) {
        console.warn("Cloud offline, using local backup.");
        loadLocalBackup();
    }
}

function loadLocalBackup() {
    appTechnicians = JSON.parse(localStorage.getItem('jabil_techs_list')) || [
        { id: "JB-001", name: "Técnico Ejemplo", pin: "1234" }
    ];
    productivityData = JSON.parse(localStorage.getItem('jabil_proto_data')) || {};
    refreshUI();
}

async function saveToCloud() {
    try {
        const dataToSave = {
            techs: appTechnicians,
            productivity: productivityData,
            lastUpdate: new Date().toISOString()
        };
        
        await fetch(CLOUD_URL, {
            method: 'PUT', // JSONBlob usa PUT para actualizar
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToSave)
        });
        
        updateLastSync();
    } catch (error) {
        console.error("Error saving to cloud:", error);
    }
}

function refreshUI() {
    if(window.refreshTechSelect) window.refreshTechSelect();
    if(window.renderAdminTable) window.renderAdminTable();
    renderDashboard();
    updateKPIs();
    updateTotalGlobal();
}

function updateLastSync() {
    const el = document.getElementById('last-sync-time');
    if(el) {
        const now = new Date();
        el.innerHTML = `<i class="fa-solid fa-cloud-check" style="color:#22c55e"></i> Cloud OK: ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
    }
}

// Sincronizar cada 15 segundos
setInterval(syncWithCloud, 15000);

// ------------------------------------------
// KPI & Dashboard Logic
// ------------------------------------------

function updateKPIs() {
    const today = new Date().toISOString().split('T')[0];
    const currentMonthPrefix = today.substring(0, 7); 
    
    let shiftLeader = { name: "---", count: 0 };
    let monthLeader = { name: "---", count: 0 };
    let totalToday = 0;
    
    const techMonthlyTotals = {};
    const techTodayTotals = {};

    Object.keys(productivityData).forEach(dateStr => {
        const isToday = dateStr === today;
        const isThisMonth = dateStr.startsWith(currentMonthPrefix);
        
        Object.keys(productivityData[dateStr]).forEach(techId => {
            let techCount = 0;
            const hoursData = productivityData[dateStr][techId];
            Object.values(hoursData).forEach(items => {
                techCount += Array.isArray(items) ? items.length : 0;
            });

            if (isToday) {
                techTodayTotals[techId] = (techTodayTotals[techId] || 0) + techCount;
                totalToday += techCount;
            }
            if (isThisMonth) {
                techMonthlyTotals[techId] = (techMonthlyTotals[techId] || 0) + techCount;
            }
        });
    });

    Object.keys(techTodayTotals).forEach(tid => {
        if (techTodayTotals[tid] > shiftLeader.count) {
            const tech = appTechnicians.find(t => t.id === tid);
            shiftLeader = { name: tech ? tech.name : tid, count: techTodayTotals[tid] };
        }
    });

    Object.keys(techMonthlyTotals).forEach(tid => {
        if (techMonthlyTotals[tid] > monthLeader.count) {
            const tech = appTechnicians.find(t => t.id === tid);
            monthLeader = { name: tech ? tech.name : tid, count: techMonthlyTotals[tid] };
        }
    });

    const now = new Date();
    let hoursPassed = now.getHours() - 7;
    if (hoursPassed <= 0) hoursPassed = 1;
    const efficiency = (totalToday / hoursPassed).toFixed(1);

    const slName = document.getElementById('shift-leader-name');
    const slCount = document.getElementById('shift-leader-count');
    const mlName = document.getElementById('month-leader-name');
    const mlCount = document.getElementById('month-leader-count');
    const effVal = document.getElementById('avg-efficiency');
    const totalHoy = document.getElementById('total-hoy');

    if(slName) slName.textContent = shiftLeader.name;
    if(slCount) slCount.textContent = `${shiftLeader.count} unidades`;
    if(mlName) mlName.textContent = monthLeader.name;
    if(mlCount) mlCount.textContent = `${monthLeader.count} unidades`;
    if(effVal) effVal.textContent = efficiency;
    if(totalHoy) totalHoy.textContent = totalToday;
}

// ------------------------------------------
// UI Setup
// ------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
    await syncWithCloud();
    updateDate();
    initNavigation();
    initForm();
    initAdmin(); 

    if (localStorage.getItem('jabil_theme') === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
    }
});

function getFilteredItems(techId, hour) {
    const startStr = document.getElementById('filter-date-start').value;
    const endStr = document.getElementById('filter-date-end').value;
    let combinedItems = [];
    
    Object.keys(productivityData).forEach(dateStr => {
        if (dateStr >= startStr && dateStr <= endStr) {
            if (productivityData[dateStr] && productivityData[dateStr][techId]) {
                let items = productivityData[dateStr][techId][hour];
                if (Array.isArray(items)) combinedItems.push(...items);
            }
        }
    });
    return combinedItems;
}

function updateDate() {
    const dateDisplay = document.getElementById('current-date');
    if(dateDisplay) dateDisplay.textContent = new Date().toLocaleDateString('es-DO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    const startEl = document.getElementById('filter-date-start');
    const endEl = document.getElementById('filter-date-end');
    const nowStr = new Date().toISOString().split('T')[0];
    
    if(startEl && !startEl.value) startEl.value = nowStr;
    if(endEl && !endEl.value) endEl.value = nowStr;

    [startEl, endEl].forEach(el => {
        if(el) {
            el.addEventListener('change', () => {
                 updateKPIs();
                 renderDashboard();
                 if(document.getElementById('grafica-view').classList.contains('active')) renderChart();
            });
        }
    });

    initClock();
    
    const themeToggle = document.getElementById('theme-toggle');
    if(themeToggle) {
        themeToggle.addEventListener('click', () => {
            const isDark = document.body.getAttribute('data-theme') === 'dark';
            document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
            localStorage.setItem('jabil_theme', isDark ? 'light' : 'dark');
            themeToggle.innerHTML = isDark ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
        });
    }

    const btnExport = document.getElementById('btn-export-excel');
    if(btnExport) btnExport.addEventListener('click', exportToExcel);
}

function initClock() {
    const clockDisp = document.getElementById('live-clock-display');
    if(clockDisp) {
        setInterval(() => {
            clockDisp.textContent = new Date().toLocaleTimeString('es-DO', { hour12: false });
        }, 1000);
    }
}

function initNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const views = document.querySelectorAll('.view');
    
    const modal = document.getElementById('admin-auth-modal');
    const passInput = document.getElementById('admin-password-input');
    let authCb = null;

    window.showAdminAuthModal = (cb) => {
        authCb = cb;
        passInput.value = '';
        const stored = localStorage.getItem('jabil_admin_password');
        document.getElementById('auth-modal-desc').textContent = stored ? "Ingresa la Clave Maestra." : "Crea una Clave Maestra:";
        modal.classList.add('active');
        setTimeout(() => passInput.focus(), 100);
    };

    document.getElementById('btn-auth-cancel').onclick = () => modal.classList.remove('active');
    document.getElementById('btn-auth-submit').onclick = () => {
        const val = passInput.value;
        const stored = localStorage.getItem('jabil_admin_password');
        if(!stored && val.length >= 3) {
            localStorage.setItem('jabil_admin_password', val);
            modal.classList.remove('active');
            if(authCb) authCb();
        } else if(val === stored) {
            modal.classList.remove('active');
            if(authCb) authCb();
        } else {
            alert("Clave incorrecta.");
        }
    };

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const action = () => {
                navBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                views.forEach(v => v.classList.remove('active'));
                document.getElementById(targetId).classList.add('active');
                if(targetId === 'dashboard-view') renderDashboard();
                if(targetId === 'grafica-view') renderChart();
            };

            if(targetId === 'tecnicos-view') showAdminAuthModal(action);
            else action();
        });
    });
}

function initForm() {
    const techSelect = document.getElementById('tech-select');
    const form = document.getElementById('registro-form');

    window.refreshTechSelect = () => {
        if(!techSelect) return;
        const currentVal = techSelect.value;
        techSelect.innerHTML = '<option value="" disabled selected>Selecciona un técnico</option>';
        appTechnicians.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.name;
            techSelect.appendChild(opt);
        });
        if(currentVal) techSelect.value = currentVal;
    };

    let isAuth = false;
    techSelect.addEventListener('change', () => {
        if(isAuth) return;
        const tech = appTechnicians.find(t => t.id === techSelect.value);
        if(tech && tech.pin) {
            isAuth = true;
            showTechAuthModal(tech, () => { isAuth = false; document.getElementById('scanner-input').focus(); }, () => { isAuth = false; techSelect.value = ''; });
        }
    });

    const numInput = document.getElementById('repairs-input');
    document.querySelector('.decrease').onclick = () => { if(numInput.value > 1) numInput.value--; };
    document.querySelector('.increase').onclick = () => { numInput.value++; };

    const scanner = document.getElementById('scanner-input');
    if(scanner) {
        scanner.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') {
                const val = scanner.value.trim();
                if(!val) return;
                const found = appTechnicians.find(t => t.id === val);
                if(found) { techSelect.value = found.id; scanner.value = ''; return; }
                const tid = techSelect.value;
                if(!tid) { alert('Selecciona técnico.'); scanner.value=''; return; }
                submitProductivity(tid, autoDetectHour(), [val]);
                scanner.value = '';
            }
        });
    }

    if(form) {
        form.onsubmit = (e) => {
            e.preventDefault();
            const tid = techSelect.value;
            if(!tid) return;
            submitProductivity(tid, autoDetectHour(), Array(parseInt(numInput.value)).fill("Manual"));
            numInput.value = 1;
        };
    }
}

function autoDetectHour() {
    const h = new Date().getHours();
    return `${h.toString().padStart(2,'0')}:00 - ${(h+1).toString().padStart(2,'0')}:00`;
}

function submitProductivity(techId, hour, serials) {
    const day = new Date().toISOString().split('T')[0];
    if(!productivityData[day]) productivityData[day] = {};
    if(!productivityData[day][techId]) productivityData[day][techId] = {};
    if(!productivityData[day][techId][hour]) productivityData[day][techId][hour] = [];
    
    const ts = new Date().toLocaleTimeString('es-DO', {hour12:false}).substring(0,5);
    serials.forEach(s => productivityData[day][techId][hour].push({serial: s, timestamp: ts}));

    saveToCloud();
    refreshUI();
    showSuccessNotification();
}

function showSuccessNotification() {
    const toast = document.getElementById('success-toast');
    if(!toast) return;
    toast.style.display = 'flex';
    setTimeout(() => {
        toast.style.display = 'none';
        const dashBtn = document.querySelector('[data-target="dashboard-view"]');
        if(dashBtn) dashBtn.click();
    }, 1500);
}

function renderDashboard() {
    const tableHeader = document.getElementById('table-header-row');
    const tableBody = document.getElementById('dashboard-table-body');
    if(!tableHeader || !tableBody) return;

    tableHeader.innerHTML = '<th>Técnico</th>' + globalHours.map(h => `<th>${h}</th>`).join('') + '<th class="total-col">Total</th>';

    tableBody.innerHTML = appTechnicians.map(tech => {
        let rowTotal = 0;
        const cells = globalHours.map(hour => {
            const val = getFilteredItems(tech.id, hour).length;
            rowTotal += val;
            let cls = 'val-cell' + (val === 0 ? ' zero' : (val <= 5 ? ' heat-low' : (val <= 10 ? ' heat-med' : ' heat-high')));
            return `<td class="${cls}">${val > 0 ? val : '-'}</td>`;
        }).join('');
        return `<tr><td>${tech.name}</td>${cells}<td class="val-cell total-col">${rowTotal}</td></tr>`;
    }).join('');
}

function updateTotalGlobal() {
    let total = 0;
    const start = document.getElementById('filter-date-start').value;
    const end = document.getElementById('filter-date-end').value;
    Object.keys(productivityData).forEach(d => {
        if(d >= start && d <= end) {
            Object.values(productivityData[d]).forEach(tData => Object.values(tData).forEach(items => total += items.length));
        }
    });
    if(document.getElementById('total-hoy')) document.getElementById('total-hoy').textContent = total;
}

function renderChart() {
    const canvas = document.getElementById('productivityChart');
    if(!canvas) return;
    const datasets = appTechnicians.map((tech, i) => ({
        label: tech.name,
        data: globalHours.map(h => getFilteredItems(tech.id, h).length),
        backgroundColor: `hsla(${i * 50}, 70%, 50%, 0.7)`
    }));
    if(productivityChartInstance) productivityChartInstance.destroy();
    productivityChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: { labels: globalHours.map(h => h.split(' ')[0]), datasets },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function showTechAuthModal(tech, ok, cancel) {
    const m = document.getElementById('tech-auth-modal');
    const input = document.getElementById('tech-password-input');
    document.getElementById('tech-auth-desc').textContent = `Hola ${tech.name}, PIN:`;
    m.classList.add('active');
    setTimeout(() => input.focus(), 100);
    document.getElementById('btn-tech-cancel').onclick = () => { m.classList.remove('active'); cancel(); };
    document.getElementById('btn-tech-submit').onclick = () => {
        if(input.value === tech.pin) { m.classList.remove('active'); ok(); }
        else alert("PIN incorrecto");
    };
}

function initAdmin() {
    const body = document.getElementById('tech-admin-body');
    const idIn = document.getElementById('new-tech-id');
    const nameIn = document.getElementById('new-tech-name');
    const pinIn = document.getElementById('new-tech-pin');
    const subBtn = document.getElementById('btn-add-tech');
    let editIdx = -1;

    window.renderAdminTable = () => {
        if(!body) return;
        body.innerHTML = appTechnicians.map((t, i) => `
            <tr><td>${t.id}</td><td>${t.name}</td><td>****</td>
            <td>
                <button class="btn-primary" style="width:auto;padding:5px 10px;margin-right:5px;" onclick="editTech(${i})"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-danger" style="width:auto;padding:5px 10px;" onclick="deleteTech(${i})"><i class="fa-solid fa-trash"></i></button>
            </td></tr>`).join('');
    };

    window.editTech = (i) => {
        editIdx = i;
        const t = appTechnicians[i];
        idIn.value = t.id; idIn.disabled = true;
        nameIn.value = t.name; pinIn.value = t.pin;
        subBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
    };

    window.deleteTech = (i) => {
        if(confirm(`¿Eliminar a ${appTechnicians[i].name}?`)) {
            appTechnicians.splice(i, 1);
            saveToCloud();
            renderAdminTable(); window.refreshTechSelect(); renderDashboard();
        }
    };

    document.getElementById('add-tech-form').onsubmit = (e) => {
        e.preventDefault();
        if(editIdx >= 0) {
            appTechnicians[editIdx].name = nameIn.value;
            appTechnicians[editIdx].pin = pinIn.value;
            editIdx = -1;
        } else {
            appTechnicians.push({id: idIn.value, name: nameIn.value, pin: pinIn.value});
        }
        idIn.value = ''; idIn.disabled = false; nameIn.value = ''; pinIn.value = '';
        subBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
        saveToCloud(); renderAdminTable(); window.refreshTechSelect(); renderDashboard();
    };
    renderAdminTable();
}

function exportToExcel() {
    let csv = "\uFEFFFecha,Técnico,Hora,Unidades\n";
    Object.keys(productivityData).forEach(d => {
        Object.keys(productivityData[d]).forEach(tid => {
            Object.keys(productivityData[d][tid]).forEach(h => {
                csv += `"${d}","${tid}","${h}",${productivityData[d][tid][h].length}\n`;
            });
        });
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `productividad_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}
