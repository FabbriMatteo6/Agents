// backend/src/agents/agent-manager.ts
import { WebSocketService } from '../websocket-service';
import { ClarifierAgent } from './clarifier-agent';
import { InteractionAgent } from './interaction-agent';
import { PrompterAgent } from './prompter-agent';
import { PlannerAgent, AgentPlan } from './planner-agent';
import { FormatterAgent } from './formatter-agent'; // Import FormatterAgent
import { FinalizerAgent } from './finalizer-agent';
import { ReviewerAgent } from './reviewer-agent';
import { Page } from 'playwright';

// Define the structure of the agent configuration we expect from the frontend
type AgentConfig = {
  id: number;
  name: string;
  role: string;
  task: string;
  selectedChatbot: string;

};

// A new type to hold the agent's full execution context
type ExecutionAgent = {
  config: AgentConfig;
  systemPrompt: string;
};

export interface SharedContext {
  objective: string;
  lastOutput: string;
  history: { agent: string; task: string; result: string }[];
  feedback: string | null;
  status: 'in-progress' | 'awaiting-review' | 'complete';
}

export class AgentManager {
  private clarifier: ClarifierAgent;
  private prompter: PrompterAgent;
  private planner: PlannerAgent; // Add planner
  private formatter: FormatterAgent; // Add formatter
  private finalizer: FinalizerAgent; // Add finalizer


  constructor(private wsService: WebSocketService) {
    console.log("AgentManager initialized.");
    this.clarifier = new ClarifierAgent();
    this.prompter = new PrompterAgent();
    this.planner = new PlannerAgent(); // Initialize planner
    this.formatter = new FormatterAgent(); // Initialize formatter
    this.finalizer = new FinalizerAgent(); // Initialize finalizer
  }

  // NEW METHOD FOR THE PLANNING PHASE
  async createPlan(initialPrompt: string): Promise<{ plan: AgentPlan[], clarifiedObjective: string }> {
    this.wsService.broadcast({ type: 'log', source: 'Manager', message: `Creating plan for objective: "${initialPrompt}"` });
    
    const clarifiedObjective = await this.clarifier.clarify(initialPrompt);
    this.wsService.broadcast({ type: 'log', source: 'ClarifierAgent', message: `Objective clarified: ${clarifiedObjective}` });
    
    const plan = await this.planner.generatePlan(clarifiedObjective);
    this.wsService.broadcast({ type: 'log', source: 'PlannerAgent', message: `Plan generated with ${plan.length} agents.` });
    
    // Return both the plan and the clarified objective
    return { plan, clarifiedObjective };
  }
  
  async executePlan(clarifiedObjective: string, agentConfigs: AgentConfig[], maxIterations: number) {
    this.wsService.broadcast({ type: 'log', source: 'Manager', message: `Starting plan execution with ${maxIterations} iteration(s).` });

    const interactionAgent = new InteractionAgent();
    const reviewerAgent = new ReviewerAgent(); 
    let agentPages = new Map<number, Page>();

    // NEW: Initialize the SharedContext
    let sharedContext: SharedContext = {
      objective: clarifiedObjective,
      lastOutput: `The initial high-level objective is: "${clarifiedObjective}"`,
      history: [],
      feedback: null,
      status: 'in-progress',
    };

    try {
      // --- STEP 1: Generate all prompts upfront ---
      const executionAgents: ExecutionAgent[] = [];
      for (const config of agentConfigs) {
        const systemPrompt = await this.prompter.generatePrompt(clarifiedObjective, config);
        executionAgents.push({ config, systemPrompt });
        this.wsService.broadcast({ type: 'log', source: 'PrompterAgent', message: `Generated system prompt for agent: ${config.name}.` });
      }

      // --- STEP 2: Start ONE browser and set up a tab for each agent ---
      await interactionAgent.start();
      this.wsService.broadcast({ type: 'log', source: 'InteractionAgent', message: 'Persistent browser started.' });

      for (const agent of executionAgents) {
        const page = await interactionAgent.setupPageForAgent(agent.config);
        agentPages.set(agent.config.id, page);
        this.wsService.broadcast({ type: 'log', source: 'Manager', message: `Prepared browser tab for ${agent.config.name} at ${agent.config.selectedChatbot}.` });
      }
      
      // --- STEP 3: The Main Iteration Loop ---
      let lastOutput = `The initial high-level objective is: "${clarifiedObjective}"`;

      for (let i = 0; i < maxIterations; i++) {
        this.wsService.broadcast({ type: 'log', source: 'Manager', message: `--- Starting Iteration ${i + 1} of ${maxIterations} ---` });

        for (const agent of executionAgents) {
          const page = agentPages.get(agent.config.id);
          if (!page) {
            throw new Error(`Could not find a browser page for agent ${agent.config.name}`);
          }

          const taskInput = sharedContext.feedback 
                ? `Based on the previous step's feedback: "${sharedContext.feedback}", and the last output: "${sharedContext.lastOutput}", please proceed.`
                : sharedContext.lastOutput;

            const result = await interactionAgent.performTaskOnPage(
                page,
                agent.config,
                agent.systemPrompt,
                taskInput
            );

            const cleanedResult = this.formatter.clean(result);

            // NEW: Update SharedContext
            sharedContext.lastOutput = cleanedResult;
            sharedContext.history.push({
                agent: agent.config.name,
                task: agent.config.task,
                result: cleanedResult,
            });

            // NEW: Invoke ReviewerAgent
            const review = await reviewerAgent.review(sharedContext);
            sharedContext.feedback = review.feedback;

            this.wsService.broadcast({
                type: 'review',
                source: 'ReviewerAgent',
                feedback: review.feedback,
                approved: review.approved,
            });

            if (!review.approved) {
                this.wsService.broadcast({ type: 'log', source: 'Manager', message: `Reviewer provided feedback. Repeating step with adjustments.` });
                // Logic to repeat the step or adjust the plan can be added here
            }

            this.wsService.broadcast({
                type: 'result',
                source: agent.config.name,
                output: cleanedResult
            });
        }
    }

      this.wsService.broadcast({ type: 'log', source: 'Manager', message: 'All iterations complete. Engaging FinalizerAgent...' });
      const finalPolishedSummary = await this.finalizer.finalize(lastOutput);

      this.wsService.broadcast({
        type: 'result',
        source: 'FinalizerAgent',
        message: 'Final polished summary generated.',
        output: finalPolishedSummary
      });
      this.wsService.broadcast({ type: 'status', status: 'complete' });

    } catch (error: any) {
      // This catch block now handles errors from the entire process
      console.error("Error during AgentManager run:", error);
      this.wsService.broadcast({ type: 'error', source: 'Manager', message: error.message });
      this.wsService.broadcast({ type: 'status', status: 'error' });
    } finally {
      // The finally block correctly ensures the browser closes
      await interactionAgent.close();
      this.wsService.broadcast({ type: 'log', source: 'InteractionAgent', message: 'Browser closed.' });
    }
  }
}