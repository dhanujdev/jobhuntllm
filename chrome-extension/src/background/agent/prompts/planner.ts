/* eslint-disable @typescript-eslint/no-unused-vars */
import { BasePrompt } from './base';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { AgentContext } from '@src/background/agent/types';
import { plannerSystemPromptTemplate } from './templates/planner';
import { jobHuntPlannerSystemPrompt } from './templates/jobhunt';

export class PlannerPrompt extends BasePrompt {
  getSystemMessage(): SystemMessage {
    // Use JobHuntLLM specialized prompt that includes job application expertise
    return new SystemMessage(jobHuntPlannerSystemPrompt);
  }

  async getUserMessage(context: AgentContext): Promise<HumanMessage> {
    return new HumanMessage('');
  }
}
