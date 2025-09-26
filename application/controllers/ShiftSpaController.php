<?php

/**
 * Advanced Shift SPA Controller
 * Professional-grade shift management with ScrollTable support, real-time updates, and complex business logic
 */
class ShiftSpaController extends Zend_Controller_Action
{
    private $redis;
    private $db;

    public function init()
    {
        // Disable view rendering for AJAX responses
        $this->_helper->viewRenderer->setNoRender(true);
        $this->_helper->layout()->disableLayout();

        // Initialize database connection
        $this->db = Zend_Db_Table::getDefaultAdapter();

        // Initialize Redis connection for SSE notifications
        try {
            $this->redis = new Redis();
            $this->redis->connect('127.0.0.1', 6379);
        } catch (Exception $e) {
            error_log('Redis connection failed: ' . $e->getMessage());
        }

        // Set response headers for CORS and JSON
        $this->getResponse()
            ->setHeader('Access-Control-Allow-Origin', '*')
            ->setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
            ->setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With')
            ->setHeader('Content-Type', 'application/json');
    }

    /**
     * Handle preflight CORS requests
     */
    public function optionsAction()
    {
        $this->getResponse()->setHttpResponseCode(200);
        echo '';
    }

    /**
     * Get shift data for ScrollTable display with comprehensive structure
     */
    public function shiftDataAction()
    {
        try {
            $request = $this->getRequest();
            $worksetId = (int)$request->getParam('workset_id');
            $displayType = $request->getParam('display_type', 'time'); // 'time' or 'name'
            $showActual = (bool)$request->getParam('show_actual', true);
            $dateFrom = $request->getParam('date_from');
            $dateTo = $request->getParam('date_to');

            if (!$worksetId) {
                throw new Exception('Valid workset_id is required');
            }

            // Get date range (defaults to current month +/-1)
            if (!$dateFrom || !$dateTo) {
                $dateFrom = date('Y-m-01', strtotime('-1 month'));
                $dateTo = date('Y-m-t', strtotime('+1 month'));
            }

            // Get day list with holiday information
            $dayList = $this->getDayList($dateFrom, $dateTo, $worksetId);

            // Get employee list with attributes
            $employeeList = $this->getEmployeeList($worksetId);

            // Get shift data
            $shiftData = $this->getShiftData($worksetId, $dateFrom, $dateTo, $employeeList, $dayList);

            // Get kinmu patterns for the workset
            $kinmuPatterns = $this->getKinmuPatterns($worksetId);

            // Get summary data
            $summaryData = $this->getSummaryData($worksetId, $dateFrom, $dateTo);

            // Get alerts and validations
            $alerts = $this->getShiftAlerts($worksetId, $dateFrom, $dateTo);

            $response = [
                'success' => true,
                'data' => [
                    'workset_id' => $worksetId,
                    'display_type' => $displayType,
                    'show_actual' => $showActual,
                    'date_range' => [
                        'from' => $dateFrom,
                        'to' => $dateTo
                    ],
                    'day_list' => $dayList,
                    'employee_list' => $employeeList,
                    'shift_data' => $shiftData,
                    'kinmu_patterns' => $kinmuPatterns,
                    'summary_data' => $summaryData,
                    'alerts' => $alerts,
                    'cell_config' => [
                        'default_height' => 95,
                        'pattern_height' => 40,
                        'default_width' => 100,
                        'pattern_width' => 55
                    ]
                ],
                'timestamp' => date('c')
            ];

            echo json_encode($response, JSON_UNESCAPED_UNICODE);

        } catch (Exception $e) {
            $this->sendErrorResponse($e->getMessage(), 500);
        }
    }

    /**
     * Update shift data with comprehensive validation
     */
    public function updateShiftAction()
    {
        try {
            $request = $this->getRequest();

            if (!$request->isPost()) {
                throw new Exception('Only POST method allowed');
            }

            $input = json_decode($request->getRawBody(), true);
            if (!$input) {
                throw new Exception('Invalid JSON input');
            }

            $worksetId = (int)$input['workset_id'];
            $syainId = (int)$input['syain_id'];
            $hiduke = $input['hiduke'];

            if (!$worksetId || !$syainId || !$hiduke) {
                throw new Exception('workset_id, syain_id, and hiduke are required');
            }

            // Validate date format
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $hiduke)) {
                throw new Exception('Invalid date format. Use YYYY-MM-DD');
            }

            // Start transaction
            $this->db->beginTransaction();

