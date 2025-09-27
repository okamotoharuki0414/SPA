/**
 * ScrollTable式シフト管理システム
 * エンタープライズレベルの業務システムとして設計
 * 本来のPHPバックエンドシステムのフロントエンド機能を再現
 */
class ScrollTableShiftManager {
    constructor() {
        // 基本設定
        this.currentDate = new Date();
        this.defCWidth = 70;
        this.defCHeight = 40;
        this.cellNum = 31;
        this.tableWidth = 0;
        this.nFirst = false;

        // データストレージ
        this.employees = [];
        this.shiftData = {};
        this.shiftPatterns = [];
        this.dayList = [];

        // UI状態
        this.selectedPattern = null;
        this.editingCell = null;

        // ドラッグ&ドロップ
        this.draggedElement = null;
        this.draggedData = null;

        // 初期化フラグ
        this.initialized = false;

        // デバッグ設定
        this.debug = true;
        this.debS = "";
    }

    /**
     * システム初期化
     */
    init() {
        this.deb(0, "ScrollTableシフト管理システム初期化開始");

        try {
            // データ初期化
            this.initData();

            // UI初期化
            this.initUI();

            // イベントリスナー設定
            this.setupEventListeners();

            // テーブル構築
            this.buildTable();

            // レイアウト調整
            this.resize();

            this.initialized = true;
            this.deb(-1, "ScrollTableシフト管理システム初期化完了");

        } catch (error) {
            console.error('初期化エラー:', error);
            alert('システムの初期化に失敗しました: ' + error.message);
        }
    }

    /**
     * データ初期化
     */
    initData() {
        this.deb(1, "データ初期化");

        // 社員データ読み込み
        this.employees = this.loadEmployees();

        // シフトデータ読み込み
        this.shiftData = this.loadShiftData();

        // シフトパターン初期化
        this.shiftPatterns = this.initShiftPatterns();

        // 日付リスト作成
        this.generateDayList();

        this.deb(-1, "データ初期化完了");
    }

    /**
     * 社員データ読み込み
     */
    loadEmployees() {
        const saved = localStorage.getItem('scrolltable_employees');
        if (saved) {
            return JSON.parse(saved);
        }

        // デフォルト社員データ
        return [
            { id: 1, name: '田中 太郎', role: '正社員', email: 'tanaka@company.com' },
            { id: 2, name: '佐藤 花子', role: 'パート', email: 'sato@company.com' },
            { id: 3, name: '山田 次郎', role: 'アルバイト', email: 'yamada@company.com' },
            { id: 4, name: '鈴木 美咲', role: '正社員', email: 'suzuki@company.com' },
            { id: 5, name: '高橋 健太', role: 'パート', email: 'takahashi@company.com' }
        ];
    }

    /**
     * シフトデータ読み込み
     */
    loadShiftData() {
        const saved = localStorage.getItem('scrolltable_shift_data');
        if (saved) {
            return JSON.parse(saved);
        }
        return {};
    }

    /**
     * シフトパターン初期化
     */
    initShiftPatterns() {
        return [
            {
                id: 1,
                name: '早番',
                shortName: '早',
                timeFrom: '06:00',
                timeTo: '15:00',
                color: '#e6fffa',
                textColor: '#00695c',
                class: 'shift-early'
            },
            {
                id: 2,
                name: '遅番',
                shortName: '遅',
                timeFrom: '13:00',
                timeTo: '22:00',
                color: '#ffeaa7',
                textColor: '#e17055',
                class: 'shift-late'
            },
            {
                id: 3,
                name: '夜勤',
                shortName: '夜',
                timeFrom: '22:00',
                timeTo: '06:00',
                color: '#a29bfe',
                textColor: '#ffffff',
                class: 'shift-night'
            },
            {
                id: 4,
                name: '休み',
                shortName: '休',
                timeFrom: '',
                timeTo: '',
                color: '#ddd6fe',
                textColor: '#7c3aed',
                class: 'shift-off'
            }
        ];
    }

    /**
     * 日付リスト生成
     */
    generateDayList() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        this.dayList = [];
        this.cellNum = daysInMonth;

        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dayOfWeek = date.getDay();

