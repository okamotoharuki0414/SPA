<?php

/**
 * Shift Model for database operations
 * Handles shift data management with PostgreSQL
 */
class Shift extends Zend_Db_Table_Abstract
{
    protected $_name = 'shifts';
    protected $_primary = 'shift_id';

    /**
     * Find shifts by workset ID
     * @param int $worksetId
     * @return array
     */
    public function findByWorkset($worksetId)
    {
        try {
            $select = $this->select()
                ->where('workset_id = ?', $worksetId)
                ->order('shift_date ASC')
                ->order('start_time ASC');

            $shifts = $this->fetchAll($select);

            // Convert to array and format data
            $result = [];
            foreach ($shifts as $shift) {
                $shiftData = $shift->toArray();

                // Format dates and times
                if (!empty($shiftData['shift_date'])) {
                    $shiftData['shift_date_formatted'] = date('Y-m-d', strtotime($shiftData['shift_date']));
                }

                if (!empty($shiftData['start_time'])) {
                    $shiftData['start_time_formatted'] = date('H:i', strtotime($shiftData['start_time']));
                }

                if (!empty($shiftData['end_time'])) {
                    $shiftData['end_time_formatted'] = date('H:i', strtotime($shiftData['end_time']));
                }

                // Calculate work hours
                if (!empty($shiftData['start_time']) && !empty($shiftData['end_time'])) {
                    $start = strtotime($shiftData['start_time']);
                    $end = strtotime($shiftData['end_time']);
                    $hours = ($end - $start) / 3600;
                    $shiftData['work_hours'] = round($hours, 2);
                }

                $result[] = $shiftData;
            }

            return $result;

        } catch (Exception $e) {
            error_log("Shift findByWorkset error: " . $e->getMessage());
            throw new Exception("Failed to fetch shift data");
        }
    }

    /**
     * Update shift data
     * @param array $payload
     * @return array Updated shift data
     */
    public function updateShift(array $payload)
    {
        try {
            $db = $this->getAdapter();
            $db->beginTransaction();

            // Validate shift exists
            $shiftId = $payload['shift_id'];
            $existingShift = $this->find($shiftId)->current();

            if (!$existingShift) {
                throw new Exception("Shift not found: {$shiftId}");
            }

            // Prepare update data
            $updateData = [];

            // Map allowed fields for update
            $allowedFields = [
                'employee_id',
                'shift_date',
                'start_time',
                'end_time',
                'status',
                'notes',
                'location',
                'department'
            ];

            foreach ($allowedFields as $field) {
                if (array_key_exists($field, $payload)) {
                    $updateData[$field] = $payload[$field];
                }
            }

            // Add update timestamp
            $updateData['updated_at'] = new Zend_Db_Expr('NOW()');

            // Perform update
            $where = $this->getAdapter()->quoteInto('shift_id = ?', $shiftId);
            $this->update($updateData, $where);

            // Get updated data
            $updatedShift = $this->find($shiftId)->current();

            // Trigger PostgreSQL NOTIFY for real-time updates
            $this->_triggerPostgresNotify($payload['workset_id'], $updatedShift->toArray());

            $db->commit();

            // Return formatted data
            $result = $updatedShift->toArray();

            // Add formatted fields
            if (!empty($result['shift_date'])) {
                $result['shift_date_formatted'] = date('Y-m-d', strtotime($result['shift_date']));
            }

            if (!empty($result['start_time'])) {
                $result['start_time_formatted'] = date('H:i', strtotime($result['start_time']));
            }

            if (!empty($result['end_time'])) {
                $result['end_time_formatted'] = date('H:i', strtotime($result['end_time']));
            }

            // Calculate work hours
            if (!empty($result['start_time']) && !empty($result['end_time'])) {
                $start = strtotime($result['start_time']);
                $end = strtotime($result['end_time']);
                $hours = ($end - $start) / 3600;
                $result['work_hours'] = round($hours, 2);
            }

            return $result;

        } catch (Exception $e) {
            $db->rollBack();
            error_log("Shift update error: " . $e->getMessage());
            throw new Exception("Failed to update shift: " . $e->getMessage());
        }
    }

