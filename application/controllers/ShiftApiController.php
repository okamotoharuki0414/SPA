<?php

/**
 * Shift API Controller for SPA functionality
 * Provides REST endpoints for shift management
 */
class ShiftApiController extends Zend_Controller_Action
{
    protected $_shift;

    public function init()
    {
        // Initialize the Shift model
        $this->_shift = new Shift();

        // Disable view rendering for API responses
        $this->_helper->viewRenderer->setNoRender();

        // Set JSON content type
        $this->getResponse()->setHeader('Content-Type', 'application/json; charset=utf-8');

        // Enable CORS for Ajax requests
        $this->getResponse()->setHeader('Access-Control-Allow-Origin', '*');
        $this->getResponse()->setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        $this->getResponse()->setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');

        // Handle preflight requests
        if ($this->getRequest()->getMethod() === 'OPTIONS') {
            $this->getResponse()->setHttpResponseCode(200);
            return;
        }
    }

    /**
     * GET /api/shift/list?workset_id=XXX
     * Get shift list by workset ID
     */
    public function listAction()
    {
        try {
            $worksetId = $this->getRequest()->getParam('workset_id');

            if (empty($worksetId)) {
                throw new Exception('workset_id is required');
            }

            // Get shift data from model
            $shifts = $this->_shift->findByWorkset($worksetId);

            $response = [
                'success' => true,
                'data' => $shifts,
                'count' => count($shifts),
                'workset_id' => $worksetId
            ];

            $this->getResponse()->setHttpResponseCode(200);
            echo json_encode($response, JSON_UNESCAPED_UNICODE);

        } catch (Exception $e) {
            $this->_handleError($e->getMessage(), 400);
        }
    }

    /**
     * POST /api/shift/update
     * Update shift data and trigger SSE notification
     */
    public function updateAction()
    {
        try {
            // Only allow POST requests
            if (!$this->getRequest()->isPost()) {
                throw new Exception('Only POST method allowed');
            }

            // Get JSON payload
            $rawBody = file_get_contents('php://input');
            $payload = json_decode($rawBody, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new Exception('Invalid JSON payload');
            }

            // Validate required fields
            if (empty($payload['workset_id'])) {
                throw new Exception('workset_id is required');
            }

            if (empty($payload['shift_id'])) {
                throw new Exception('shift_id is required');
            }

            // Update shift data
            $updatedShift = $this->_shift->updateShift($payload);

            // Trigger SSE notification via Redis
            $this->_notifySSE($payload['workset_id'], [
                'type' => 'shift_updated',
                'data' => $updatedShift,
                'timestamp' => date('Y-m-d H:i:s')
            ]);

            $response = [
                'success' => true,
                'message' => 'Shift updated successfully',
                'data' => $updatedShift
            ];

            $this->getResponse()->setHttpResponseCode(200);
            echo json_encode($response, JSON_UNESCAPED_UNICODE);

        } catch (Exception $e) {
            $this->_handleError($e->getMessage(), 400);
        }
    }

    /**
     * Handle API errors
     */
    private function _handleError($message, $code = 500)
    {
        $response = [
            'success' => false,
            'error' => $message,
            'timestamp' => date('Y-m-d H:i:s')
        ];

        $this->getResponse()->setHttpResponseCode($code);
        echo json_encode($response, JSON_UNESCAPED_UNICODE);
    }

    /**
     * Send SSE notification via Redis
     */
    private function _notifySSE($worksetId, $data)
    {
        try {
            // Connect to Redis
            $redis = new Redis();
            $redis->connect('127.0.0.1', 6379);

            // Publish notification to specific workset channel
            $channel = "shift_updates_{$worksetId}";
            $message = json_encode($data);

            $redis->publish($channel, $message);
            $redis->close();

        } catch (Exception $e) {
            // Log Redis error but don't fail the main request
            error_log("Redis publish failed: " . $e->getMessage());
        }
    }
}