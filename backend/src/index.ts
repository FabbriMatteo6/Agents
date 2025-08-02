// backend/src/index.ts
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { AgentManager } from './agents/agent-manager';
import { InteractionAgent } from './agents/interaction-agent';
import http from 'http'; // Import the 'http' module
import { WebSocketService } from './websocket-service';

dotenv.config();

const app = express();
const port = process.env.PORT || 8000;

// --- WebSocket and Server Setup ---
// 1. Create an HTTP server from our Express app
const server = http.createServer(app);

// 2. Instantiate our WebSocketService and pass it the server
const wsService = new WebSocketService(server);

// 3. Instantiate the AgentManager, giving it access to the WebSocket service
const agentManager = new AgentManager(wsService);

// ======================= DEEP LOGGING START =======================
// This is the most powerful debugging tool we have. It listens for the raw
// HTTP request that asks to be "upgraded" to a WebSocket connection.
server.on('upgrade', (request, socket, head) => {
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.log('!!! BACKEND: Received an HTTP UPGRADE request to WebSocket.');
    console.log(`!!! Request URL: ${request.url}`);
    console.log(`!!! Request Origin: ${request.headers.origin}`);
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
  });
  // ======================== DEEP LOGGING END ========================

app.use(cors());
app.use(express.json());

app.get('/api/status', (req: Request, res: Response) => {
  res.json({ status: 'Backend is running!' });
});

app.post('/api/execute-plan', async (req: Request, res: Response) => {
  try {
    const { objective, agents, maxIterations } = req.body;
    if (!objective || !agents || !Array.isArray(agents) || agents.length === 0) {
      return res.status(400).json({ error: 'A clarified objective and a valid agents configuration are required.' });
    }

    // The manager's execution runs in the background.
    // --- MODIFIED: Pass maxIterations to the executePlan method ---
    new AgentManager(wsService).executePlan(objective, agents, maxIterations || 1);;

    res.status(202).json({ message: 'Execution started. See live log for updates.' });

  } catch (error: any) {
    console.error("Error in /api/execute-plan:", error);
    wsService.broadcast({ type: 'error', message: `Failed to start execution: ${error.message}` });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/create-plan', async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'A prompt is required to create a plan.' });
    }
    
    const result = await new AgentManager(wsService).createPlan(prompt);
    
    // Send the entire result object back
    res.status(200).json(result);

  } catch (error: any) {
    console.error("Error in /api/create-plan:", error);
    wsService.broadcast({ type: 'error', message: `Failed to create plan: ${error.message}` });
    res.status(500).json({ error: 'Internal server error while creating plan' });
  }
});

// =================================================================
// =========== REFINED TEST ROUTE FOR THE INTERACTION AGENT =========
// =================================================================
// app.post('/api/test-interaction', async (req: Request, res: Response) => {
//     const { prompt, chatbot } = req.body;
//     if (!prompt || !chatbot) {
//       return res.status(400).json({ error: 'A prompt and chatbot name (e.g., "googleAIStudio") are required.' });
//     }

//     // We create a new agent for each request to ensure a clean state.
//     const agent = new InteractionAgent();
    
//     try {
//       console.log('--- Starting Interaction Agent Test ---');
//       await agent.start(); // This launches the browser

//       const result = await agent.performTask(chatbot as any, prompt);
      
//       console.log('--- Interaction Agent Test Complete ---');
//       res.status(200).json({ success: true, scrapedData: result });
  
//     } catch (error: any) {
//       console.error("Error during interaction agent test:", error);
//       res.status(500).json({ success: false, error: error.message });
  
//     } finally {
//       // The 'finally' block ensures the browser always closes, even if an error occurs.
//       console.log("Ensuring browser is closed.");
//       await agent.close();
//     }
// });


server.listen(Number(port), "127.0.0.1", () => {
    console.log(`[server]: Server is running at http://127.0.0.1:${port}`);
  });