            this.dayList.push({
                day: day,
                date: date,
                dayofweek: dayOfWeek,
                dateString: this.formatDate(date),
                isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
                isSunday: dayOfWeek === 0,
                isSaturday: dayOfWeek === 6,
                dummy: false
            });
        }
    }

    /**
     * UI初期化
     */
    initUI() {
        this.deb(1, "UI初期化");

        // 現在月表示更新
        this.updateCurrentMonthDisplay();

        // 勤務パターンリスト表示
        this.renderShiftPatterns();

        // 社員リスト表示
        this.renderEmployeeList();

        this.deb(-1, "UI初期化完了");
    }

    /**
     * 現在月表示更新
     */
    updateCurrentMonthDisplay() {
        const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月',
                           '7月', '8月', '9月', '10月', '11月', '12月'];
        const monthDisplay = `${this.currentDate.getFullYear()}年${monthNames[this.currentDate.getMonth()]}`;

        document.getElementById('currentMonth').textContent = monthDisplay;

        const monthHeader = document.getElementById('monthHeader');
        if (monthHeader) {
            monthHeader.textContent = monthDisplay;
            monthHeader.colSpan = this.cellNum;
        }
    }

    /**
     * シフトパターンリスト表示
     */
    renderShiftPatterns() {
        const container = document.getElementById('kinmuPatternList');
        if (!container) return;

        // 既存の勤務パターン行を削除（ヘッダー以外）
        const existingRows = container.querySelectorAll('tr:not(.unsortable)');
        existingRows.forEach(row => row.remove());

        this.shiftPatterns.forEach(pattern => {
            const row = document.createElement('tr');
            row.className = 'sortedKinmupattern';
            row.setAttribute('data-mastid', pattern.id);

            const timeDisplay = pattern.timeFrom && pattern.timeTo
                ? `${pattern.timeFrom}～${pattern.timeTo}`
                : '時間指定なし';

            row.innerHTML = `
                <td style="width: 5px;">
                    <input type="radio" class="kinmu-pattern-select" name="kinmu-pattern-select"
                           value="${pattern.id}" data-type="kinmu-pattern"
                           data-name="${pattern.shortName}"
                           data-time-from="${pattern.timeFrom}"
                           data-time-to="${pattern.timeTo}"
                           data-color="${pattern.color}"
                           data-class="${pattern.class}">
                </td>
                <td style="width: 5px; background-color: ${pattern.color};"></td>
                <td style="width: 60px;">${pattern.name}</td>
                <td style="width: 100px;">${timeDisplay}</td>
            `;

            container.appendChild(row);
        });
    }

    /**
     * 社員リスト表示
     */
    renderEmployeeList() {
        const container = document.getElementById('employeeList');
        if (!container) return;

        container.innerHTML = '';

        this.employees.forEach(employee => {
            const item = document.createElement('div');
            item.className = 'employee-item';
            item.innerHTML = `
                <div class="employee-info">
                    <div class="employee-name">${employee.name}</div>
                    <div class="employee-role">${employee.role}</div>
                </div>
                <div class="employee-actions">
                    <button class="btn-edit" onclick="editEmployee(${employee.id})" title="編集">✏️</button>
                    <button class="btn-delete" onclick="deleteEmployee(${employee.id})" title="削除">🗑️</button>
                </div>
            `;
            container.appendChild(item);
        });
    }

    /**
     * テーブル構築
     */
    buildTable() {
        this.deb(1, "テーブル構築");

        this.buildTableHeader();
        this.buildTableBody();
        this.buildTableFooter();

        this.deb(-1, "テーブル構築完了");
    }

    /**
     * テーブルヘッダー構築
     */
    buildTableHeader() {
        const thead = document.getElementById('scrollee_thead');
        const dateRow = thead.querySelector('tr.row-h3');

        // 既存の日付セルを削除
        const existingCells = dateRow.querySelectorAll('th:not(.left-fix)');
        existingCells.forEach(cell => cell.remove());

        // 日付セルを追加
        this.dayList.forEach((day, index) => {
            const th = document.createElement('th');
            th.className = `center-separate ${day.isSunday ? 'yobi-0' : ''} ${day.isSaturday ? 'yobi-6' : ''}`;
            th.style.width = this.defCWidth + 'px';
            th.setAttribute('hiduke', this.formatDateForAttribute(day.date));
            th.innerHTML = `
                <input class="ck-day" type="checkbox" data-day="${this.formatDateForAttribute(day.date)}">
                <span class="hidukeCell ${day.isSunday || day.isSaturday ? 'yobi-s' : ''} yobi-${day.dayofweek}">
                    ${day.day}<br>${this.getDayOfWeekName(day.dayofweek)}
                </span>
            `;
            dateRow.appendChild(th);
        });
    }

    /**
     * テーブルボディ構築
     */
    buildTableBody() {
        const tbody = document.getElementById('scrollee_body');
        tbody.innerHTML = '';

        this.employees.forEach((employee, empIndex) => {
            const row = document.createElement('tr');
            row.className = `data-row line${empIndex % 2}`;
            row.setAttribute('data-employee-id', employee.id);

            // 社員名セル
            const nameCell = document.createElement('td');
            nameCell.className = 'tbl_d_th left-fix col-title';
            nameCell.innerHTML = `
                <div class="line-name">${employee.name}</div>
                <div class="line-name-time">${employee.role}</div>
            `;
            row.appendChild(nameCell);

            // 日付セル
            this.dayList.forEach(day => {
                const cell = document.createElement('td');
                cell.className = `center-separate day-cell ${day.isSunday ? 'yobi-0' : ''} ${day.isSaturday ? 'yobi-6' : ''}`;
                cell.style.width = this.defCWidth + 'px';
                cell.setAttribute('data-employee-id', employee.id);
                cell.setAttribute('data-date', this.formatDateForAttribute(day.date));

                // 既存のシフトデータがあれば表示
                const shiftKey = `${employee.id}_${this.formatDateForAttribute(day.date)}`;
                const existingShift = this.shiftData[shiftKey];
                if (existingShift) {
                    const pattern = this.shiftPatterns.find(p => p.id == existingShift.patternId);
                    if (pattern) {
                        cell.innerHTML = `<div class="shift-pattern ${pattern.class}">${pattern.shortName}</div>`;
                    }
                }

                row.appendChild(cell);
            });

            tbody.appendChild(row);
        });
    }

    /**
     * テーブルフッター構築
     */
    buildTableFooter() {
        const tfoot = document.getElementById('scrollee_tfoot');
        const rows = tfoot.querySelectorAll('tr.summ_tr');

        rows.forEach(row => {
            // 既存のセルを削除（タイトルセル以外）
            const existingCells = row.querySelectorAll('td:not(.left-fix)');
            existingCells.forEach(cell => cell.remove());

            // 集計セルを追加
            this.dayList.forEach(day => {
                const cell = document.createElement('td');
                cell.className = `top_summary_w col-data right center-separate ${day.isSunday ? 'yobi-0' : ''} ${day.isSaturday ? 'yobi-6' : ''}`;
                cell.style.width = this.defCWidth + 'px';
                cell.textContent = '0'; // 後で計算結果を設定
                row.appendChild(cell);
            });
        });
    }

    /**
     * イベントリスナー設定
     */
    setupEventListeners() {
        this.deb(1, "イベントリスナー設定");

        // 勤務パターン選択
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('kinmu-pattern-select')) {
                this.selectPattern(e.target);
            }
        });

        // セルクリック
        document.addEventListener('click', (e) => {
            if (e.target.closest('.day-cell')) {
                this.handleCellClick(e.target.closest('.day-cell'));
            }
        });

        // 社員フォーム送信
        const employeeForm = document.getElementById('employeeForm');
        if (employeeForm) {
            employeeForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveEmployee();
            });
        }

        // ファイルインポート
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleFileImport(e);
            });
        }

        // ウィンドウリサイズ
        window.addEventListener('resize', () => {
            this.resize();
        });

        this.deb(-1, "イベントリスナー設定完了");
    }

    /**
     * 勤務パターン選択処理
     */
    selectPattern(radio) {
        if (radio.checked) {
            const patternType = radio.getAttribute('data-type');

            if (patternType === 'kaijo') {
                this.selectedPattern = null;
                this.deb(0, "選択解除");
            } else if (patternType === 'kinmu-pattern') {
                const patternId = parseInt(radio.value);
                this.selectedPattern = this.shiftPatterns.find(p => p.id === patternId);
                this.deb(0, `パターン選択: ${this.selectedPattern ? this.selectedPattern.name : 'なし'}`);
            }
        }
    }

    /**
     * セルクリック処理
     */
    handleCellClick(cell) {
        const employeeId = parseInt(cell.getAttribute('data-employee-id'));
        const dateStr = cell.getAttribute('data-date');

        if (this.selectedPattern) {
            // シフト設定
            this.setShift(employeeId, dateStr, this.selectedPattern);
        } else {
            // シフト削除
            this.removeShift(employeeId, dateStr);
        }

        this.updateCell(cell, employeeId, dateStr);
        this.calculateSummary();
        this.saveData();
    }

    /**
     * シフト設定
     */
    setShift(employeeId, dateStr, pattern) {
        const shiftKey = `${employeeId}_${dateStr}`;
        this.shiftData[shiftKey] = {
            employeeId: employeeId,
            date: dateStr,
            patternId: pattern.id,
            patternName: pattern.name,
            timeFrom: pattern.timeFrom,
            timeTo: pattern.timeTo
        };

        this.deb(0, `シフト設定: 社員${employeeId}, 日付${dateStr}, パターン${pattern.name}`);
    }

    /**
     * シフト削除
     */
    removeShift(employeeId, dateStr) {
        const shiftKey = `${employeeId}_${dateStr}`;
        delete this.shiftData[shiftKey];

        this.deb(0, `シフト削除: 社員${employeeId}, 日付${dateStr}`);
    }

    /**
     * セル更新
     */
    updateCell(cell, employeeId, dateStr) {
        const shiftKey = `${employeeId}_${dateStr}`;
        const shift = this.shiftData[shiftKey];

        if (shift) {
            const pattern = this.shiftPatterns.find(p => p.id === shift.patternId);
            if (pattern) {
                cell.innerHTML = `<div class="shift-pattern ${pattern.class}">${pattern.shortName}</div>`;
            }
        } else {
            cell.innerHTML = '';
        }
    }

    /**
     * 集計計算
     */
    calculateSummary() {
        const tfoot = document.getElementById('scrollee_tfoot');
        const summaryRows = tfoot.querySelectorAll('tr.summ_tr');

        if (summaryRows.length < 3) return;

        const requiredRow = summaryRows[0]; // 必要人時
        const actualRow = summaryRows[1];   // 投入人時
        const diffRow = summaryRows[2];     // 差異

        this.dayList.forEach((day, dayIndex) => {
            const dateStr = this.formatDateForAttribute(day.date);

            // 投入人時計算（その日に勤務予定の人数）
            let actualHours = 0;
            this.employees.forEach(employee => {
                const shiftKey = `${employee.id}_${dateStr}`;
                const shift = this.shiftData[shiftKey];
                if (shift && shift.patternId !== 4) { // 休み以外
                    actualHours += 8; // 8時間労働として計算
                }
            });

            // 必要人時（仮の値）
            const requiredHours = this.employees.length * 6; // 平均6時間として計算

            // 差異計算
            const difference = actualHours - requiredHours;

            // セル更新
            const requiredCell = requiredRow.children[dayIndex + 1];
            const actualCell = actualRow.children[dayIndex + 1];
            const diffCell = diffRow.children[dayIndex + 1];

            if (requiredCell) requiredCell.textContent = requiredHours;
            if (actualCell) actualCell.textContent = actualHours;
            if (diffCell) {
                diffCell.textContent = difference;
                diffCell.style.color = difference > 0 ? '#c53030' : difference < 0 ? '#3182ce' : '#333';
            }
        });
    }

    /**
     * レイアウト調整
     */
    resize() {
        if (!this.initialized) return;

        const windowWidth = window.innerWidth;
        this.getCellSize(windowWidth);

        // テーブル幅調整
        const mainTableWidth = 130 + (this.defCWidth * this.cellNum);
        this.tableWidth = mainTableWidth;

        const fixer = document.querySelector('.fixer');
        if (fixer) {
            fixer.style.width = mainTableWidth + 'px';
        }

        // セル幅調整
        const cells = document.querySelectorAll('.center-separate, .center-first');
        cells.forEach(cell => {
            cell.style.width = this.defCWidth + 'px';
        });

        this.deb(0, `リサイズ: 幅${windowWidth}px, セル幅${this.defCWidth}px`);
    }

    /**
     * セルサイズ計算
     */
    getCellSize(windowWidth) {
        const cellsSize = windowWidth - 350; // サイドパネル分を除く
        const tempCellSize = cellsSize / this.cellNum;
        this.defCWidth = Math.max(30, Math.min(100, Math.ceil(tempCellSize)));
        this.nFirst = true;
    }

    /**
     * カレンダー更新
     */
    updateCalendar() {
        this.generateDayList();
        this.updateCurrentMonthDisplay();
        this.buildTable();
        this.resize();
        this.calculateSummary();
    }

    /**
     * 社員追加
     */
    addEmployee() {
        document.getElementById('employeeModalTitle').textContent = '社員追加';
        document.getElementById('employeeForm').reset();
        document.getElementById('employeeModal').style.display = 'flex';
    }

    /**
     * 社員保存
     */
    saveEmployee() {
        const name = document.getElementById('employeeName').value;
        const role = document.getElementById('employeeRole').value;
        const email = document.getElementById('employeeEmail').value;

        if (!name) {
            alert('氏名を入力してください');
            return;
        }

        const newEmployee = {
            id: Date.now(), // 簡易ID生成
            name: name,
            role: role,
            email: email
        };

        this.employees.push(newEmployee);
        this.saveData();
        this.renderEmployeeList();
        this.buildTableBody();
        this.calculateSummary();

        document.getElementById('employeeModal').style.display = 'none';
        alert('社員を追加しました');
    }

    /**
     * データ保存
     */
    saveData() {
        try {
            localStorage.setItem('scrolltable_employees', JSON.stringify(this.employees));
            localStorage.setItem('scrolltable_shift_data', JSON.stringify(this.shiftData));
            this.deb(0, "データ保存完了");
        } catch (error) {
            console.error('データ保存エラー:', error);
            alert('データの保存に失敗しました');
        }
    }

    /**
     * データエクスポート
     */
    exportData() {
        const exportData = {
            employees: this.employees,
            shiftData: this.shiftData,
            exportDate: new Date().toISOString()
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `shift_data_${this.formatDate(new Date())}.json`;
        link.click();

        this.deb(0, "データエクスポート完了");
    }

    /**
     * ファイルインポート処理
     */
    handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);

                if (data.employees && data.shiftData) {
                    this.employees = data.employees;
                    this.shiftData = data.shiftData;

                    this.saveData();
                    this.renderEmployeeList();
                    this.buildTable();
                    this.calculateSummary();

                    alert('データのインポートが完了しました');
                    this.deb(0, "データインポート完了");
                } else {
                    alert('不正なファイル形式です');
                }
            } catch (error) {
                console.error('インポートエラー:', error);
                alert('ファイルの読み込みに失敗しました');
            }
        };
        reader.readAsText(file);
    }

    /**
     * ユーティリティ関数群
     */

    /**
     * 日付フォーマット
     */
    formatDate(date) {
        return date.getFullYear() + '-' +
               String(date.getMonth() + 1).padStart(2, '0') + '-' +
               String(date.getDate()).padStart(2, '0');
    }

    /**
     * 日付属性用フォーマット
     */
    formatDateForAttribute(date) {
        return date.getFullYear() +
               String(date.getMonth() + 1).padStart(2, '0') +
               String(date.getDate()).padStart(2, '0');
    }

    /**
     * 曜日名取得
     */
    getDayOfWeekName(dayOfWeek) {
        const names = ['日', '月', '火', '水', '木', '金', '土'];
        return names[dayOfWeek];
    }

    /**
     * デバッグ出力
     */
    deb(level, message) {
        if (!this.debug) return;

        if (level > 0) {
            this.debS += "  ";
            console.log(this.debS + message);
        } else if (level < 0) {
            console.log(this.debS + message);
            this.debS = this.debS.substr(0, this.debS.length - 2);
        } else {
            console.log(this.debS + message);
        }
    }
}

