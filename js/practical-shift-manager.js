/**
 * 実用シフト管理システム
 * 本格的なシフト表作成・編集・管理機能
 */
class PracticalShiftManager {
    constructor() {
        this.currentDate = new Date();
        this.viewMode = 'month'; // 'month' or 'week'
        this.employees = this.loadEmployees();
        this.shiftData = this.loadShiftData();
        this.shiftPatterns = this.initShiftPatterns();
        this.draggedPattern = null;
        this.editingEmployee = null;

        // タッチデバイス対応
        this.isTouchDevice = 'ontouchstart' in window;
        this.longPressTimer = null;
        this.touchStartPos = null;

        this.init();
    }

    /**
     * システム初期化
     */
    init() {
        this.renderShiftTable();
        this.renderEmployeeList();
        this.renderShiftPatterns();
        this.updateStats();
        this.updateCurrentMonthDisplay();
        this.setupEventListeners();

        console.log('実用シフト管理システム initialized');
    }

    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        // 社員フォームの送信
        document.getElementById('employeeForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveEmployee();
        });

        // ファイルインポートハンドラー
        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileImport(e);
        });
    }

    /**
     * 初期社員データの読み込み
     */
    loadEmployees() {
        const saved = localStorage.getItem('practical_shift_employees');
        if (saved) {
            return JSON.parse(saved);
        }

        // デフォルト社員データ
        return [
            {
                id: 1,
                name: '田中 太郎',
                role: '正社員',
                email: 'tanaka@company.com'
            },
            {
                id: 2,
                name: '佐藤 花子',
                role: 'パート',
                email: 'sato@company.com'
            },
            {
                id: 3,
                name: '山田 次郎',
                role: 'アルバイト',
                email: 'yamada@company.com'
            },
            {
                id: 4,
                name: '鈴木 美咲',
                role: '正社員',
                email: 'suzuki@company.com'
            }
        ];
    }

    /**
     * シフトデータの読み込み
     */
    loadShiftData() {
        const saved = localStorage.getItem('practical_shift_data');
        if (saved) {
            return JSON.parse(saved);
        }

        // 初期シフトデータ（空）
        return {};
    }

    /**
     * シフトパターンの初期化
     */
    initShiftPatterns() {
        return [
            {
                id: 'early',
                name: '早番',
                time: '8:00-16:00',
                color: 'shift-early',
                icon: 'fas fa-sun'
            },
            {
                id: 'late',
                name: '遅番',
                time: '12:00-20:00',
                color: 'shift-late',
                icon: 'fas fa-moon'
            },
            {
                id: 'night',
                name: '夜勤',
                time: '20:00-8:00',
                color: 'shift-night',
                icon: 'fas fa-star'
            },
            {
                id: 'off',
                name: '休み',
                time: '-',
                color: 'shift-off',
                icon: 'fas fa-home'
            }
        ];
    }

    /**
     * 現在月表示の更新
     */
    updateCurrentMonthDisplay() {
        const monthNames = [
            '1月', '2月', '3月', '4月', '5月', '6月',
            '7月', '8月', '9月', '10月', '11月', '12月'
        ];

        const year = this.currentDate.getFullYear();
        const month = monthNames[this.currentDate.getMonth()];

        document.getElementById('currentMonth').textContent = `${year}年 ${month}`;
    }

    /**
     * シフト表の描画
     */
    renderShiftTable() {
        const container = document.getElementById('tableContainer');

        if (this.viewMode === 'month') {
            container.innerHTML = this.generateMonthTable();
        } else {
            container.innerHTML = this.generateWeekTable();
        }

        this.setupTableEventListeners();
    }

    /**
     * 月表示テーブルの生成
     */
    generateMonthTable() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        let html = '<table class="shift-table">';

        // ヘッダー行
        html += '<thead><tr><th>社員名</th>';
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;

            html += `<th style="${isWeekend ? 'background: #f56565; color: white;' : ''}">${day}<br><small>${dayOfWeek}</small></th>`;
        }
        html += '</tr></thead>';

        // データ行
        html += '<tbody>';
        this.employees.forEach(employee => {
            html += '<tr>';
            html += `<td class="employee-name">${employee.name}<br><small>${employee.role}</small></td>`;

            for (let day = 1; day <= daysInMonth; day++) {
                const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const shiftKey = `${employee.id}-${dateKey}`;
                const shift = this.shiftData[shiftKey];

                html += `<td class="day-cell"
                            data-employee-id="${employee.id}"
                            data-date="${dateKey}"
                            ondrop="shiftManager.drop(event)"
                            ondragover="shiftManager.allowDrop(event)"
                            ondragenter="shiftManager.dragEnter(event)"
                            ondragleave="shiftManager.dragLeave(event)"
                            onclick="shiftManager.cellClick(event)"
                            ontouchstart="shiftManager.touchStart(event)"
                            ontouchend="shiftManager.touchEnd(event)"
                            ontouchmove="shiftManager.touchMove(event)">`;

                if (shift) {
                    const pattern = this.shiftPatterns.find(p => p.id === shift.patternId);
                    if (pattern) {
                        html += `<span class="shift-badge ${pattern.color}"
                                    draggable="true"
                                    ondragstart="shiftManager.dragStart(event)"
                                    data-pattern-id="${pattern.id}">
                                    <i class="${pattern.icon}"></i> ${pattern.name}
                                </span>`;
                    }
                }

                html += '</td>';
            }
            html += '</tr>';
        });
        html += '</tbody></table>';

        return html;
    }

    /**
     * 週表示テーブルの生成（将来の機能拡張用）
     */
    generateWeekTable() {
        // 週表示のロジックをここに実装
        return '<div>週表示は開発中です</div>';
    }

    /**
     * テーブルイベントリスナーの設定
     */
    setupTableEventListeners() {
        // ドラッグ&ドロップの設定は各セルに直接設定済み
    }

    /**
     * 社員リストの描画
     */
    renderEmployeeList() {
        const container = document.getElementById('employeeList');

        let html = '';
        this.employees.forEach(employee => {
            html += `
                <div class="employee-item">
                    <div class="employee-info">
                        <div class="employee-name-text">${employee.name}</div>
                        <div class="employee-role">${employee.role}</div>
                    </div>
                    <div class="employee-actions">
                        <button class="btn-icon btn-edit" onclick="shiftManager.editEmployee(${employee.id})" title="編集">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon btn-delete" onclick="shiftManager.deleteEmployee(${employee.id})" title="削除">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    /**
     * シフトパターンの描画
     */
    renderShiftPatterns() {
        const container = document.getElementById('shiftPatterns');

        let html = '';
        this.shiftPatterns.forEach(pattern => {
            html += `
                <div class="pattern-item ${pattern.color}"
                     draggable="true"
                     ondragstart="shiftManager.patternDragStart(event)"
                     ontouchstart="shiftManager.patternTouchStart(event)"
                     ontouchend="shiftManager.patternTouchEnd(event)"
                     ontouchmove="shiftManager.patternTouchMove(event)"
                     data-pattern-id="${pattern.id}">
                    <i class="${pattern.icon}"></i><br>
                    ${pattern.name}<br>
                    <small>${pattern.time}</small>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    /**
     * 統計情報の更新
     */
    updateStats() {
        const stats = this.calculateStats();
        const container = document.getElementById('statsGrid');

        container.innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${stats.totalEmployees}</div>
                <div class="stat-label">社員数</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.totalShifts}</div>
                <div class="stat-label">今月シフト数</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.unassigned}</div>
                <div class="stat-label">未割当</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.conflicts}</div>
                <div class="stat-label">競合</div>
            </div>
        `;
    }

    /**
     * 統計データの計算
     */
    calculateStats() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        let totalShifts = 0;
        let unassigned = 0;

        for (let day = 1; day <= daysInMonth; day++) {
            this.employees.forEach(employee => {
                const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const shiftKey = `${employee.id}-${dateKey}`;

                if (this.shiftData[shiftKey]) {
                    totalShifts++;
                } else {
                    unassigned++;
                }
            });
        }

        return {
            totalEmployees: this.employees.length,
            totalShifts,
            unassigned,
            conflicts: 0 // 将来の機能拡張用
        };
    }

    // ドラッグ&ドロップ関連メソッド
    patternDragStart(event) {
        this.draggedPattern = event.target.dataset.patternId;
        event.dataTransfer.effectAllowed = 'copy';
    }

    dragStart(event) {
        // シフト表内でのドラッグ開始
        this.draggedPattern = event.target.dataset.patternId;
        event.dataTransfer.effectAllowed = 'move';
    }

    allowDrop(event) {
        event.preventDefault();
    }

    dragEnter(event) {
        event.preventDefault();
        event.target.classList.add('drag-over');
    }

    dragLeave(event) {
        event.target.classList.remove('drag-over');
    }

    drop(event) {
        event.preventDefault();
        event.target.classList.remove('drag-over');

        if (this.draggedPattern) {
            const employeeId = parseInt(event.target.dataset.employeeId);
            const date = event.target.dataset.date;

            this.assignShift(employeeId, date, this.draggedPattern);
            this.draggedPattern = null;
        }
    }

    /**
     * セルクリック処理
     */
    cellClick(event) {
        const employeeId = parseInt(event.target.dataset.employeeId);
        const date = event.target.dataset.date;

        if (event.target.querySelector('.shift-badge')) {
            // 既存のシフトがある場合は削除
            this.removeShift(employeeId, date);
        } else {
            // シフトがない場合は選択メニューを表示（簡略化のため早番を割り当て）
            this.assignShift(employeeId, date, 'early');
        }
    }

    /**
     * シフトの割り当て
     */
    assignShift(employeeId, date, patternId) {
        const shiftKey = `${employeeId}-${date}`;

        this.shiftData[shiftKey] = {
            employeeId,
            date,
            patternId,
            createdAt: new Date().toISOString()
        };

        this.saveShiftData();
        this.renderShiftTable();
        this.updateStats();
        this.showToast(`シフトを割り当てました: ${this.getEmployeeName(employeeId)} - ${date}`);
    }

    /**
     * シフトの削除
     */
    removeShift(employeeId, date) {
        const shiftKey = `${employeeId}-${date}`;
        delete this.shiftData[shiftKey];

        this.saveShiftData();
        this.renderShiftTable();
        this.updateStats();
        this.showToast('シフトを削除しました');
    }

    /**
     * 社員名の取得
     */
    getEmployeeName(employeeId) {
        const employee = this.employees.find(e => e.id === employeeId);
        return employee ? employee.name : '不明';
    }

    // 社員管理メソッド
    addEmployee() {
        this.editingEmployee = null;
        document.getElementById('employeeModalTitle').textContent = '社員追加';
        document.getElementById('employeeName').value = '';
        document.getElementById('employeeRole').value = '正社員';
        document.getElementById('employeeEmail').value = '';
        this.showModal('employeeModal');
    }

    editEmployee(employeeId) {
        const employee = this.employees.find(e => e.id === employeeId);
        if (!employee) return;

        this.editingEmployee = employee;
        document.getElementById('employeeModalTitle').textContent = '社員編集';
        document.getElementById('employeeName').value = employee.name;
        document.getElementById('employeeRole').value = employee.role;
        document.getElementById('employeeEmail').value = employee.email || '';
        this.showModal('employeeModal');
    }

    saveEmployee() {
        const name = document.getElementById('employeeName').value.trim();
        const role = document.getElementById('employeeRole').value;
        const email = document.getElementById('employeeEmail').value.trim();

        if (!name) {
            this.showToast('氏名は必須です', 'error');
            return;
        }

        if (this.editingEmployee) {
            // 編集
            this.editingEmployee.name = name;
            this.editingEmployee.role = role;
            this.editingEmployee.email = email;
            this.showToast('社員情報を更新しました');
        } else {
            // 新規追加
            const newEmployee = {
                id: Math.max(...this.employees.map(e => e.id)) + 1,
                name,
                role,
                email
            };
            this.employees.push(newEmployee);
            this.showToast('社員を追加しました');
        }

        this.saveEmployees();
        this.renderEmployeeList();
        this.renderShiftTable();
        this.updateStats();
        this.closeModal('employeeModal');
    }

    deleteEmployee(employeeId) {
        if (confirm('この社員を削除しますか？関連するシフトデータも削除されます。')) {
            // 社員データの削除
            this.employees = this.employees.filter(e => e.id !== employeeId);

            // 関連するシフトデータの削除
            Object.keys(this.shiftData).forEach(key => {
                if (this.shiftData[key].employeeId === employeeId) {
                    delete this.shiftData[key];
                }
            });

            this.saveEmployees();
            this.saveShiftData();
            this.renderEmployeeList();
            this.renderShiftTable();
            this.updateStats();
            this.showToast('社員を削除しました');
        }
    }

    // ナビゲーションメソッド
    previousMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() - 1);
        this.updateCurrentMonthDisplay();
        this.renderShiftTable();
        this.updateStats();
    }

    nextMonth() {
        this.currentDate.setMonth(this.currentDate.getMonth() + 1);
        this.updateCurrentMonthDisplay();
        this.renderShiftTable();
        this.updateStats();
    }

    toggleView() {
        this.viewMode = this.viewMode === 'month' ? 'week' : 'month';
        document.querySelector('.controls button').innerHTML =
            this.viewMode === 'month' ?
            '<i class="fas fa-calendar-week"></i> 週表示' :
            '<i class="fas fa-calendar-alt"></i> 月表示';
        this.renderShiftTable();
    }

    // データ管理メソッド
    saveEmployees() {
        localStorage.setItem('practical_shift_employees', JSON.stringify(this.employees));
    }

    saveShiftData() {
        localStorage.setItem('practical_shift_data', JSON.stringify(this.shiftData));
    }

    saveData() {
        this.saveEmployees();
        this.saveShiftData();
        this.showToast('データを保存しました');
    }

    exportData() {
        const data = {
            employees: this.employees,
            shiftData: this.shiftData,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `shift-data-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);

        this.showToast('データをエクスポートしました');
    }

    importData() {
        document.getElementById('fileInput').click();
    }

    handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);

                if (data.employees && data.shiftData) {
                    if (confirm('現在のデータを上書きしますか？')) {
                        this.employees = data.employees;
                        this.shiftData = data.shiftData;

                        this.saveEmployees();
                        this.saveShiftData();
                        this.renderEmployeeList();
                        this.renderShiftTable();
                        this.updateStats();

                        this.showToast('データをインポートしました');
                    }
                } else {
                    this.showToast('無効なファイル形式です', 'error');
                }
            } catch (error) {
                this.showToast('ファイルの読み込みに失敗しました', 'error');
            }
        };
        reader.readAsText(file);
    }

    // タッチイベントハンドラー
    touchStart(event) {
        if (!this.isTouchDevice) return;

        event.preventDefault();
        const touch = event.touches[0];
        this.touchStartPos = {
            x: touch.clientX,
            y: touch.clientY,
            target: event.target
        };

        // 長押し検出
        this.longPressTimer = setTimeout(() => {
            this.showShiftSelectionMenu(event.target);
        }, 500);
    }

    touchMove(event) {
        if (!this.isTouchDevice || !this.touchStartPos) return;

        const touch = event.touches[0];
        const deltaX = Math.abs(touch.clientX - this.touchStartPos.x);
        const deltaY = Math.abs(touch.clientY - this.touchStartPos.y);

        // タッチ移動があった場合は長押しをキャンセル
        if (deltaX > 10 || deltaY > 10) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    }

    touchEnd(event) {
        if (!this.isTouchDevice) return;

        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
        this.touchStartPos = null;
    }

    patternTouchStart(event) {
        if (!this.isTouchDevice) return;

        event.preventDefault();
        const touch = event.touches[0];
        this.touchStartPos = {
            x: touch.clientX,
            y: touch.clientY,
            target: event.target,
            patternId: event.target.dataset.patternId
        };

        // パターンの選択状態を表示
        event.target.style.transform = 'scale(1.1)';
        event.target.style.zIndex = '1000';
    }

    patternTouchMove(event) {
        if (!this.isTouchDevice || !this.touchStartPos) return;

        event.preventDefault();
        const touch = event.touches[0];

        // ドラッグ中の視覚フィードバック
        const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);

        // 既存のハイライトを削除
        document.querySelectorAll('.day-cell').forEach(cell => {
            cell.classList.remove('drag-over');
        });

        // 新しいハイライトを追加
        if (elementUnderTouch && elementUnderTouch.classList.contains('day-cell')) {
            elementUnderTouch.classList.add('drag-over');
        }
    }

    patternTouchEnd(event) {
        if (!this.isTouchDevice || !this.touchStartPos) return;

        event.preventDefault();
        const touch = event.changedTouches[0];

        // パターンの見た目を元に戻す
        event.target.style.transform = '';
        event.target.style.zIndex = '';

        // ハイライトを削除
        document.querySelectorAll('.day-cell').forEach(cell => {
            cell.classList.remove('drag-over');
        });

        // タッチ終了位置の要素を取得
        const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);

        if (elementUnderTouch && elementUnderTouch.classList.contains('day-cell')) {
            const employeeId = parseInt(elementUnderTouch.dataset.employeeId);
            const date = elementUnderTouch.dataset.date;
            const patternId = this.touchStartPos.patternId;

            if (employeeId && date && patternId) {
                this.assignShift(employeeId, date, patternId);
            }
        }

        this.touchStartPos = null;
    }

    /**
     * シフト選択メニューの表示（モバイル専用）
     */
    showShiftSelectionMenu(cell) {
        const employeeId = parseInt(cell.dataset.employeeId);
        const date = cell.dataset.date;
        const employee = this.employees.find(e => e.id === employeeId);

        if (!employee) return;

        const menu = document.createElement('div');
        menu.className = 'mobile-shift-menu';
        menu.innerHTML = `
            <div class="mobile-menu-header">
                ${employee.name} - ${date}
                <button class="mobile-menu-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <div class="mobile-menu-content">
                ${this.shiftPatterns.map(pattern => `
                    <button class="mobile-pattern-btn ${pattern.color}"
                            onclick="shiftManager.assignShift(${employeeId}, '${date}', '${pattern.id}'); this.parentElement.parentElement.remove();">
                        <i class="${pattern.icon}"></i>
                        ${pattern.name}
                        <small>${pattern.time}</small>
                    </button>
                `).join('')}
                <button class="mobile-pattern-btn mobile-remove-btn"
                        onclick="shiftManager.removeShift(${employeeId}, '${date}'); this.parentElement.parentElement.remove();">
                    <i class="fas fa-trash"></i>
                    削除
                </button>
            </div>
        `;

        // スタイルを追加
        const style = document.createElement('style');
        style.textContent = `
            .mobile-shift-menu {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                z-index: 1001;
                padding: 20px;
                max-width: 300px;
                width: 90vw;
            }
            .mobile-menu-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                font-weight: bold;
                color: #4a5568;
            }
            .mobile-menu-close {
                background: none;
                border: none;
                font-size: 20px;
                color: #a0aec0;
                cursor: pointer;
            }
            .mobile-menu-content {
                display: grid;
                gap: 10px;
            }
            .mobile-pattern-btn {
                padding: 12px;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                text-align: center;
                font-size: 14px;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 5px;
                min-height: 60px;
                justify-content: center;
            }
            .mobile-remove-btn {
                background: #fed7d7;
                color: #c53030;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(menu);
    }

    // UI ユーティリティメソッド
    showModal(modalId) {
        document.getElementById(modalId).style.display = 'flex';
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const messageEl = document.getElementById('toastMessage');

        messageEl.textContent = message;
        toast.className = `toast ${type} show`;

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// グローバルインスタンスの作成
let shiftManager;

// DOM読み込み完了後に初期化
document.addEventListener('DOMContentLoaded', () => {
    shiftManager = new PracticalShiftManager();
});

// グローバル関数（HTMLから呼び出し用）
function previousMonth() { shiftManager.previousMonth(); }
function nextMonth() { shiftManager.nextMonth(); }
function toggleView() { shiftManager.toggleView(); }
function addEmployee() { shiftManager.addEmployee(); }
function saveData() { shiftManager.saveData(); }
function exportData() { shiftManager.exportData(); }
function importData() { shiftManager.importData(); }
function closeModal(modalId) { shiftManager.closeModal(modalId); }