            try {
                // Get existing shift data
                $existingShift = $this->getExistingShift($worksetId, $syainId, $hiduke);

                // Prepare shift update data
                $shiftUpdateData = $this->prepareShiftUpdateData($input, $existingShift);

                // Validate shift data
                $validationResult = $this->validateShiftData($shiftUpdateData);
                if (!$validationResult['valid']) {
                    throw new Exception('Validation failed: ' . implode(', ', $validationResult['errors']));
                }

                // Update shift data
                if ($existingShift) {
                    $shiftId = $this->updateExistingShift($existingShift['id'], $shiftUpdateData);
                } else {
                    $shiftId = $this->createNewShift($shiftUpdateData);
                }

                // Update related calculations
                $this->updateCalculations($worksetId, $syainId, $hiduke);

                // Commit transaction
                $this->db->commit();

                // Send SSE notification
                $this->sendShiftUpdateNotification($worksetId, $syainId, $hiduke, 'UPDATE');

                // Get updated shift data for response
                $updatedShift = $this->getShiftById($shiftId);

                $response = [
                    'success' => true,
                    'data' => $updatedShift,
                    'message' => 'Shift updated successfully',
                    'timestamp' => date('c')
                ];

                echo json_encode($response, JSON_UNESCAPED_UNICODE);

            } catch (Exception $e) {
                $this->db->rollBack();
                throw $e;
            }

        } catch (Exception $e) {
            $this->sendErrorResponse($e->getMessage(), 400);
        }
    }

    /**
     * Bulk update shifts (for pattern application)
     */
    public function bulkUpdateAction()
    {
        try {
            $request = $this->getRequest();

            if (!$request->isPost()) {
                throw new Exception('Only POST method allowed');
            }

            $input = json_decode($request->getRawBody(), true);
            if (!$input || !isset($input['updates']) || !is_array($input['updates'])) {
                throw new Exception('Invalid JSON input or missing updates array');
            }

            $worksetId = (int)$input['workset_id'];
            if (!$worksetId) {
                throw new Exception('workset_id is required');
            }

            $this->db->beginTransaction();

            try {
                $updatedShifts = [];
                $errors = [];

                foreach ($input['updates'] as $update) {
                    try {
                        $syainId = (int)$update['syain_id'];
                        $hiduke = $update['hiduke'];

                        // Validate required fields
                        if (!$syainId || !$hiduke) {
                            throw new Exception("syain_id and hiduke are required for each update");
                        }

                        // Get existing shift
                        $existingShift = $this->getExistingShift($worksetId, $syainId, $hiduke);

                        // Prepare update data
                        $updateData = $this->prepareShiftUpdateData($update + ['workset_id' => $worksetId], $existingShift);

                        // Validate
                        $validationResult = $this->validateShiftData($updateData);
                        if (!$validationResult['valid']) {
                            throw new Exception('Validation failed: ' . implode(', ', $validationResult['errors']));
                        }

                        // Update or create
                        if ($existingShift) {
                            $shiftId = $this->updateExistingShift($existingShift['id'], $updateData);
                        } else {
                            $shiftId = $this->createNewShift($updateData);
                        }

                        $updatedShifts[] = [
                            'shift_id' => $shiftId,
                            'syain_id' => $syainId,
                            'hiduke' => $hiduke
                        ];

                        // Send individual SSE notification
                        $this->sendShiftUpdateNotification($worksetId, $syainId, $hiduke, 'UPDATE');

                    } catch (Exception $e) {
                        $errors[] = [
                            'syain_id' => $syainId ?? null,
                            'hiduke' => $hiduke ?? null,
                            'error' => $e->getMessage()
                        ];
                    }
                }

                // Recalculate summaries for affected dates
                $this->recalculateSummaries($worksetId, $input['updates']);

                $this->db->commit();

                $response = [
                    'success' => true,
                    'data' => [
                        'updated_count' => count($updatedShifts),
                        'updated_shifts' => $updatedShifts,
                        'error_count' => count($errors),
                        'errors' => $errors
                    ],
                    'message' => 'Bulk update completed',
                    'timestamp' => date('c')
                ];

                echo json_encode($response, JSON_UNESCAPED_UNICODE);

            } catch (Exception $e) {
                $this->db->rollBack();
                throw $e;
            }

        } catch (Exception $e) {
            $this->sendErrorResponse($e->getMessage(), 400);
        }
    }

    /**
     * Get kinmu patterns for pattern selection panel
     */
    public function kinmuPatternsAction()
    {
        try {
            $worksetId = (int)$this->getRequest()->getParam('workset_id');
            if (!$worksetId) {
                throw new Exception('workset_id is required');
            }

            $patterns = $this->getKinmuPatterns($worksetId);

            $response = [
                'success' => true,
                'data' => $patterns,
                'timestamp' => date('c')
            ];

            echo json_encode($response, JSON_UNESCAPED_UNICODE);

        } catch (Exception $e) {
            $this->sendErrorResponse($e->getMessage(), 500);
        }
    }

    /**
     * Get validation alerts for shift data
     */
    public function alertsAction()
    {
        try {
            $request = $this->getRequest();
            $worksetId = (int)$request->getParam('workset_id');
            $dateFrom = $request->getParam('date_from');
            $dateTo = $request->getParam('date_to');

            if (!$worksetId) {
                throw new Exception('workset_id is required');
            }

            $alerts = $this->getShiftAlerts($worksetId, $dateFrom, $dateTo);

            $response = [
                'success' => true,
                'data' => $alerts,
                'timestamp' => date('c')
            ];

            echo json_encode($response, JSON_UNESCAPED_UNICODE);

        } catch (Exception $e) {
            $this->sendErrorResponse($e->getMessage(), 500);
        }
    }

    /**
     * Delete shift
     */
    public function deleteShiftAction()
    {
        try {
            $request = $this->getRequest();

            if (!$request->isDelete() && !$request->isPost()) {
                throw new Exception('Only DELETE or POST method allowed');
            }

            $worksetId = (int)$request->getParam('workset_id');
            $syainId = (int)$request->getParam('syain_id');
            $hiduke = $request->getParam('hiduke');

            if (!$worksetId || !$syainId || !$hiduke) {
                throw new Exception('workset_id, syain_id, and hiduke are required');
            }

            $this->db->beginTransaction();

            try {
                // Check if shift exists
                $existingShift = $this->getExistingShift($worksetId, $syainId, $hiduke);
                if (!$existingShift) {
                    throw new Exception('Shift not found');
                }

                // Delete shift
                $this->db->delete('shift', [
                    'workset_id = ?' => $worksetId,
                    'syain_id = ?' => $syainId,
                    'hiduke = ?' => $hiduke
                ]);

                // Update calculations
                $this->updateCalculations($worksetId, $syainId, $hiduke);

                $this->db->commit();

                // Send SSE notification
                $this->sendShiftUpdateNotification($worksetId, $syainId, $hiduke, 'DELETE');

                $response = [
                    'success' => true,
                    'message' => 'Shift deleted successfully',
                    'timestamp' => date('c')
                ];

                echo json_encode($response, JSON_UNESCAPED_UNICODE);

            } catch (Exception $e) {
                $this->db->rollBack();
                throw $e;
            }

        } catch (Exception $e) {
            $this->sendErrorResponse($e->getMessage(), 400);
        }
    }

    // === PRIVATE HELPER METHODS ===

    private function getDayList($dateFrom, $dateTo, $worksetId)
    {
        $days = [];
        $current = new DateTime($dateFrom);
        $end = new DateTime($dateTo);

        // Get holiday data
        $holidays = $this->getHolidays($dateFrom, $dateTo, $worksetId);

        while ($current <= $end) {
            $dateStr = $current->format('Y-m-d');
            $dayOfWeek = (int)$current->format('w');

            $days[] = [
                'date' => $current->getTimestamp(),
                'date_string' => $dateStr,
                'day' => (int)$current->format('d'),
                'month' => (int)$current->format('m'),
                'year' => (int)$current->format('Y'),
                'dayofweek' => $dayOfWeek,
                'is_weekend' => ($dayOfWeek == 0 || $dayOfWeek == 6),
                'is_holiday' => isset($holidays[$dateStr]),
                'holiday_name' => $holidays[$dateStr] ?? null,
                'yosanzokuseibi_id' => $this->getYosanZokuseibi($dateStr, $worksetId)
            ];

            $current->modify('+1 day');
        }

        return $days;
    }

    private function getEmployeeList($worksetId)
    {
        $sql = "
            SELECT
                s.syain_id,
                s.syain_name,
                s.syain_kana,
                s.busyo_name,
                s.yakusyoku_name,
                s.syain_kubun,
                s.is_active,
                COALESCE(sa.zokusei_name, '') as zokusei_name
            FROM syain s
            LEFT JOIN syain_attribute sa ON s.syain_id = sa.syain_id AND s.workset_id = sa.workset_id
            WHERE s.workset_id = ?
            AND s.is_active = 1
            ORDER BY s.hyouji_junban ASC, s.syain_name ASC
        ";

        $employees = $this->db->fetchAll($sql, [$worksetId]);

        foreach ($employees as &$employee) {
            $employee['syain_id'] = (int)$employee['syain_id'];
            $employee['is_active'] = (bool)$employee['is_active'];
        }

        return $employees;
    }

    private function getShiftData($worksetId, $dateFrom, $dateTo, $employeeList, $dayList)
    {
        // Create employee index
        $employeeIndex = [];
        foreach ($employeeList as $emp) {
            $employeeIndex[$emp['syain_id']] = $emp;
        }

        // Create day index
        $dayIndex = [];
        foreach ($dayList as $day) {
            $dayIndex[$day['date_string']] = $day;
        }

        // Get shift data
        $sql = "
            SELECT
                s.*,
                kp.kinmupattern_name,
                kp.kinmu_from,
                kp.kinmu_to,
                kp.kyukei_jikan,
                kp.color_code,
                km.kyujitu_name,
                j.jisseki_from,
                j.jisseki_to,
                j.jisseki_kyukei
            FROM shift s
            LEFT JOIN kinmupattern kp ON s.pattern_id = kp.id
            LEFT JOIN kyujitumaster km ON s.kyujitu_id = km.id
            LEFT JOIN jisseki j ON s.workset_id = j.workset_id
                AND s.syain_id = j.syain_id
                AND s.hiduke = j.hiduke
            WHERE s.workset_id = ?
            AND s.hiduke BETWEEN ? AND ?
            ORDER BY s.syain_id, s.hiduke
        ";

        $shifts = $this->db->fetchAll($sql, [$worksetId, $dateFrom, $dateTo]);

        // Organize shifts by employee and date
        $shiftMatrix = [];
        foreach ($shifts as $shift) {
            $syainId = (int)$shift['syain_id'];
            $hiduke = $shift['hiduke'];

            if (!isset($shiftMatrix[$syainId])) {
                $shiftMatrix[$syainId] = [];
            }

            $shiftMatrix[$syainId][$hiduke] = [
                'shift_id' => (int)$shift['id'],
                'syain_id' => $syainId,
                'hiduke' => $hiduke,
                'pattern_id' => (int)$shift['pattern_id'],
                'pattern_name' => $shift['kinmupattern_name'],
                'kinmu_from' => $shift['kinmu_from'],
                'kinmu_to' => $shift['kinmu_to'],
                'kyukei_jikan' => (int)$shift['kyukei_jikan'],
                'kyujitu_id' => (int)$shift['kyujitu_id'],
                'kyujitu_name' => $shift['kyujitu_name'],
                'color_code' => $shift['color_code'],
                'jisseki_from' => $shift['jisseki_from'],
                'jisseki_to' => $shift['jisseki_to'],
                'jisseki_kyukei' => (int)$shift['jisseki_kyukei'],
                'kotei_flag' => (bool)$shift['kotei_flag'],
                'bikou' => $shift['bikou'],
                'work_hours' => $this->calculateWorkHours($shift),
                'difference' => $this->calculateDifference($shift),
                'alerts' => $this->getShiftAlerts($worksetId, $hiduke, $hiduke, $syainId)
            ];
        }

        return $shiftMatrix;
    }

    private function getKinmuPatterns($worksetId)
    {
        $sql = "
            SELECT
                id,
                kinmupattern_name,
                kinmu_from,
                kinmu_to,
                kyukei_jikan,
                color_code,
                is_kyujitu,
                hyouji_junban
            FROM kinmupattern
            WHERE workset_id = ?
            AND is_active = 1
            ORDER BY hyouji_junban ASC, kinmupattern_name ASC
        ";

        $patterns = $this->db->fetchAll($sql, [$worksetId]);

        foreach ($patterns as &$pattern) {
            $pattern['id'] = (int)$pattern['id'];
            $pattern['kyukei_jikan'] = (int)$pattern['kyukei_jikan'];
            $pattern['is_kyujitu'] = (bool)$pattern['is_kyujitu'];
        }

        return $patterns;
    }

    private function getSummaryData($worksetId, $dateFrom, $dateTo)
    {
        // Implementation for summary calculations would go here
        // This would include daily totals, employee totals, etc.
        return [
            'daily_totals' => [],
            'employee_totals' => [],
            'workset_totals' => []
        ];
    }

    private function getShiftAlerts($worksetId, $dateFrom, $dateTo, $syainId = null)
    {
        // Implementation for shift validation alerts
        return [
            'consecutive_work_alerts' => [],
            'overtime_alerts' => [],
            'pattern_conflict_alerts' => [],
            'required_staff_alerts' => []
        ];
    }

    private function sendShiftUpdateNotification($worksetId, $syainId, $hiduke, $operation)
    {
        if (!$this->redis) {
            return;
        }

        try {
            $message = json_encode([
                'workset_id' => $worksetId,
                'syain_id' => $syainId,
                'hiduke' => $hiduke,
                'operation' => $operation,
                'timestamp' => date('c')
            ]);

            $this->redis->publish('shift_updated', $message);
        } catch (Exception $e) {
            error_log('Failed to send Redis notification: ' . $e->getMessage());
        }
    }

    private function sendErrorResponse($message, $code = 400)
    {
        $this->getResponse()->setHttpResponseCode($code);
        echo json_encode([
            'success' => false,
            'error' => $message,
            'timestamp' => date('c')
        ], JSON_UNESCAPED_UNICODE);
    }

    private function getExistingShift($worksetId, $syainId, $hiduke)
    {
        return $this->db->fetchRow(
            'SELECT * FROM shift WHERE workset_id = ? AND syain_id = ? AND hiduke = ?',
            [$worksetId, $syainId, $hiduke]
        );
    }

    private function prepareShiftUpdateData($input, $existingShift)
    {
        return [
            'workset_id' => (int)$input['workset_id'],
            'syain_id' => (int)$input['syain_id'],
            'hiduke' => $input['hiduke'],
            'pattern_id' => isset($input['pattern_id']) ? (int)$input['pattern_id'] : null,
            'kinmu_from' => $input['kinmu_from'] ?? null,
            'kinmu_to' => $input['kinmu_to'] ?? null,
            'kyujitu_id' => isset($input['kyujitu_id']) ? (int)$input['kyujitu_id'] : null,
            'kotei_flag' => isset($input['kotei_flag']) ? (bool)$input['kotei_flag'] : false,
            'bikou' => $input['bikou'] ?? '',
            'update_user' => 'spa_api',
            'update_date' => date('Y-m-d H:i:s')
        ];
    }

    private function validateShiftData($data)
    {
        $errors = [];

        // Add validation logic here
        if (!$data['workset_id']) {
            $errors[] = 'workset_id is required';
        }

        if (!$data['syain_id']) {
            $errors[] = 'syain_id is required';
        }

        // Time validation
        if ($data['kinmu_from'] && $data['kinmu_to']) {
            if (strtotime($data['kinmu_from']) >= strtotime($data['kinmu_to'])) {
                $errors[] = 'Start time must be before end time';
            }
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors
        ];
    }

    private function updateExistingShift($shiftId, $data)
    {
        $this->db->update('shift', $data, ['id = ?' => $shiftId]);
        return $shiftId;
    }

    private function createNewShift($data)
    {
        $data['create_user'] = 'spa_api';
        $data['create_date'] = date('Y-m-d H:i:s');

        $this->db->insert('shift', $data);
        return $this->db->lastInsertId();
    }

    private function updateCalculations($worksetId, $syainId, $hiduke)
    {
        // Update various calculations affected by shift changes
        // This would include daily totals, employee totals, etc.
    }

    private function calculateWorkHours($shift)
    {
        if (!$shift['kinmu_from'] || !$shift['kinmu_to']) {
            return 0;
        }

        $start = strtotime($shift['kinmu_from']);
        $end = strtotime($shift['kinmu_to']);
        $breakTime = (int)$shift['kyukei_jikan'];

        $totalMinutes = (($end - $start) / 60) - $breakTime;
        return max(0, $totalMinutes / 60);
    }

    private function calculateDifference($shift)
    {
        // Calculate difference between planned and actual hours
        return 0;
    }

    private function getShiftById($shiftId)
    {
        return $this->db->fetchRow('SELECT * FROM shift WHERE id = ?', [$shiftId]);
    }

    private function getHolidays($dateFrom, $dateTo, $worksetId)
    {
        // Get holiday data for date range
        return [];
    }

    private function getYosanZokuseibi($date, $worksetId)
    {
        // Get budget attribute for specific date
        return 1;
    }

    private function recalculateSummaries($worksetId, $updates)
    {
        // Recalculate summary data for affected dates/employees
    }
}