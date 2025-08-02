// src/App.tsx

import { useState } from 'react';
import { Container, Form, Button, Row, Col, Card, Alert, Spinner } from 'react-bootstrap'; // Add Alert
import { ExecutionLogModal } from './ExecutionLogModal';

// Define a type for our agent state for better code quality
type Agent = {
  id: number;
  name: string;
  role: string;
  task: string; // The specific task for this agent
  selectedChatbot: string;
};


// Type for the plan received from the backend
type AgentPlan = Omit<Agent, 'id' | 'selectedChatbot' | 'selectedLlm'>;

function App() {
  const [initialObjective, setInitialObjective] = useState('');
  const [clarifiedObjective, setClarifiedObjective] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [maxIterations, setMaxIterations] = useState<number>(3); 
  const [error, setError] = useState<string | null>(null);
  
  // State to manage the UI flow
  const [isPlanning, setIsPlanning] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  
  const [showLogModal, setShowLogModal] = useState(false);

  const handleCreatePlan = async () => {
    if (!initialObjective.trim()) {
      setError("Please define the objective before creating a plan.");
      return;
    }
    setError(null);
    setIsPlanning(true);

    try {
      const response = await fetch('http://localhost:8000/api/create-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: initialObjective }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create a plan.');
      }

      const { plan, clarifiedObjective: objective } = await response.json();
      
      // Populate the agents state from the received plan
      const agentsFromPlan = plan.map((p: AgentPlan, index: number) => ({
        ...p,
        id: index + 1,
        selectedChatbot: '',
        selectedLlm: '',
      }));

      setAgents(agentsFromPlan);
      setClarifiedObjective(objective);
      setIsConfigured(true); // Move to the configuration phase

    } catch (err: any) {
      console.error("Failed to create plan:", err);
      setError(err.message);
    } finally {
      setIsPlanning(false);
    }
  };

  const handleExecutePlan = async () => {
    setError(null);
    const isConfigurationValid = agents.every(
      agent => agent.selectedChatbot
    );

    if (!isConfigurationValid) {
      setError("Please select a Chatbot UI for every agent.");
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/api/execute-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          objective: clarifiedObjective, 
          agents: agents,
          maxIterations: maxIterations 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'An unknown server error occurred');
      }

      setShowLogModal(true);

    } catch (err: any) {
      console.error("Failed to start process:", err);
      setError(err.message);
    }
  };

  const handleAgentConfigChange = (agentId: number, field: 'selectedChatbot', value: string) => {
    setAgents(currentAgents =>
      currentAgents.map(agent =>
        agent.id === agentId ? { ...agent, [field]: value } : agent
      )
    );
  };

  const resetWorkflow = () => {
    setInitialObjective('');
    setClarifiedObjective('');
    setAgents([]);
    setError(null);
    setIsConfigured(false);
    setIsPlanning(false);
  }

  const websocketUrl = `ws://${window.location.hostname}:8000`;

  return (
    <>
      <Container className="py-5">
        <header className="text-center mb-5">
          <h1>Multi-Agent WebApp</h1>
          <p className="lead">Define your objective and let the AI build and execute a plan.</p>
        </header>

        {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}

        <Row className="mb-4">
          <Col>
            <Form.Group className="mb-3" controlId="objective-input">
              <Form.Label><h2>1. What is the objective?</h2></Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="e.g., 'Write a blog post about the benefits of AI in education'"
                value={initialObjective}
                onChange={(e) => setInitialObjective(e.target.value)}
                readOnly={isConfigured} // Make it read-only after planning
              />
            </Form.Group>
          </Col>
        </Row>
        
        {!isConfigured ? (
          <Row>
            <Col className="text-center">
              <Button variant="primary" size="lg" onClick={handleCreatePlan} disabled={isPlanning}>
                {isPlanning ? <><Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> Creating Plan...</> : 'Create Plan'}
              </Button>
            </Col>
          </Row>
        ) : (
          <>
            <Row className="mb-4">
              <Col>
                <h2>2. Configure Your Agent Team</h2>
                <p>The AI has generated the following plan. Please configure the tools for each agent and set the collaboration limit.</p>
              </Col>
            </Row>

            {/* --- NEW: Iterations Dropdown --- */}
            <Row className="justify-content-center mb-4">
              <Col md={4}>
                <Card>
                  <Card.Body>
                    <Form.Group>
                      <Form.Label htmlFor="max-iterations-select">
                        <strong>Collaboration Iterations</strong>
                      </Form.Label>
                      <Form.Select
                        id="max-iterations-select"
                        value={maxIterations}
                        onChange={(e) => setMaxIterations(Number(e.target.value))}
                      >
                        <option value={1}>1 Iteration</option>
                        <option value={3}>3 Iterations</option>
                        <option value={5}>5 Iterations</option>
                        <option value={10}>10 Iterations</option>
                      </Form.Select>
                      <Form.Text>
                        The number of times the agents will loop through the plan to refine the result.
                      </Form.Text>
                    </Form.Group>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            <Row>
              {agents.map(agent => (
                <Col md={6} key={agent.id} className="mb-4">
                  <Card>
                    <Card.Header as="h5">{agent.name}</Card.Header>
                    <Card.Body>
                      <Card.Text><strong>Role:</strong> {agent.role}</Card.Text>
                      <Card.Text className="text-muted"><strong>Task:</strong> {agent.task}</Card.Text>
                      <Form.Group className="mb-3">
                        <Form.Label>Chatbot UI</Form.Label>
                        <Form.Select
                          value={agent.selectedChatbot}
                          onChange={(e) => handleAgentConfigChange(agent.id, 'selectedChatbot', e.target.value)}
                        >
                          <option value="">Select a Chatbot</option>
                          <option value="googleAIStudio">Google AI Studio</option>
                          <option value="claude">Claude</option>
                          <option value="chatGPT">ChatGPT</option>
                          <option value="perplexity">Perplexity</option>
                        </Form.Select>
                      </Form.Group>
                      
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
            <Row>
              <Col className="text-center d-grid gap-2 d-md-flex justify-content-md-center">
                 <Button variant="secondary" onClick={resetWorkflow}>Start Over</Button>
                 <Button variant="success" size="lg" onClick={handleExecutePlan}>
                  Execute Plan
                </Button>
              </Col>
            </Row>
          </>
        )}
      </Container>

      <ExecutionLogModal
        show={showLogModal}
        onHide={() => setShowLogModal(false)}
        websocketUrl={websocketUrl}
      />
    </>
  );
}

export default App;