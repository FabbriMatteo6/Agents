// src/agents/interaction-agent.ts
import { chromium } from 'playwright-extra';
// Use the 'require' syntax for better compatibility with this plugin
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { BrowserContext, Page } from 'playwright';
import path from 'path';
import TurndownService from 'turndown';

// --- STEP 2: Apply the stealth plugin ---
chromium.use(StealthPlugin());

// The AgentConfig type needs to be accessible here as well
type AgentConfig = {
  id: number;
  name: string;
  role: string;
  task: string;
  selectedChatbot: keyof typeof chatbotConfig;
};

type ChatbotInfo = {
  url: string;
  inputSelector: string;
  runButtonSelector: string;
  stopButtonSelector: string;
  responseSelector: string;
};

const chatbotConfig: Record<string, ChatbotInfo> = {
  googleAIStudio: {
    url: 'https://aistudio.google.com/prompts/new_chat',
    inputSelector: 'ms-prompt-input-wrapper textarea',
    runButtonSelector: 'button[aria-label="Run"]:not([disabled])',
    stopButtonSelector: 'button.run-button.stoppable',
    responseSelector: 'ms-cmark-node.cmark-node',
  },
  claude: {
    url: 'https://claude.ai/chats',
    inputSelector: 'div[contenteditable="true"]',
    runButtonSelector: 'button[aria-label="Send message"]:not([disabled])', 
    stopButtonSelector: 'button[aria-label="Stop response"]',
    responseSelector: 'div.grid.grid-cols-1',
  },
  chatGPT: {
    url: 'https://chatgpt.com/?model=auto&temporary-chat=true',
    inputSelector: 'div.ProseMirror',
    runButtonSelector: 'button[data-testid="send-button"]',
    stopButtonSelector: 'button[data-testid="stop-button"]',
    responseSelector: 'div.prose',
  },
  perplexity: {
    url: 'https://www.perplexity.ai/',
    inputSelector: '#ask-input',
    runButtonSelector: 'button[data-testid="submit-button"]',
    stopButtonSelector: 'button[data-testid="stop-generating-response-button"]', // Example of a more complex selector
    responseSelector: 'div.prose',
  },
};

const userDataDirPath = path.join(__dirname, '..', '..', 'playwright_user_data');

export class InteractionAgent {
  private context: BrowserContext | null = null;

  constructor() {
    console.log("InteractionAgent initialized with Stealth Plugin");
  }

  async start() {
    if (this.context) return;
    console.log(`Launching STEALTH browser with persistent user data from: ${userDataDirPath}`);
    this.context = await chromium.launchPersistentContext(userDataDirPath, {
      headless: false,
    });
    console.log("Stealth browser context started successfully.");
  }

  async setupPageForAgent(agentConfig: AgentConfig): Promise<Page> {
    if (!this.context) throw new Error("Browser context not started.");
    
    const config = chatbotConfig[agentConfig.selectedChatbot];
    if (!config) throw new Error(`Config for chatbot "${agentConfig.selectedChatbot}" not found.`);

    const page = await this.context.newPage();
    await page.goto(config.url, { timeout: 60000, waitUntil: 'domcontentloaded' });
    
    await page.waitForSelector(config.inputSelector, { timeout: 30000 });

    return page;
  }


  // --- REFACTORED: This method now operates on a specific page ---
  async performTaskOnPage(page: Page, agentConfig: AgentConfig, systemPrompt: string, objective: string): Promise<string> {
    const chatbotName = agentConfig.selectedChatbot;
    const config = chatbotConfig[chatbotName];
    if (!config) throw new Error(`Config for chatbot "${chatbotName}" not found.`);

    const fullPrompt = `--- SYSTEM PROMPT ---\n${systemPrompt}\n\n--- OBJECTIVE ---\n${objective}`;

    console.log(`Performing task for ${agentConfig.name} on page: ${page.url()}`);
    
    await page.waitForSelector(config.inputSelector, { timeout: 10000 });
    await page.locator(config.inputSelector).fill(fullPrompt);
    await page.waitForSelector(config.runButtonSelector, { timeout: 10000 });
    await page.click(config.runButtonSelector);
    console.log("Run button clicked.");
    
    console.log("Waiting for generation to start...");
    await page.waitForSelector(config.stopButtonSelector, { state: 'visible', timeout: 20000 });
    console.log("Generation in progress. Waiting for completion...");
    await page.waitForSelector(config.stopButtonSelector, { state: 'hidden', timeout: 120000 });
    console.log("Generation complete.");

    const turndownService = new TurndownService();
    await this.waitForTextToStabilize(config.responseSelector, page); // Pass page to helper

    let scrapedOutput: string | null = null;

    if (chatbotName === 'claude') {
    console.log('Applying Claude-specific scraping strategy.');
    const allResponseLocators = await page.locator(config.responseSelector).all();

    if (allResponseLocators.length <= 1) {
        throw new Error("Claude scraping error: Could not find response elements after the initial prompt.");
    }
    
    const relevantResponses = allResponseLocators.slice(1);
    
    // Get the HTML content of each response element
    const htmlContents = await Promise.all(
        relevantResponses.map(locator => locator.innerHTML()) // Use innerHTML() here
    );

    // Convert each HTML string to Markdown and then join them
    scrapedOutput = htmlContents.map(html => turndownService.turndown(html)).join('\n\n');

    } else {
    // Default strategy for Google AI Studio and others
    console.log('Applying default scraping strategy (last element).');
    const lastResponse = page.locator(config.responseSelector).last();
    
    // Get the HTML content
    const htmlContent = await lastResponse.innerHTML(); // Use innerHTML() here
    
    // Convert the HTML to Markdown
    if (htmlContent) {
        scrapedOutput = turndownService.turndown(htmlContent);
    }
    }

    if (!scrapedOutput) throw new Error("Scraped output was empty or null.");

    console.log("Successfully scraped STABLE output as Markdown.");
    return scrapedOutput.trim();
  }

  private async waitForTextToStabilize(selector: string, page: Page, timeout = 15000) {
    console.log(`Waiting for text in selector "${selector}" to stabilize...`);
    let previousText = '';
    let stableCounter = 0;
    const stabilityThreshold = 3;
    const pollingInterval = 500;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // --- FIX: Use the 'page' variable, not 'this.page' ---
      const locator = page.locator(selector).last();
      const elementExists = await locator.count() > 0;
      
      if (!elementExists) {
        await page.waitForTimeout(pollingInterval);
        continue;
      }
      
      const currentText = await locator.textContent() || '';

      if (currentText === previousText && currentText.length > 0) {
        stableCounter++;
      } else {
        stableCounter = 0;
      }

      if (stableCounter >= stabilityThreshold) {
        console.log(`Text stabilized after ${Date.now() - startTime}ms.`);
        return;
      }

      previousText = currentText;
      // --- FIX: Use the 'page' variable, not 'this.page' ---
      await page.waitForTimeout(pollingInterval);
    }

    throw new Error(`Response text in "${selector}" did not stabilize within ${timeout}ms.`);
  }

  async close() {
    if (this.context) {
      await this.context.close();
      this.context = null;
      // REMOVED: this.page = null;
      console.log("Browser context closed.");
    }
  }
}