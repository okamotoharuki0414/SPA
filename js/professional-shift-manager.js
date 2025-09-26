/**
 * Professional Shift Manager - Advanced SPA Integration
 * Integrates with existing ScrollTable system while adding real-time SSE capabilities
 * Maintains all existing functionality: drag-and-drop, pattern selection, validation, etc.
 *
 * 本格的なシフト管理システムのSPA化
 * 既存のScrollTableシステムと統合し、リアルタイムSSE機能を追加
 * 既存の全機能を維持：ドラッグ&ドロップ、パターン選択、バリデーション等
 */
class ProfessionalShiftManager {
    constructor(worksetId, config = {}) {
        this.worksetId = worksetId;
        this.config = {
            apiBase: '/shift-spa',
            ssePort: 3001,
            defaultCellHeight: 95,
            patternCellHeight: 40,
            defaultCellWidth: 100,
            patternCellWidth: 55,
            maxRetries: 5,
            retryDelay: 3000,
            ...config
        };

        // State management
        this.state = {
            displayType: 'time', // 'time' or 'name'
            showActual: true,
            isConnected: false,
            isLoading: false,
            selectedCells: new Set(),
            selectedPattern: null,
            undoStack: [],
            redoStack: []
        };

        // Data storage
        this.data = {
            dayList: [],
            employeeList: [],
            shiftMatrix: {},
            kinmuPatterns: [],
            summaryData: {},
            alerts: {}
        };

        // Event handlers storage
        this.eventHandlers = new Map();

        // SSE connection
        this.eventSource = null;
        this.retryCount = 0;

        // Initialize
        this.init();
    }

