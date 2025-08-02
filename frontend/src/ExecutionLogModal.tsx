// frontend/src/ExecutionLogModal.tsx
import { useState, useEffect, useRef } from 'react';
import { Modal, Button, ListGroup, Badge, Card, CloseButton } from 'react-bootstrap';
import './ExecutionLogModal.css';
import ReactMarkdown from 'react-markdown';

type LogMessage = {
  type: 'log' | 'error' | 'result' | 'status';
  source?: string;
  message: string;
  output?: string;
  status?: 'complete' | 'error';
};

type ExecutionLogModalProps = {
  show: boolean;
  onHide: () => void;
  websocketUrl: string;
};

export function ExecutionLogModal({ show, onHide, websocketUrl }: ExecutionLogModalProps) {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [processStatus, setProcessStatus] = useState<'running' | 'complete' | 'error'>('running');
  const ws = useRef<WebSocket | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // This effect should only run when the modal is opened or closed.
    if (show) {
      setLogs([]);
      setProcessStatus('running');

      ws.current = new WebSocket(websocketUrl);
      console.log(`Attempting to connect to ${websocketUrl}...`);

      ws.current.onopen = () => console.log("WebSocket connection established.");

      ws.current.onmessage = (event) => {
        try {
          const newLog: LogMessage = JSON.parse(event.data);
          setLogs(prevLogs => [...prevLogs, newLog]);
          if (newLog.type === 'status') {
            setProcessStatus(newLog.status || 'error');
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.current.onerror = (error) => {
        console.error("WebSocket error:", error);
        setLogs(prev => [...prev, { type: 'error', message: 'WebSocket connection error.' }]);
        setProcessStatus('error');
      };

      ws.current.onclose = () => {
        console.log("WebSocket connection closed.");
        // Use a functional update to avoid dependency on processStatus
        setProcessStatus(currentStatus => currentStatus === 'running' ? 'error' : currentStatus);
      };

      // The cleanup function will run ONLY when the component unmounts or `show` changes.
      return () => {
        if (ws.current) {
          ws.current.close();
        }
      };
    }
    // --- THIS IS THE CRITICAL FIX ---
    // The connection lifecycle depends ONLY on the modal's visibility (`show`) and the URL.
  }, [show, websocketUrl]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // The rest of the component's rendering logic is unchanged and correct.
  const getBadgeVariant = (type: LogMessage['type']) => {
    switch (type) {
      case 'error': return 'danger';
      case 'result': return 'success';
      case 'log': return 'info';
      default: return 'secondary';
    }
  };

  const getStatusIndicator = () => {
    switch (processStatus) {
        case 'running': return <><span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Running...</>;
        case 'complete': return <span className="text-success">✔ Complete</span>;
        case 'error': return <span className="text-danger">✖ Error</span>;
    }
  }

  return (
    <Modal show={show} onHide={onHide} size="xl" backdrop="static" keyboard={false}>
      <Modal.Header>
        <Modal.Title>Live Execution Log</Modal.Title>
        <div className="ms-auto me-3"><strong>Status:</strong> {getStatusIndicator()}</div>
        <CloseButton onClick={onHide} disabled={processStatus === 'running'} />
      </Modal.Header>
      <Modal.Body className="log-modal-body" ref={logContainerRef}>
        <ListGroup variant="flush">
          {logs.map((log, index) => (
            <ListGroup.Item key={index} className="log-entry">
              <div className="d-flex w-100 justify-content-between">
                <div>
                  <Badge bg={getBadgeVariant(log.type)} className="me-2">{log.type.toUpperCase()}</Badge>
                  {log.source && <Badge bg="secondary" className="me-2">{log.source}</Badge>}
                  <span>{log.message}</span>
                </div>
                <small>{new Date().toLocaleTimeString()}</small>
              </div>
              {log.type === 'result' && log.output && (
                <Card className="mt-2">
                  <Card.Header><strong>Formatted Output</strong></Card.Header>
                  <Card.Body>
                    {/* --- 2. THIS IS THE CRITICAL CHANGE --- */}
                    {/* Replace the <pre> tag with the ReactMarkdown component */}
                    <div className="markdown-output">
                      <ReactMarkdown>{log.output}</ReactMarkdown>
                    </div>
                  </Card.Body>
                </Card>
              )}
            </ListGroup.Item>
          ))}
        </ListGroup>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={processStatus === 'running'}>
          {processStatus === 'running' ? 'Close (Unavailable while running)' : 'Close'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}