// グローバル関数（HTML側から呼び出し用）
function editEmployee(employeeId) {
    // 社員編集機能（実装簡略化）
    const employee = shiftManager.employees.find(e => e.id === employeeId);
    if (employee) {
        document.getElementById('employeeModalTitle').textContent = '社員編集';
        document.getElementById('employeeName').value = employee.name;
        document.getElementById('employeeRole').value = employee.role;
        document.getElementById('employeeEmail').value = employee.email;
        document.getElementById('employeeModal').style.display = 'flex';
    }
}

function deleteEmployee(employeeId) {
    if (confirm('この社員を削除しますか？')) {
        const index = shiftManager.employees.findIndex(e => e.id === employeeId);
        if (index !== -1) {
            shiftManager.employees.splice(index, 1);

            // 関連するシフトデータも削除
            Object.keys(shiftManager.shiftData).forEach(key => {
                if (key.startsWith(employeeId + '_')) {
                    delete shiftManager.shiftData[key];
                }
            });

            shiftManager.saveData();
            shiftManager.renderEmployeeList();
            shiftManager.buildTableBody();
            shiftManager.calculateSummary();

            alert('社員を削除しました');
        }
    }
}

// CSS追加でScrollTable専用スタイルを補完
document.addEventListener('DOMContentLoaded', function() {
    const additionalStyles = `
        .sortedKinmupattern:hover {
            background-color: #f0f0f0;
        }

        .kinmu-pattern-select:checked + * {
            font-weight: bold;
        }

        .day-cell:hover {
            background-color: #e6f3ff !important;
            cursor: pointer;
        }

        .shift-pattern:hover {
            transform: scale(1.05);
            z-index: 5;
        }

        .employee-item:hover {
            background-color: #f7fafc;
        }

        .btn-edit, .btn-delete {
            width: 30px;
            height: 30px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }

        .btn-edit {
            background: #e6fffa;
            color: #00695c;
        }

        .btn-delete {
            background: #fed7d7;
            color: #c53030;
        }

        .modal {
            align-items: center;
            justify-content: center;
        }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.textContent = additionalStyles;
    document.head.appendChild(styleSheet);
});