    /**
     * Initialize the Professional Shift Manager
     */
    async init() {
        try {
            this.showLoading(true);

            // Load initial data
            await this.loadShiftData();

            // Setup SSE connection
            this.setupSSE();

            // Initialize ScrollTable integration
            this.initializeScrollTableIntegration();

            // Setup event handlers
            this.setupEventHandlers();

            // Setup drag and drop
            this.setupDragAndDrop();

            // Setup pattern selection
            this.setupPatternSelection();

            // Initialize validation system
            this.initializeValidation();

            // Setup keyboard shortcuts
            this.setupKeyboardShortcuts();

            console.log('Professional Shift Manager initialized successfully');
            this.showMessage('Shift management system loaded', 'success');

        } catch (error) {
            console.error('Initialization error:', error);
            this.showMessage('Failed to initialize shift management system', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Load comprehensive shift data from API
     */
    async loadShiftData() {
        try {
            const params = new URLSearchParams({
                workset_id: this.worksetId,
                display_type: this.state.displayType,
                show_actual: this.state.showActual ? '1' : '0'
            });

            const response = await fetch(`${this.config.apiBase}/shift-data?${params}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to load shift data');
            }

            // Store data
            this.data = result.data;

            // Update UI
            this.updateScrollTable();
            this.updatePatternPanel();
            this.updateSummaryPanel();
            this.updateAlerts();

            return result.data;

        } catch (error) {
            console.error('Load shift data error:', error);
            throw error;
        }
    }

    /**
     * Setup Server-Sent Events connection for real-time updates
     */
    setupSSE() {
        if (this.eventSource) {
            this.eventSource.close();
        }

        try {
            const sseUrl = `http://localhost:${this.config.ssePort}/sse/${this.worksetId}`;
            console.log('Connecting to SSE:', sseUrl);

            this.eventSource = new EventSource(sseUrl);

            this.eventSource.onopen = () => {
                console.log('SSE connection opened');
                this.state.isConnected = true;
                this.retryCount = 0;
                this.updateConnectionStatus(true);
                this.showMessage('Real-time connection established', 'info');
            };

            this.eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleSSEMessage(data);
                } catch (error) {
                    console.error('Error parsing SSE message:', error);
                }
            };

            this.eventSource.onerror = (error) => {
                console.error('SSE connection error:', error);
                this.state.isConnected = false;
                this.updateConnectionStatus(false);
                this.handleSSEReconnect();
            };

        } catch (error) {
            console.error('SSE setup error:', error);
            this.scheduleSSEReconnect();
        }
    }

    /**
     * Handle SSE messages with proper data type routing
     */
    handleSSEMessage(data) {
        console.log('SSE message received:', data);

        switch (data.type) {
            case 'connected':
                this.showMessage(data.message || 'Connected to real-time updates', 'success');
                break;

            case 'redis_update':
                this.handleRedisUpdate(data);
                break;

            case 'shift_updated':
                this.handleShiftUpdate(data.data);
                break;

            case 'pattern_updated':
                this.handlePatternUpdate(data.data);
                break;

            case 'heartbeat':
                // Keep connection alive
                break;

            default:
                console.log('Unknown SSE message type:', data.type);
        }
    }

    /**
     * Handle Redis updates from the existing notification system
     */
    handleRedisUpdate(data) {
        const { channel, data: payload } = data;

        switch (channel) {
            case 'shift_updated':
                this.handleShiftUpdate(payload);
                break;

            case 'kinmupattern_updated':
                this.handlePatternUpdate(payload);
                break;

            case 'task_updated':
                this.handleTaskUpdate(payload);
                break;

            default:
                console.log('Unknown Redis channel:', channel);
        }
    }

    /**
     * Handle shift updates from SSE
     */
    handleShiftUpdate(data) {
        const { workset_id, syain_id, hiduke, operation, shift_data } = data;

        // Only process updates for our workset
        if (workset_id != this.worksetId) {
            return;
        }

        console.log('Processing shift update:', data);

        if (operation === 'DELETE') {
            this.removeShiftFromMatrix(syain_id, hiduke);
        } else {
            this.updateShiftInMatrix(syain_id, hiduke, shift_data);
        }

        // Update the specific cell in ScrollTable
        this.updateShiftCell(syain_id, hiduke);

        // Recalculate summaries
        this.recalculateSummaries(syain_id, hiduke);

        // Update alerts
        this.updateAlertsForShift(syain_id, hiduke);

        // Highlight the updated cell
        this.highlightUpdatedCell(syain_id, hiduke);

        this.showMessage('Shift updated by another user', 'info');
    }

    /**
     * Initialize ScrollTable integration with existing system
     */
    initializeScrollTableIntegration() {
        // Wait for existing ScrollTable to be available
        if (typeof window.mainTable === 'undefined') {
            setTimeout(() => this.initializeScrollTableIntegration(), 100);
            return;
        }

        // Extend existing ScrollTable functionality
        this.scrollTable = window.mainTable;

        // Override existing cell click handler to integrate with SPA
        const originalDataCellClick = window.mainTableDatacellClick;

        window.mainTableDatacellClick = (event) => {
            // Call SPA cell click handler first
            if (this.handleCellClick(event)) {
                return; // SPA handled the event
            }

            // Fall back to original handler if needed
            if (originalDataCellClick) {
                originalDataCellClick.call(this, event);
            }
        };

        // Override existing data update functions
        this.integrateWithExistingFunctions();
    }

    /**
     * Integrate with existing global functions
     */
    integrateWithExistingFunctions() {
        // Store original functions
        this.originalFunctions = {
            mainTableDataCellClickCtrl: window.mainTableDataCellClickCtrl,
            calcYokokei: window.calcYokokei,
            calcTatekei: window.calcTatekei,
            checkDifference: window.checkDifference,
            getKyukeiAndCost: window.getKyukeiAndCost
        };

        // Enhance existing functions with SPA capabilities
        const self = this;

        // Enhanced cell click control
        window.mainTableDataCellClickCtrl = function() {
            // Call original function
            if (self.originalFunctions.mainTableDataCellClickCtrl) {
                self.originalFunctions.mainTableDataCellClickCtrl.apply(this, arguments);
            }

            // Add SPA enhancements
            self.enhanceCellControls();
        };

        // Enhanced calculation functions with API sync
        window.calcYokokei = function(dataRow) {
            // Call original function
            const result = self.originalFunctions.calcYokokei?.apply(this, arguments);

            // Sync to API if needed
            self.syncCalculationToAPI('yokokei', dataRow);

            return result;
        };
    }

    /**
     * Handle cell clicks with SPA logic
     */
    handleCellClick(event) {
        const cell = $(event.target).closest('.data-cell');
        if (!cell.length) return false;

        const key = cell.attr('data-key');
        if (!key) return false;

        const [syainId, hiduke] = key.split('-');

        // Check if we have a selected pattern
        const selectedPattern = $('.kinmu-pattern-select:checked');
        if (!selectedPattern.length) {
            return false; // Let original handler deal with it
        }

        // Handle pattern application with SPA logic
        return this.applyPatternToCell(parseInt(syainId), hiduke, selectedPattern);
    }

    /**
     * Apply kinmu pattern to cell with API update
     */
    async applyPatternToCell(syainId, hiduke, patternElement) {
        try {
            this.showLoading(true);

            const patternId = parseInt($(patternElement).data('pattern-id'));
            const pattern = this.data.kinmuPatterns.find(p => p.id === patternId);

            if (!pattern) {
                throw new Error('Pattern not found');
            }

            // Prepare shift data
            const shiftData = {
                workset_id: this.worksetId,
                syain_id: syainId,
                hiduke: hiduke,
                pattern_id: patternId,
                kinmu_from: pattern.kinmu_from,
                kinmu_to: pattern.kinmu_to,
                kyukei_jikan: pattern.kyukei_jikan
            };

            // Push to undo stack
            this.pushUndo();

            // Update via API
            await this.updateShiftData(shiftData);

            // Update local data immediately for responsiveness
            this.updateShiftInMatrix(syainId, hiduke, shiftData);
            this.updateShiftCell(syainId, hiduke);

            return true; // Handled by SPA

        } catch (error) {
            console.error('Apply pattern error:', error);
            this.showMessage(`Failed to apply pattern: ${error.message}`, 'error');
            return false;
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Update shift data via API
     */
    async updateShiftData(shiftData) {
        try {
            const response = await fetch(`${this.config.apiBase}/update-shift`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(shiftData)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to update shift data');
            }

            return result.data;

        } catch (error) {
            console.error('Update shift data error:', error);
            throw error;
        }
    }

    /**
     * Bulk update shifts (for pattern application to multiple cells)
     */
    async bulkUpdateShifts(updates) {
        try {
            this.showLoading(true);

            const payload = {
                workset_id: this.worksetId,
                updates: updates
            };

            const response = await fetch(`${this.config.apiBase}/bulk-update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to bulk update shifts');
            }

            // Show summary of results
            const { updated_count, error_count, errors } = result.data;

            if (error_count > 0) {
                console.warn('Bulk update had errors:', errors);
                this.showMessage(`Updated ${updated_count} shifts, ${error_count} errors`, 'warning');
            } else {
                this.showMessage(`Successfully updated ${updated_count} shifts`, 'success');
            }

            return result.data;

        } catch (error) {
            console.error('Bulk update error:', error);
            this.showMessage(`Bulk update failed: ${error.message}`, 'error');
            throw error;
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Setup drag and drop functionality
     */
    setupDragAndDrop() {
        // Integrate with existing drag and drop if available
        if (typeof $ !== 'undefined' && $.fn.sortable) {
            // Enhance existing sortable functionality
            this.enhanceSortable();
        }

        // Add custom drag and drop for shift patterns
        this.setupShiftDragDrop();
    }

    /**
     * Setup pattern selection panel integration
     */
    setupPatternSelection() {
        // Monitor pattern selection changes
        $(document).on('change', '.kinmu-pattern-select', (e) => {
            const selectedPattern = $(e.target);
            this.state.selectedPattern = {
                id: parseInt(selectedPattern.data('pattern-id')),
                element: selectedPattern
            };

            // Update UI to show selection
            this.updatePatternSelectionUI();
        });

        // Add pattern search functionality
        this.setupPatternSearch();
    }

    /**
     * Initialize validation system
     */
    initializeValidation() {
        // Real-time validation as user types
        $(document).on('input', '.jikoku-text', (e) => {
            this.validateTimeInput(e.target);
        });

        // Validation on cell changes
        $(document).on('change', '.data-cell input', (e) => {
            this.validateCell($(e.target).closest('.data-cell'));
        });
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        $(document).on('keydown', (e) => {
            // Ctrl+Z for undo
            if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            }

            // Ctrl+Shift+Z or Ctrl+Y for redo
            if ((e.ctrlKey && e.shiftKey && e.key === 'Z') ||
                (e.ctrlKey && e.key === 'y')) {
                e.preventDefault();
                this.redo();
            }

            // Delete key for clearing cells
            if (e.key === 'Delete' && this.state.selectedCells.size > 0) {
                e.preventDefault();
                this.clearSelectedCells();
            }

            // Escape to clear selection
            if (e.key === 'Escape') {
                this.clearSelection();
            }
        });
    }

    /**
     * Update ScrollTable with new data
     */
    updateScrollTable() {
        if (!this.scrollTable) {
            console.warn('ScrollTable not available');
            return;
        }

        // Update table data while preserving ScrollTable structure
        this.renderShiftMatrix();
        this.updateColumnHeaders();
        this.updateRowHeaders();
    }

    /**
     * Render shift matrix in ScrollTable format
     */
    renderShiftMatrix() {
        const tbody = $('#scrollee_body');
        if (!tbody.length) return;

        // Clear existing data rows (preserve structure)
        tbody.find('.data-row[data-proc]').remove();

        // Render each employee row
        this.data.employeeList.forEach(employee => {
            const row = this.createEmployeeRow(employee);
            tbody.append(row);
        });

        // Re-initialize ScrollTable controls
        if (window.mainTableDataCellClickCtrl) {
            window.mainTableDataCellClickCtrl();
        }
    }

    /**
     * Create employee row with shift cells
     */
    createEmployeeRow(employee) {
        const syainId = employee.syain_id;
        const rowClass = `data-row line${syainId % 2}`;

        let row = $(`
            <tr class="${rowClass}" data-syain-id="${syainId}" data-proc="1" data-row="0">
                <th class="col-title left-fix alert-syain_id-${syainId}">
                    <div class="employee-info">
                        <div class="employee-name">${employee.syain_name}</div>
                        <div class="employee-attr">${employee.zokusei_name}</div>
                    </div>
                </th>
            </tr>
        `);

        // Add shift cells for each day
        this.data.dayList.forEach(day => {
            const hiduke = day.date_string;
            const cell = this.createShiftCell(syainId, hiduke, day);
            row.append(cell);
        });

        return row;
    }

    /**
     * Create individual shift cell
     */
    createShiftCell(syainId, hiduke, dayInfo) {
        const key = `${syainId}-${hiduke}`;
        const shift = this.data.shiftMatrix[syainId]?.[hiduke];
        const dayClass = this.getDayClass(dayInfo);

        const cell = $(`
            <td class="data-col center-separate ${dayClass}" data-day="${hiduke}">
                <div class="data-cell" data-key="${key}" data-syain-id="${syainId}" data-hiduke="${hiduke}">
                    <div class="line-color">${this.getColorBar(shift)}</div>
                    <div class="line-name">
                        <div class="line-name-time">${this.getNameDisplay(shift)}</div>
                        <div class="line-name-name">${this.getPatternName(shift)}</div>
                    </div>
                    <div class="line-shift">
                        ${this.getShiftTimeDisplay(shift)}
                    </div>
                    <div class="line-jisseki">
                        ${this.getActualTimeDisplay(shift)}
                    </div>
                    <div class="line-lock">
                        ${this.getLockDisplay(shift)}
                    </div>
                </div>
            </td>
        `);

        return cell;
    }

    /**
     * Update specific shift cell after data change
     */
    updateShiftCell(syainId, hiduke) {
        const key = `${syainId}-${hiduke}`;
        const cell = $(`.data-cell[data-key="${key}"]`);

        if (!cell.length) return;

        const shift = this.data.shiftMatrix[syainId]?.[hiduke];

        // Update cell contents
        cell.find('.line-color').html(this.getColorBar(shift));
        cell.find('.line-name-time').html(this.getNameDisplay(shift));
        cell.find('.line-name-name').html(this.getPatternName(shift));
        cell.find('.line-shift').html(this.getShiftTimeDisplay(shift));
        cell.find('.line-jisseki').html(this.getActualTimeDisplay(shift));
        cell.find('.line-lock').html(this.getLockDisplay(shift));

        // Update cell styling
        this.updateCellStyling(cell, shift);
    }

    /**
     * Highlight updated cell temporarily
     */
    highlightUpdatedCell(syainId, hiduke) {
        const key = `${syainId}-${hiduke}`;
        const cell = $(`.data-cell[data-key="${key}"]`).closest('td');

        cell.addClass('updated-row');
        setTimeout(() => {
            cell.removeClass('updated-row');
        }, 2000);
    }

    /**
     * Push current state to undo stack
     */
    pushUndo() {
        if (this.state.undoStack.length >= 50) {
            this.state.undoStack.shift(); // Remove oldest
        }

        this.state.undoStack.push({
            shiftMatrix: JSON.parse(JSON.stringify(this.data.shiftMatrix)),
            timestamp: Date.now()
        });

        this.state.redoStack = []; // Clear redo stack
    }

    /**
     * Undo last action
     */
    undo() {
        if (this.state.undoStack.length === 0) {
            this.showMessage('Nothing to undo', 'info');
            return;
        }

        const currentState = {
            shiftMatrix: JSON.parse(JSON.stringify(this.data.shiftMatrix)),
            timestamp: Date.now()
        };

        const previousState = this.state.undoStack.pop();
        this.state.redoStack.push(currentState);

        this.data.shiftMatrix = previousState.shiftMatrix;
        this.renderShiftMatrix();
        this.showMessage('Undid last action', 'info');
    }

    /**
     * Redo last undone action
     */
    redo() {
        if (this.state.redoStack.length === 0) {
            this.showMessage('Nothing to redo', 'info');
            return;
        }

        const currentState = {
            shiftMatrix: JSON.parse(JSON.stringify(this.data.shiftMatrix)),
            timestamp: Date.now()
        };

        const nextState = this.state.redoStack.pop();
        this.state.undoStack.push(currentState);

        this.data.shiftMatrix = nextState.shiftMatrix;
        this.renderShiftMatrix();
        this.showMessage('Redid last action', 'info');
    }

    // === HELPER METHODS ===

    getColorBar(shift) {
        if (!shift || !shift.color_code) return '';
        return `<div style="background-color: ${shift.color_code}; height: 5px; width: 100%;"></div>`;
    }

    getNameDisplay(shift) {
        if (!shift) return '';
        return this.state.displayType === 'time' ? this.formatTime(shift.kinmu_from, shift.kinmu_to) : shift.pattern_name;
    }

    getPatternName(shift) {
        return shift?.pattern_name || '';
    }

    getShiftTimeDisplay(shift) {
        if (!shift || this.state.displayType !== 'time') return '';
        return this.formatTimeRange(shift.kinmu_from, shift.kinmu_to);
    }

    getActualTimeDisplay(shift) {
        if (!shift || !this.state.showActual) return '';
        return this.formatTimeRange(shift.jisseki_from, shift.jisseki_to);
    }

    getLockDisplay(shift) {
        if (!shift || !shift.kotei_flag) return '';
        return '<span class="lock_mark">🔒</span>';
    }

    getDayClass(dayInfo) {
        const classes = [`yobi-${dayInfo.dayofweek}`];
        if (dayInfo.is_weekend) classes.push('weekend');
        if (dayInfo.is_holiday) classes.push('holiday');
        return classes.join(' ');
    }

    formatTime(timeFrom, timeTo) {
        if (!timeFrom || !timeTo) return '';
        return `${timeFrom.substring(0, 5)}-${timeTo.substring(0, 5)}`;
    }

    formatTimeRange(timeFrom, timeTo) {
        if (!timeFrom || !timeTo) return '';
        return `<input type="text" class="jikoku-text" value="${timeFrom.substring(0, 5)}"> - <input type="text" class="jikoku-text" value="${timeTo.substring(0, 5)}">`;
    }

    updateShiftInMatrix(syainId, hiduke, shiftData) {
        if (!this.data.shiftMatrix[syainId]) {
            this.data.shiftMatrix[syainId] = {};
        }
        this.data.shiftMatrix[syainId][hiduke] = shiftData;
    }

    removeShiftFromMatrix(syainId, hiduke) {
        if (this.data.shiftMatrix[syainId]) {
            delete this.data.shiftMatrix[syainId][hiduke];
        }
    }

    updateConnectionStatus(connected) {
        const indicator = $('#connection-status');
        if (indicator.length) {
            indicator
                .removeClass('connected disconnected')
                .addClass(connected ? 'connected' : 'disconnected')
                .find('small')
                .text(connected ? 'Connected' : 'Disconnected');
        }
    }

    showLoading(show) {
        const loader = $('#shift-loader');
        if (loader.length) {
            loader.toggle(show);
        }
    }

    showMessage(message, type = 'info') {
        // Integration with existing message system
        if (typeof window.showMessage === 'function') {
            window.showMessage(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    handleSSEReconnect() {
        if (this.retryCount < this.config.maxRetries) {
            this.retryCount++;
            console.log(`Attempting SSE reconnect (${this.retryCount}/${this.config.maxRetries})`);
            this.scheduleSSEReconnect();
        } else {
            console.error('Max SSE retry attempts reached');
            this.showMessage('Real-time connection lost. Please refresh the page.', 'error');
        }
    }

    scheduleSSEReconnect() {
        setTimeout(() => {
            if (!this.state.isConnected) {
                this.setupSSE();
            }
        }, this.config.retryDelay * this.retryCount);
    }

    /**
     * Cleanup resources
     */
    destroy() {
        if (this.eventSource) {
            this.eventSource.close();
        }

        // Remove event listeners
        $(document).off('.professional-shift-manager');

        // Restore original functions if they were overridden
        if (this.originalFunctions) {
            Object.assign(window, this.originalFunctions);
        }

        console.log('Professional Shift Manager destroyed');
    }
}

// Make globally available
window.ProfessionalShiftManager = ProfessionalShiftManager;

// Auto-initialize if worksetId is available in global scope
$(document).ready(() => {
    if (typeof window.worksetId !== 'undefined') {
        window.professionalShiftManager = new ProfessionalShiftManager(window.worksetId);
    }
});