    /**
     * Create new shift
     * @param array $data
     * @return array Created shift data
     */
    public function createShift(array $data)
    {
        try {
            $db = $this->getAdapter();
            $db->beginTransaction();

            // Validate required fields
            $requiredFields = ['workset_id', 'employee_id', 'shift_date', 'start_time', 'end_time'];
            foreach ($requiredFields as $field) {
                if (empty($data[$field])) {
                    throw new Exception("Required field missing: {$field}");
                }
            }

            // Add timestamps
            $data['created_at'] = new Zend_Db_Expr('NOW()');
            $data['updated_at'] = new Zend_Db_Expr('NOW()');

            // Insert new shift
            $shiftId = $this->insert($data);

            // Get created data
            $newShift = $this->find($shiftId)->current();

            $db->commit();

            return $newShift->toArray();

        } catch (Exception $e) {
            $db->rollBack();
            error_log("Shift create error: " . $e->getMessage());
            throw new Exception("Failed to create shift: " . $e->getMessage());
        }
    }

    /**
     * Delete shift
     * @param int $shiftId
     * @return bool
     */
    public function deleteShift($shiftId)
    {
        try {
            $db = $this->getAdapter();
            $db->beginTransaction();

            $where = $this->getAdapter()->quoteInto('shift_id = ?', $shiftId);
            $result = $this->delete($where);

            $db->commit();

            return $result > 0;

        } catch (Exception $e) {
            $db->rollBack();
            error_log("Shift delete error: " . $e->getMessage());
            throw new Exception("Failed to delete shift");
        }
    }

    /**
     * Trigger PostgreSQL NOTIFY for real-time updates
     * @param int $worksetId
     * @param array $shiftData
     */
    private function _triggerPostgresNotify($worksetId, $shiftData)
    {
        try {
            $db = $this->getAdapter();

            $payload = json_encode([
                'type' => 'shift_updated',
                'workset_id' => $worksetId,
                'data' => $shiftData,
                'timestamp' => date('Y-m-d H:i:s')
            ]);

            // Send PostgreSQL NOTIFY
            $channel = "shift_channel_{$worksetId}";
            $sql = "SELECT pg_notify(?, ?)";
            $db->query($sql, [$channel, $payload]);

        } catch (Exception $e) {
            error_log("PostgreSQL NOTIFY error: " . $e->getMessage());
        }
    }

    /**
     * Get shift statistics by workset
     * @param int $worksetId
     * @return array
     */
    public function getWorksetStats($worksetId)
    {
        try {
            $select = $this->select()
                ->from($this->_name, [
                    'total_shifts' => new Zend_Db_Expr('COUNT(*)'),
                    'total_hours' => new Zend_Db_Expr('COALESCE(SUM(EXTRACT(EPOCH FROM (end_time - start_time)) / 3600), 0)'),
                    'active_shifts' => new Zend_Db_Expr('COUNT(CASE WHEN status = \'active\' THEN 1 END)'),
                    'completed_shifts' => new Zend_Db_Expr('COUNT(CASE WHEN status = \'completed\' THEN 1 END)')
                ])
                ->where('workset_id = ?', $worksetId);

            $result = $this->fetchRow($select);

            return $result ? $result->toArray() : [
                'total_shifts' => 0,
                'total_hours' => 0,
                'active_shifts' => 0,
                'completed_shifts' => 0
            ];

        } catch (Exception $e) {
            error_log("Shift stats error: " . $e->getMessage());
            return [
                'total_shifts' => 0,
                'total_hours' => 0,
                'active_shifts' => 0,
                'completed_shifts' => 0
            ];
        }
    }
}